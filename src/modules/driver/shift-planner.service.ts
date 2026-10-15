import { Injectable } from '@nitrostack/core';
import { DemandService } from './demand.service.js';
import { DriverService } from './driver.service.js';
import { evaluatePolicy, qValue, solveByBackwardInduction, type FiniteHorizonMdp, type Outcome } from '../../ai/mdp.js';
import { findRoute, nearestNode } from '../../ai/road-network.js';
import { haversineDistanceKm } from '../../services/sim.util.js';
import { formatHourLabel } from '../../services/time.util.js';
import type { DemandZoneProfile, FuelType, LatLng, ProviderId, VehicleType } from '../../domain/types.js';

/** Blended per-vehicle fare used to value a trip (base + per-km, averaged across the three platforms). */
const TRIP_FARE: Record<VehicleType, { base: number; perKm: number }> = {
  bike: { base: 18, perKm: 5.5 },
  auto: { base: 26, perKm: 10 },
  mini: { base: 42, perKm: 12.5 },
  sedan: { base: 62, perKm: 15.5 },
  suv: { base: 100, perKm: 20 },
};
const LOCAL_TRIP_KM = 5;
const LOCAL_TRIP_MINUTES = 14;
const AVERAGE_PICKUP_KM = 1.5;
const PICKUP_MINUTES = 5;
/** Distance decay of the trip-distribution gravity model, km. */
const GRAVITY_KM = 6;

type Zone = string;
type Action = string; // 'wait' | `move:${zoneKey}`

export interface ShiftPlanInput {
  currentLocation: LatLng;
  startHour: number;
  hours: number;
  vehicleType: VehicleType;
  fuelType: FuelType;
  provider: ProviderId;
  weekend: boolean;
}

export interface ShiftStep {
  time: string;
  zone: string;
  action: string;
  expectedTrips: number;
  expectedEarningThisHour: number;
}

export interface ShiftPlan {
  startZone: string;
  snappedFromKm: number;
  startTime: string;
  hours: number;
  expectedEarnings: { optimal: number; greedy: number; stayPut: number };
  upliftVsGreedyPercent: number;
  upliftVsStayPutPercent: number;
  firstMove: string;
  itinerary: ShiftStep[];
  policy: Array<{ time: string; decisions: Array<{ zone: string; action: string; value: number }> }>;
  zones: Array<{ name: string; coordinates: LatLng; demandAtStart: number }>;
  model: { method: string; states: number; actionsPerState: number; assumptions: string[] };
}

/**
 * ShiftPlannerService — plans a driver's next few hours as a finite-horizon
 * MDP over the city's demand zones.
 *
 *   state    (zone, hour)
 *   actions  wait in the zone, or reposition to another zone
 *   chance   whether a ride request arrives this hour (rises with zone
 *            demand) and where the rider wants to go (busier zones draw
 *            more trips) — the driver ends the hour wherever the trip ends
 *   reward   net earning of the trip (fare − fuel − commission), minus the
 *            fuel to reposition; repositioning also eats into the hour
 *
 * Zone-to-zone distances and travel times come from A* on the road graph
 * at that hour, so rush-hour congestion makes repositioning costlier.
 * Backward induction yields the optimal policy, which is then compared
 * with two myopic baselines: greedy (best expected reward this hour only)
 * and stay-put (never reposition).
 */
@Injectable({ deps: [DemandService, DriverService] })
export class ShiftPlannerService {
  constructor(
    private readonly demand: DemandService,
    private readonly driver: DriverService
  ) {}

  plan(input: ShiftPlanInput): ShiftPlan {
    const zones = this.demand.listZones();
    const zoneByKey = new Map(zones.map((z) => [z.zoneKey, z]));
    const hourAt = (t: number) => (input.startHour + t) % 24;

    const scores = new Map<number, Map<string, number>>();
    const scoreAt = (t: number) => {
      if (!scores.has(t)) scores.set(t, this.demand.zoneScores(hourAt(t), input.weekend));
      return scores.get(t)!;
    };

    const travelCache = new Map<string, { km: number; minutes: number }>();
    const travel = (from: DemandZoneProfile, to: DemandZoneProfile, hour: number) => {
      const key = `${from.zoneKey}|${to.zoneKey}|${hour}`;
      if (!travelCache.has(key)) travelCache.set(key, this.zoneTravel(from, to, hour));
      return travelCache.get(key)!;
    };

    const commission = this.driver.getCommissionRate(input.provider);
    const rate = TRIP_FARE[input.vehicleType];

    /**
     * What one working hour in `zone` is worth. Waiting time comes from
     * DemandService's demand→wait curve; each trip cycle is wait + pickup +
     * ride. Destinations follow a gravity model — weight = (demand + 15) ×
     * e^(−km / 6) — so most trips are short and busy zones attract more;
     * the destination of the hour's last trip is where the driver ends up.
     */
    const hourInZone = (zone: Zone, t: number, usableMinutes: number, extraCost: number) => {
      const scores = scoreAt(t);
      const origin = zoneByKey.get(zone)!;
      const legs = zones.map((d) => (d.zoneKey === zone ? { km: LOCAL_TRIP_KM, minutes: LOCAL_TRIP_MINUTES } : travel(origin, d, hourAt(t))));
      const weights = zones.map((d, i) => (scores.get(d.zoneKey)! + 15) * Math.exp(-legs[i].km / GRAVITY_KM));
      const total = weights.reduce((a, b) => a + b, 0);
      let expectedNet = 0;
      let expectedRideMinutes = 0;
      zones.forEach((d, i) => {
        const leg = legs[i];
        const fare = rate.base + rate.perKm * leg.km;
        const fuel = this.driver.getFuelCost(input.vehicleType, input.fuelType, leg.km + AVERAGE_PICKUP_KM).cost;
        expectedNet += (weights[i] / total) * (fare - fuel - fare * commission);
        expectedRideMinutes += (weights[i] / total) * leg.minutes;
      });
      const waitMinutes = this.demand.expectedWaitMinutes(scores.get(zone)!);
      const trips = usableMinutes / (waitMinutes + PICKUP_MINUTES + expectedRideMinutes);
      const reward = trips * expectedNet - extraCost;
      const pEndsElsewhere = Math.min(1, trips);
      const outcomes: Outcome<Zone>[] = zones.map((d, i) => ({ p: pEndsElsewhere * (weights[i] / total), next: d.zoneKey, reward }));
      outcomes.push({ p: 1 - pEndsElsewhere, next: zone, reward });
      return { outcomes, trips };
    };

    /** Waiting works the whole hour; repositioning first spends travel minutes and fuel. */
    const step = (zone: Zone, action: Action, t: number) => {
      if (action === 'wait') return hourInZone(zone, t, 60, 0);
      const target = action.slice('move:'.length);
      const leg = travel(zoneByKey.get(zone)!, zoneByKey.get(target)!, hourAt(t));
      const fuel = this.driver.getFuelCost(input.vehicleType, input.fuelType, leg.km).cost;
      return hourInZone(target, t, Math.max(0, 60 - leg.minutes), fuel);
    };

    const mdp: FiniteHorizonMdp<Zone, Action> = {
      states: zones.map((z) => z.zoneKey),
      horizon: input.hours,
      actions: (zone) => ['wait', ...zones.filter((z) => z.zoneKey !== zone).map((z) => `move:${z.zoneKey}`)],
      outcomes: (zone, action, t) => step(zone, action, t).outcomes,
    };

    const solution = solveByBackwardInduction(mdp);
    const immediate = (zone: Zone, action: Action, t: number) =>
      mdp.outcomes(zone, action, t).reduce((sum, o) => sum + o.p * o.reward, 0);
    const greedyValues = evaluatePolicy(mdp, (zone, t) =>
      mdp.actions(zone, t).reduce((best, a) => (immediate(zone, a, t) > immediate(zone, best, t) ? a : best))
    );
    const stayValues = evaluatePolicy(mdp, () => 'wait');

    const nearest = zones
      .map((z) => ({ z, km: haversineDistanceKm(input.currentLocation, z.coordinates) }))
      .sort((a, b) => a.km - b.km)[0];
    const start = nearest.z.zoneKey;

    const label = (zone: Zone, action: Action, t: number) => {
      if (action === 'wait') return `Wait for requests in ${zoneByKey.get(zone)!.displayName}`;
      const target = zoneByKey.get(action.slice('move:'.length))!;
      const leg = travel(zoneByKey.get(zone)!, target, hourAt(t));
      return `Reposition to ${target.displayName} (${leg.km} km, ~${leg.minutes} min)`;
    };

    // Most likely trajectory under the optimal policy: follow the most probable next zone.
    const itinerary: ShiftStep[] = [];
    let zone = start;
    for (let t = 0; t < input.hours; t++) {
      const action = solution.policy[t].get(zone)!;
      const outcomes = mdp.outcomes(zone, action, t);
      itinerary.push({
        time: formatHourLabel(hourAt(t)),
        zone: zoneByKey.get(zone)!.displayName,
        action: label(zone, action, t),
        expectedTrips: Math.round(step(zone, action, t).trips * 10) / 10,
        expectedEarningThisHour: Math.round(immediate(zone, action, t)),
      });
      const byNext = new Map<Zone, number>();
      for (const o of outcomes) byNext.set(o.next, (byNext.get(o.next) ?? 0) + o.p);
      zone = [...byNext.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }

    const optimal = solution.values[0].get(start)!;
    const greedy = greedyValues[0].get(start)!;
    const stayPut = stayValues[0].get(start)!;
    const uplift = (base: number) => (base > 0 ? Math.round(((optimal - base) / base) * 1000) / 10 : 0);

    return {
      startZone: nearest.z.displayName,
      snappedFromKm: Math.round(nearest.km * 10) / 10,
      startTime: formatHourLabel(input.startHour),
      hours: input.hours,
      expectedEarnings: { optimal: Math.round(optimal), greedy: Math.round(greedy), stayPut: Math.round(stayPut) },
      upliftVsGreedyPercent: uplift(greedy),
      upliftVsStayPutPercent: uplift(stayPut),
      firstMove: label(start, solution.policy[0].get(start)!, 0),
      itinerary,
      policy: solution.policy.map((decisions, t) => ({
        time: formatHourLabel(hourAt(t)),
        decisions: [...decisions.entries()].map(([z, a]) => ({
          zone: zoneByKey.get(z)!.displayName,
          action: a === 'wait' ? 'wait' : `→ ${zoneByKey.get(a.slice('move:'.length))!.displayName}`,
          value: Math.round(qValue(mdp, solution.values[t + 1], z, a, t)),
        })),
      })),
      zones: zones.map((z) => ({ name: z.displayName, coordinates: z.coordinates, demandAtStart: scoreAt(0).get(z.zoneKey)! })),
      model: {
        method: 'Finite-horizon MDP solved exactly by backward induction (Bellman optimality)',
        states: zones.length * input.hours,
        actionsPerState: zones.length,
        assumptions: [
          'One decision per hour. Trips per hour = usable minutes ÷ (wait + pickup + ride).',
          'Waiting time falls with zone demand on a convex curve (3 + 42·(1 − score/100)² minutes), shared with DemandService.',
          'Trip destinations follow a gravity model: weight ∝ (destination demand + 15) · e^(−km/6). The destination of the last trip is where the driver ends the hour.',
          'Repositioning burns fuel and its travel minutes are lost from the hour.',
        ],
      },
    };
  }

  /** Road distance and time between two zones via A* on the road graph; straight line × 1.3 if a zone is off-graph. */
  private zoneTravel(from: DemandZoneProfile, to: DemandZoneProfile, hour: number): { km: number; minutes: number } {
    const a = nearestNode(from.coordinates);
    const b = nearestNode(to.coordinates);
    if (a && b && a.node.id !== b.node.id) {
      const route = findRoute(a.node.id, b.node.id, { objective: 'time', hour });
      return { km: route.distanceKm, minutes: route.durationMinutes };
    }
    const km = Math.round(haversineDistanceKm(from.coordinates, to.coordinates) * 1.3 * 10) / 10;
    return { km: Math.max(1, km), minutes: Math.max(4, Math.round((km / 24) * 60)) };
  }
}
