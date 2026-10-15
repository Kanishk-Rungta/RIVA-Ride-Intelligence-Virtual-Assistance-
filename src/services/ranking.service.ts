import { Injectable } from '@nitrostack/core';
import type { RankedRideOption, RankingMode, RideOption, UtilityWeights } from '../domain/types.js';

const DEFAULT_WEIGHTS: UtilityWeights = { fare: 0.45, pickupEta: 0.35, rating: 0.2 };

/** Learning rate of the preference perceptron, and the floor that keeps every criterion in play. */
const LEARNING_RATE = 0.6;
const MIN_WEIGHT = 0.05;

/**
 * RankingService — the rider agent's utility function.
 *
 * best_value is a multi-attribute utility: a weighted sum of normalised
 * fare, pickup ETA, and (inverted) rating, lower is better. The weights
 * start at 45/35/20 and are then LEARNED from the rider's own bookings:
 * every confirmed booking is a revealed preference ("I chose this over the
 * options you ranked above it"), and learnFromChoice() nudges the weights
 * so the chosen ride would have scored better — a ranking-perceptron
 * update. Learned weights are process-wide, like the rest of the rider
 * state (no accounts in this build).
 *
 * Every ranked option is also tagged with Pareto optimality, so the
 * response can say which rides are never a rational choice whatever the
 * weights are.
 */
@Injectable()
export class RankingService {
  private weights: UtilityWeights = { ...DEFAULT_WEIGHTS };

  getWeights(): UtilityWeights {
    return { ...this.weights };
  }

  resetWeights(): void {
    this.weights = { ...DEFAULT_WEIGHTS };
  }

  rank(options: RideOption[], mode: RankingMode): RankedRideOption[] {
    const available = options.filter((o) => o.availability);
    // Normalize scores against the available pool (falling back to the full
    // set if nothing is available) so fare/ETA comparisons stay meaningful,
    // but always RETURN every option — including unavailable ones — so the
    // count the caller reports (e.g. totalOptionsFound) always matches the
    // length of the returned list. Unavailable rides are simply sorted last.
    const normalizationPool = available.length > 0 ? available : options;

    const scored = options.map((option) => {
      const entry = this.score(option, mode, normalizationPool);
      return option.availability ? entry : { ...entry, score: entry.score + 1_000_000 };
    });
    scored.sort((a, b) => a.score - b.score);

    return scored.map((entry, index) => ({
      ...entry.option,
      rank: index + 1,
      score: Math.round(entry.score * 100) / 100,
      scoreReason: entry.option.availability ? entry.reason : `Currently unavailable — ${entry.reason}`,
      paretoOptimal: entry.option.availability && !available.some((other) => dominates(other, entry.option)),
    }));
  }

  explainMode(mode: RankingMode): string {
    switch (mode) {
      case 'cheapest':
        return 'Sorted by lowest fare first.';
      case 'fastest':
        return 'Sorted by shortest total trip duration (pickup ETA + ride time).';
      case 'instant_pickup':
        return 'Sorted by shortest pickup ETA — best for riders who want the first available car.';
      case 'best_value':
      default: {
        const w = this.weights;
        const pct = (x: number) => `${Math.round(x * 100)}%`;
        return `Balanced utility: fare ${pct(w.fare)}, pickup ETA ${pct(w.pickupEta)}, rating ${pct(w.rating)} (weights adapt to the rides you book).`;
      }
    }
  }

  /**
   * Ranking-perceptron update from a revealed preference. For every option
   * the current weights ranked ABOVE the one the rider chose, move the
   * weights against the feature difference so the chosen option's score
   * drops relative to it. Weights are then clipped and renormalised so they
   * stay a convex combination.
   */
  learnFromChoice(chosen: RideOption, pool: RideOption[]): { before: UtilityWeights; after: UtilityWeights; violations: number } {
    const before = this.getWeights();
    const available = pool.filter((o) => o.availability);
    if (!available.some((o) => o.optionId === chosen.optionId)) available.push(chosen);

    const scale = normalisers(available);
    const fChosen = features(chosen, scale);
    const scoreOf = (f: number[]) => f[0] * this.weights.fare + f[1] * this.weights.pickupEta + f[2] * this.weights.rating;

    const preferredOver = available
      .filter((o) => o.optionId !== chosen.optionId)
      .map((o) => features(o, scale))
      .filter((f) => scoreOf(f) < scoreOf(fChosen));

    if (preferredOver.length === 0) return { before, after: before, violations: 0 };

    const gradient = [0, 0, 0];
    for (const f of preferredOver) {
      for (let i = 0; i < 3; i++) gradient[i] += (fChosen[i] - f[i]) / preferredOver.length;
    }

    const raw = [
      this.weights.fare - LEARNING_RATE * gradient[0],
      this.weights.pickupEta - LEARNING_RATE * gradient[1],
      this.weights.rating - LEARNING_RATE * gradient[2],
    ].map((w) => Math.max(MIN_WEIGHT, w));
    const total = raw.reduce((a, b) => a + b, 0);
    this.weights = { fare: raw[0] / total, pickupEta: raw[1] / total, rating: raw[2] / total };

    return { before, after: this.getWeights(), violations: preferredOver.length };
  }

  private score(
    option: RideOption,
    mode: RankingMode,
    pool: RideOption[]
  ): { option: RideOption; score: number; reason: string } {
    switch (mode) {
      case 'cheapest':
        return { option, score: option.fare, reason: `₹${option.fare} fare` };

      case 'fastest': {
        const total = option.pickupEtaMinutes + option.tripDurationMinutes;
        return {
          option,
          score: total,
          reason: `${option.pickupEtaMinutes} min pickup + ${option.tripDurationMinutes} min ride = ${total} min total`,
        };
      }

      case 'instant_pickup':
        return {
          option,
          score: option.pickupEtaMinutes,
          reason: `${option.pickupEtaMinutes} min pickup ETA`,
        };

      case 'best_value':
      default: {
        const [fareNorm, etaNorm, ratingNorm] = features(option, normalisers(pool));
        const score = fareNorm * this.weights.fare + etaNorm * this.weights.pickupEta + ratingNorm * this.weights.rating;
        return {
          option,
          score,
          reason: `Balances ₹${option.fare} fare, ${option.pickupEtaMinutes} min pickup, and ${option.rating}★ rating`,
        };
      }
    }
  }
}

function normalisers(pool: RideOption[]): { maxFare: number; maxEta: number } {
  return {
    maxFare: Math.max(...pool.map((o) => o.fare), 1),
    maxEta: Math.max(...pool.map((o) => o.pickupEtaMinutes), 1),
  };
}

/** Feature vector, every component in [0, 1] and lower-is-better. */
function features(option: RideOption, { maxFare, maxEta }: { maxFare: number; maxEta: number }): number[] {
  return [option.fare / maxFare, option.pickupEtaMinutes / maxEta, 1 - option.rating / 5];
}

function dominates(a: RideOption, b: RideOption): boolean {
  if (a.optionId === b.optionId) return false;
  const noWorse = a.fare <= b.fare && a.pickupEtaMinutes <= b.pickupEtaMinutes && a.rating >= b.rating;
  const better = a.fare < b.fare || a.pickupEtaMinutes < b.pickupEtaMinutes || a.rating > b.rating;
  return noWorse && better;
}
