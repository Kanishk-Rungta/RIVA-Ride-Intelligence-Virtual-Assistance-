import { Injectable } from '@nitrostack/core';
import type { Logger } from '@nitrostack/core';
import { MapsService } from '../../services/maps.service.js';
import { RideSearchService } from '../../services/ride-search.service.js';
import { RankingService } from '../../services/ranking.service.js';
import { optimizeStopOrder } from '../../ai/tour.js';
import type { MultiStopLeg, MultiStopPlan, ResolvedLocation } from '../../domain/types.js';

@Injectable({ deps: [MapsService, RideSearchService, RankingService] })
export class MultiStopService {
  constructor(
    private readonly maps: MapsService,
    private readonly rideSearch: RideSearchService,
    private readonly ranking: RankingService
  ) {}

  async planTrip(stopQueries: string[], optimizeOrder: boolean, logger?: Logger, hour: number = new Date().getHours()): Promise<MultiStopPlan> {
    const resolved = await Promise.all(stopQueries.map((q) => this.maps.resolveLocation(q, logger)));

    // Order the intermediate stops before pricing anything. The cost matrix
    // uses the offline travel-time estimate (A* on the road graph where
    // possible) for every pair, so ordering never costs n² live API calls;
    // only the legs of the chosen order are routed and priced below.
    let stops = resolved;
    let optimization: MultiStopPlan['optimization'];
    if (optimizeOrder && resolved.length > 3) {
      const cost = resolved.map((a) => resolved.map((b) => (a === b ? 0 : this.maps.estimateRoute(a, b, hour).durationMinutes)));
      const tour = optimizeStopOrder(cost);
      stops = tour.order.map((i) => resolved[i]);
      optimization = {
        algorithm: 'A* over (current stop, visited-set) states',
        originalOrder: resolved.map((s) => s.formattedAddress),
        optimizedOrder: stops.map((s) => s.formattedAddress),
        originalEstimateMinutes: Math.round(tour.givenOrderCost),
        optimizedEstimateMinutes: Math.round(tour.cost),
        savedMinutes: Math.round(tour.savedCost),
        statesExpanded: tour.statesExpanded,
      };
    }

    // Each leg's route/fare search is independent of the others, so run
    // them all in parallel. Locations are already resolved above, so
    // searchResolved() skips re-geocoding entirely.
    const legResults = await Promise.all(
      stops.slice(0, -1).map(async (from: ResolvedLocation, i) => {
        const to = stops[i + 1];
        const { context, filteredOptions } = await this.rideSearch.searchResolved(from, to, undefined, logger);
        const ranked = this.ranking.rank(filteredOptions, 'best_value');

        const leg: MultiStopLeg = {
          from: from.formattedAddress,
          to: to.formattedAddress,
          distanceKm: context.route.distanceKm,
          durationMinutes: Math.round(context.route.durationMinutes),
          fare: ranked[0]?.fare ?? 0,
        };
        return { leg, distanceKm: context.route.distanceKm, durationMinutes: context.route.durationMinutes };
      })
    );

    const legs = legResults.map((r) => r.leg);
    const totalDistanceKm = legResults.reduce((sum, r) => sum + r.distanceKm, 0);
    const totalDurationMinutes = legResults.reduce((sum, r) => sum + r.durationMinutes, 0);
    const estimatedFare = legs.reduce((sum, leg) => sum + leg.fare, 0);

    return {
      stops,
      legs,
      totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
      totalDurationMinutes: Math.round(totalDurationMinutes),
      estimatedFare: Math.round(estimatedFare),
      routeDisplay: stops.map((s) => s.formattedAddress).join(' → '),
      optimization,
    };
  }
}
