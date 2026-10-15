import { Injectable } from '@nitrostack/core';
import type { Logger } from '@nitrostack/core';
import { RideSearchService } from '../../services/ride-search.service.js';
import { RankingService } from '../../services/ranking.service.js';
import { ForecastService } from '../../services/forecast.service.js';
import { MapsService } from '../../services/maps.service.js';
import { congestionFactor } from '../../ai/road-network.js';
import { formatDateTimeLabel, parseDateTimeLabel } from '../../services/time.util.js';
import type { TravelPlan } from '../../domain/types.js';

/** Destinations matching these keywords get a larger safety buffer (check-in, security, etc.). */
const HIGH_BUFFER_KEYWORDS: Array<{ pattern: RegExp; minutes: number; reason: string }> = [
  { pattern: /airport/i, minutes: 60, reason: 'Airports need extra time for check-in and security screening.' },
  { pattern: /railway|train station|junction/i, minutes: 20, reason: 'Trains depart on a fixed schedule, so a bit of extra buffer avoids missing it.' },
];

const DEFAULT_BUFFER_MINUTES = 15;
const DEFAULT_BUFFER_REASON = 'A general safety buffer for boarding, parking, or walking to the gate/entrance.';

@Injectable({ deps: [RideSearchService, RankingService, ForecastService, MapsService] })
export class ConciergeService {
  constructor(
    private readonly rideSearch: RideSearchService,
    private readonly ranking: RankingService,
    private readonly forecast: ForecastService,
    private readonly maps: MapsService
  ) {}

  async planTravel(
    originQuery: string,
    destinationQuery: string,
    arriveByRaw: string,
    bufferOverride: number | undefined,
    logger?: Logger
  ): Promise<TravelPlan> {
    const arriveBy = parseDateTimeLabel(arriveByRaw);

    const { context, filteredOptions } = await this.rideSearch.search(originQuery, destinationQuery, undefined, logger);

    const { minutes: autoBuffer, reason: bufferReason } = this.resolveBuffer(destinationQuery, context.destination.formattedAddress);
    const bufferMinutes = bufferOverride ?? autoBuffer;

    let route = context.route;
    let trafficMultiplier: number;
    let trafficAdjustedTravelMinutes: number;

    if (route.source === 'road_graph') {
      // Time-dependent planning: congestion depends on when the rider
      // leaves, and when they leave depends on the travel time. Iterate
      // A* to a fixed point — plan at the arrival hour, derive the
      // departure hour, re-plan at that hour (the best path can change,
      // e.g. bypass at rush hour, city roads at night).
      let departureHour = arriveBy.hour;
      for (let i = 0; i < 3; i++) {
        route = this.maps.estimateRoute(context.origin, context.destination, departureHour);
        const departure = new Date(arriveBy.date.getTime() - (route.durationMinutes + bufferMinutes) * 60 * 1000);
        if (departure.getHours() === departureHour) break;
        departureHour = departure.getHours();
      }
      trafficMultiplier = congestionFactor(departureHour);
      trafficAdjustedTravelMinutes = route.durationMinutes;
    } else {
      // No graph route: scale the straight-line / live estimate by the
      // rush-hour multiplier at the arrival hour.
      trafficMultiplier = this.forecast.getTrafficMultiplier(arriveBy.hour);
      trafficAdjustedTravelMinutes = Math.round(route.durationMinutes * trafficMultiplier);
    }

    const pickupDate = new Date(arriveBy.date.getTime() - (trafficAdjustedTravelMinutes + bufferMinutes) * 60 * 1000);
    const recommendedPickupLabel = formatDateTimeLabel(pickupDate, new Date());

    const ranked = this.ranking.rank(filteredOptions, 'best_value');
    const [recommendation, ...alternatives] = ranked;

    const recommendationReason = recommendation
      ? `${recommendation.providerName} ${recommendation.vehicleType} gives the best balance of reliability and travel time for this trip — ${recommendation.scoreReason}.`
      : 'No ride options were available for this route.';

    return {
      origin: context.origin,
      destination: context.destination,
      arriveByLabel: arriveBy.label,
      arriveByHour: arriveBy.hour,
      recommendedPickupLabel,
      bufferMinutes,
      bufferReason,
      trafficAdjustedTravelMinutes,
      trafficMultiplier,
      route,
      recommendation: recommendation ?? null,
      recommendationReason,
      alternatives: alternatives.slice(0, 3),
    };
  }

  private resolveBuffer(query: string, formattedAddress: string): { minutes: number; reason: string } {
    const haystack = `${query} ${formattedAddress}`;
    for (const { pattern, minutes, reason } of HIGH_BUFFER_KEYWORDS) {
      if (pattern.test(haystack)) {
        return { minutes, reason };
      }
    }
    return { minutes: DEFAULT_BUFFER_MINUTES, reason: DEFAULT_BUFFER_REASON };
  }
}
