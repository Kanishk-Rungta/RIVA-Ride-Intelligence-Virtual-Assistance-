/**
 * Benchmark: measures each agent against its performance measure (the "P"
 * of PEAS) over hundreds of generated cases, and writes the numbers to
 * docs/results/evaluation.json for the report's tables and figures.
 *
 *   npm run evaluate
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRiva } from './harness.js';
import { ROAD_NODES, findRoute } from '../src/ai/road-network.js';
import { SEARCH_STRATEGIES, search, type SearchStrategy } from '../src/ai/search.js';
import { pathCost, tourProblem } from '../src/ai/tour.js';
import { RankingService } from '../src/services/ranking.service.js';
import { createSeededRandom } from '../src/services/sim.util.js';
import type { RideOption } from '../src/domain/types.js';
import type { MarketplaceResult } from '../src/modules/marketplace/marketplace.service.js';

const riva = createRiva();
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const pct = (x: number) => round(x * 100, 1);
const log = (title: string, rows: Record<string, unknown>[]) => {
  console.log(`\n${title}`);
  console.table(rows);
};

// ---------------------------------------------------------------- 1. search
function evaluateSearch() {
  const pairs = ROAD_NODES.flatMap((a) => ROAD_NODES.filter((b) => b.id !== a.id).map((b) => [a.id, b.id] as const));
  const hours = [3, 9, 14, 19];
  const out: Record<string, unknown> = { pairs: pairs.length, hours, objectives: {} as Record<string, unknown> };

  for (const objective of ['time', 'distance'] as const) {
    const stats = Object.fromEntries(SEARCH_STRATEGIES.map((s) => [s, { expanded: [] as number[], generated: [] as number[], frontier: [] as number[], gap: [] as number[], optimal: 0 }]));
    for (const hour of hours) {
      for (const [from, to] of pairs) {
        const runs = SEARCH_STRATEGIES.map((s) => findRoute(from, to, { strategy: s, objective, hour }));
        const best = Math.min(...runs.map((r) => r.search.cost));
        for (const r of runs) {
          const s = stats[r.strategy];
          s.expanded.push(r.search.nodesExpanded);
          s.generated.push(r.search.nodesGenerated);
          s.frontier.push(r.search.maxFrontierSize);
          s.gap.push(r.search.cost / best - 1);
          if (r.search.cost - best < 1e-9) s.optimal++;
        }
      }
    }
    const n = pairs.length * hours.length;
    const rows = SEARCH_STRATEGIES.map((s) => ({
      strategy: s,
      optimalPercent: pct(stats[s].optimal / n),
      meanNodesExpanded: round(mean(stats[s].expanded), 1),
      meanNodesGenerated: round(mean(stats[s].generated), 1),
      meanMaxFrontier: round(mean(stats[s].frontier), 1),
      meanExcessCostPercent: pct(mean(stats[s].gap)),
      worstExcessCostPercent: pct(Math.max(...stats[s].gap)),
    }));
    (out.objectives as Record<string, unknown>)[objective] = rows;
    log(`Search strategies — objective ${objective}, ${n} route queries`, rows);
  }

  // Fastest vs shortest: how often does minimising time change the route?
  let differ = 0;
  for (const [from, to] of pairs) {
    const t = findRoute(from, to, { objective: 'time', hour: 9 });
    const d = findRoute(from, to, { objective: 'distance', hour: 9 });
    if (t.nodeIds.join() !== d.nodeIds.join()) differ++;
  }
  out.fastestDiffersFromShortestPercent = pct(differ / pairs.length);
  console.log(`At 9 AM the fastest route differs from the shortest on ${out.fastestDiffersFromShortestPercent}% of pairs.`);
  return out;
}

// ---------------------------------------------------------------- 2. stop ordering
function evaluateTours() {
  const rng = createSeededRandom(7);
  const bySize: Record<number, { saved: number[]; savedPct: number[]; astar: number[]; ucs: number[]; improved: number }> = {};
  const factorial = (k: number): number => (k <= 1 ? 1 : k * factorial(k - 1));

  for (let trial = 0; trial < 300; trial++) {
    const size = 4 + (trial % 5); // 4..8 stops incl. start and end
    const ids = [...ROAD_NODES].sort(() => rng() - 0.5).slice(0, size).map((n) => n.id);
    const cost = ids.map((a) => ids.map((b) => (a === b ? 0 : findRoute(a, b, { objective: 'time', hour: 14 }).search.cost)));
    const astar = search(tourProblem(cost), 'astar');
    const ucs = search(tourProblem(cost), 'ucs');
    const given = pathCost(cost, ids.map((_, i) => i));
    const s = (bySize[size] ??= { saved: [], savedPct: [], astar: [], ucs: [], improved: 0 });
    s.saved.push(given - astar.cost);
    s.savedPct.push((given - astar.cost) / given);
    s.astar.push(astar.nodesExpanded);
    s.ucs.push(ucs.nodesExpanded);
    if (given - astar.cost > 0.5) s.improved++;
  }
  const rows = Object.entries(bySize).map(([size, s]) => ({
    stops: Number(size),
    itineraries: s.saved.length,
    improvedPercent: pct(s.improved / s.saved.length),
    meanMinutesSaved: round(mean(s.saved), 1),
    meanTimeSavedPercent: pct(mean(s.savedPct)),
    astarStatesExpanded: round(mean(s.astar), 1),
    ucsStatesExpanded: round(mean(s.ucs), 1),
    bruteForceOrders: factorial(Number(size) - 2),
  }));
  log('Multi-stop ordering — random itineraries over the road graph, 2 PM', rows);
  return rows;
}

// ---------------------------------------------------------------- 3. marketplace
async function evaluateMarketplace() {
  const places = ['Amrita University', 'Coimbatore Airport', 'Gandhipuram', 'RS Puram', 'Peelamedu', 'Coimbatore Junction', 'Saravanampatti', 'Ukkadam', 'Singanallur', 'Tidel Park', 'Vadavalli', 'Podanur'];
  const hours = [9, 14, 19, 23];
  const configs = {
    full: { maxAwards: 3, maxRounds: 2, label: 'Full protocol (re-award + incentive)' },
    noIncentive: { maxAwards: 3, maxRounds: 1, label: 'Re-award, no incentive' },
    singleShot: { maxAwards: 1, maxRounds: 1, label: 'Single shot (award best bid once)' },
  };
  const out: Record<string, unknown> = {};
  const rows = [];

  for (const [key, cfg] of Object.entries(configs)) {
    const runs: MarketplaceResult[] = [];
    for (const hour of hours) {
      for (const origin of places) {
        for (const destination of places) {
          if (origin === destination) continue;
          runs.push(await riva.marketplace.simulate(origin, destination, undefined, { hour, seed: `${origin}|${destination}|${hour}`, weekend: false, ...cfg }));
        }
      }
    }
    const matched = runs.filter((r) => r.outcome.status === 'MATCHED');
    const row = {
      config: cfg.label,
      runs: runs.length,
      matchRatePercent: pct(matched.length / runs.length),
      firstAwardMatchPercent: pct(matched.filter((r) => r.metrics.awards === 1).length / runs.length),
      meanMessages: round(mean(runs.map((r) => r.metrics.messageCount)), 1),
      meanDriverOffers: round(mean(runs.map((r) => r.metrics.driverOffers)), 1),
      driverAcceptancePercent: pct(mean(runs.filter((r) => r.metrics.driverOffers > 0).map((r) => r.metrics.driverAcceptanceRate))),
      incentiveUsedPercent: pct(matched.filter((r) => r.outcome.incentive > 0).length / Math.max(1, matched.length)),
      meanSecondsToOutcome: round(mean(runs.map((r) => r.metrics.timeToOutcomeSeconds)), 1),
      meanUtilityRankOfRide: round(mean(matched.map((r) => r.outcome.option!.rank)), 2),
    };
    rows.push(row);
    out[key] = row;

    if (key === 'full') {
      out.byHour = hours.map((h) => {
        const subset = runs.filter((r) => r.time === runs.find((x) => x.time)!.time.replace(/^.*$/, '') || true).filter((r) => r.time.startsWith(String(h % 12 === 0 ? 12 : h % 12)) && r.time.endsWith(h >= 12 ? 'PM' : 'AM'));
        return {
          hour: h,
          matchRatePercent: pct(subset.filter((r) => r.outcome.status === 'MATCHED').length / subset.length),
          driverAcceptancePercent: pct(mean(subset.filter((r) => r.metrics.driverOffers > 0).map((r) => r.metrics.driverAcceptanceRate))),
        };
      });
      out.messagesHistogram = runs.map((r) => r.metrics.messageCount);
    }
  }
  log('Multi-agent marketplace — 12 landmarks, every ordered pair, 4 times of day', rows);
  log('Full protocol by hour', out.byHour as Record<string, unknown>[]);
  return out;
}

// ---------------------------------------------------------------- 4. driver shift MDP
function evaluateShifts() {
  const zones = riva.demand.listZones();
  const rows = [];
  for (const [vehicleType, fuelType] of [['auto', 'cng'], ['sedan', 'diesel']] as const) {
    const plans = [];
    for (let startHour = 0; startHour < 24; startHour++) {
      for (const z of zones) {
        plans.push(riva.shiftPlanner.plan({ currentLocation: z.coordinates, startHour, hours: 4, vehicleType, fuelType, provider: 'uber', weekend: false }));
      }
    }
    rows.push({
      vehicle: `${vehicleType} (${fuelType})`,
      startStates: plans.length,
      meanOptimal: round(mean(plans.map((p) => p.expectedEarnings.optimal)), 0),
      meanGreedy: round(mean(plans.map((p) => p.expectedEarnings.greedy)), 0),
      meanStayPut: round(mean(plans.map((p) => p.expectedEarnings.stayPut)), 0),
      meanUpliftVsStayPercent: round(mean(plans.map((p) => p.upliftVsStayPutPercent)), 1),
      maxUpliftVsStayPercent: Math.max(...plans.map((p) => p.upliftVsStayPutPercent)),
      meanUpliftVsGreedyPercent: round(mean(plans.map((p) => p.upliftVsGreedyPercent)), 2),
      maxUpliftVsGreedyPercent: Math.max(...plans.map((p) => p.upliftVsGreedyPercent)),
      repositionFirstPercent: pct(plans.filter((p) => p.firstMove.startsWith('Reposition')).length / plans.length),
    });
  }
  log('Driver shift MDP — every zone × every start hour, 4-hour horizon', rows);

  const byHour = Array.from({ length: 24 }, (_, h) => {
    const plans = zones.map((z) => riva.shiftPlanner.plan({ currentLocation: z.coordinates, startHour: h, hours: 4, vehicleType: 'auto', fuelType: 'cng', provider: 'uber', weekend: false }));
    return {
      hour: h,
      optimal: round(mean(plans.map((p) => p.expectedEarnings.optimal)), 0),
      greedy: round(mean(plans.map((p) => p.expectedEarnings.greedy)), 0),
      stayPut: round(mean(plans.map((p) => p.expectedEarnings.stayPut)), 0),
    };
  });
  return { summary: rows, byHour };
}

// ---------------------------------------------------------------- 5. preference learning
async function evaluateLearning() {
  const places = ['Amrita University', 'Coimbatore Airport', 'Gandhipuram', 'RS Puram', 'Peelamedu', 'Coimbatore Junction', 'Saravanampatti', 'Ukkadam', 'Singanallur', 'Tidel Park'];
  const rng = createSeededRandom(2026);
  const RIDERS = 40;
  const BOOKINGS = 15;
  const learnedHits = Array(BOOKINGS).fill(0);
  const staticHits = Array(BOOKINGS).fill(0);

  // Pre-fetch a pool of searches once; riders draw trips from it.
  const pools: RideOption[][] = [];
  for (const o of places) {
    for (const d of places) {
      if (o === d) continue;
      const { filteredOptions } = await riva.rideSearch.search(o, d, undefined, undefined, 14);
      pools.push(filteredOptions.filter((x) => x.availability));
    }
  }

  for (let rider = 0; rider < RIDERS; rider++) {
    // Hidden true weights, drawn at random and normalised.
    const raw = [rng(), rng(), rng()].map((x) => 0.05 + x);
    const total = raw.reduce((a, b) => a + b, 0);
    const [wf, we, wr] = raw.map((x) => x / total);
    const learner = new RankingService();
    const baseline = new RankingService();

    for (let b = 0; b < BOOKINGS; b++) {
      const pool = pools[Math.floor(rng() * pools.length)];
      const mf = Math.max(...pool.map((x) => x.fare));
      const me = Math.max(...pool.map((x) => x.pickupEtaMinutes));
      const truth = (x: RideOption) => wf * (x.fare / mf) + we * (x.pickupEtaMinutes / me) + wr * (1 - x.rating / 5);
      const choice = pool.reduce((a, c) => (truth(c) < truth(a) ? c : a));
      if (learner.rank(pool, 'best_value')[0].optionId === choice.optionId) learnedHits[b]++;
      if (baseline.rank(pool, 'best_value')[0].optionId === choice.optionId) staticHits[b]++;
      learner.learnFromChoice(choice, pool);
    }
  }
  const curve = learnedHits.map((h, i) => ({ booking: i + 1, learnedTop1Percent: pct(h / RIDERS), staticTop1Percent: pct(staticHits[i] / RIDERS) }));
  log(`Preference learning — ${RIDERS} simulated riders with hidden weights, top-1 agreement per booking`, curve);
  return {
    riders: RIDERS,
    bookings: BOOKINGS,
    curve,
    firstFiveLearned: pct(mean(learnedHits.slice(0, 5)) / RIDERS),
    lastFiveLearned: pct(mean(learnedHits.slice(-5)) / RIDERS),
    lastFiveStatic: pct(mean(staticHits.slice(-5)) / RIDERS),
  };
}

const started = Date.now();
const results = {
  generatedAt: new Date().toISOString(),
  search: evaluateSearch(),
  tours: evaluateTours(),
  marketplace: await evaluateMarketplace(),
  shifts: evaluateShifts(),
  learning: await evaluateLearning(),
};
mkdirSync('docs/results', { recursive: true });
writeFileSync('docs/results/evaluation.json', JSON.stringify(results, null, 2));
console.log(`\nWrote docs/results/evaluation.json in ${((Date.now() - started) / 1000).toFixed(1)} s`);
process.exit(0);
