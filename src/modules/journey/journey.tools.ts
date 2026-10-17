import { ToolDecorator as Tool, Widget, ExecutionContext, Injectable } from '@nitrostack/core';
import { ConciergeService } from './concierge.service.js';
import { MultiStopService } from './multi-stop.service.js';
import { PoolingService } from './pooling.service.js';
import { BookingService } from './booking.service.js';
import { SafetyService } from './safety.service.js';
import { RideSearchService } from '../../services/ride-search.service.js';
import { RankingService } from '../../services/ranking.service.js';
import { ForecastService } from '../../services/forecast.service.js';
import { SearchStoreService } from '../../services/search-store.service.js';
import { MarketplaceService } from '../marketplace/marketplace.service.js';
import { formatHourLabel, parseDateTimeLabel } from '../../services/time.util.js';
import {
  travelConciergeSchema,
  rideLaterForecastSchema,
  multiStopTripPlannerSchema,
  carPoolingAssistantSchema,
  bookingSimulationSchema,
  sosEmergencySchema,
} from './journey.schemas.js';

@Injectable({
  deps: [
    ConciergeService,
    MultiStopService,
    PoolingService,
    BookingService,
    SafetyService,
    RideSearchService,
    RankingService,
    ForecastService,
    SearchStoreService,
    MarketplaceService,
  ],
})
export class JourneyTools {
  constructor(
    private readonly concierge: ConciergeService,
    private readonly multiStop: MultiStopService,
    private readonly pooling: PoolingService,
    private readonly booking: BookingService,
    private readonly safety: SafetyService,
    private readonly rideSearch: RideSearchService,
    private readonly ranking: RankingService,
    private readonly forecast: ForecastService,
    private readonly searchStore: SearchStoreService,
    private readonly marketplace: MarketplaceService
  ) {}

  // ------------------------------------------------------------------
  // travel_concierge — HIGHEST PRIORITY: understand a full journey goal
  // ------------------------------------------------------------------
  @Tool({
    name: 'travel_concierge',
    description:
      'Plan a complete journey around a deadline (e.g. a flight or train): recommends when to leave, accounting for traffic and a safety buffer, and picks the best ride.',
    inputSchema: travelConciergeSchema,
    examples: {
      request: { origin: 'Amrita University', destination: 'Coimbatore Airport', arriveBy: '8 AM tomorrow' },
    },
  })
  @Widget('travel-plan')
  async travelConcierge(input: { origin: string; destination: string; arriveBy: string; bufferMinutes?: number }, ctx: ExecutionContext) {
    ctx.logger.info('travel_concierge', { origin: input.origin, destination: input.destination, arriveBy: input.arriveBy });
    return this.concierge.planTravel(input.origin, input.destination, input.arriveBy, input.bufferMinutes, ctx.logger);
  }

  // ------------------------------------------------------------------
  // ride_later_forecast — future fare estimation for a fresh trip
  // ------------------------------------------------------------------
  @Tool({
    name: 'ride_later_forecast',
    description: 'Estimate the fare, demand multiplier, and availability for a ride at a future time, e.g. "I need a ride tomorrow at 7 AM."',
    inputSchema: rideLaterForecastSchema,
    examples: {
      request: { origin: 'Amrita University', destination: 'Coimbatore Airport', time: 'tomorrow 7 AM' },
    },
  })
  @Widget('fare-forecast')
  async rideLaterForecast(input: { origin: string; destination: string; time: string }, ctx: ExecutionContext) {
    const { context, filteredOptions } = await this.rideSearch.search(input.origin, input.destination, undefined, ctx.logger);
    const ranked = this.ranking.rank(filteredOptions, 'best_value');
    const currentFare = ranked[0]?.fare ?? null;

    const target = parseDateTimeLabel(input.time);
    const forecastResult = this.forecast.forecast(formatHourLabel(target.hour));

    const forecastFareLow = currentFare !== null ? Math.round((currentFare * forecastResult.forecastMultiplier * 0.95) / 5) * 5 : null;
    const forecastFareHigh = currentFare !== null ? Math.round((currentFare * forecastResult.forecastMultiplier * 1.08) / 5) * 5 : null;

    const expectedAvailability: 'PLENTY' | 'MODERATE' | 'SCARCE' =
      forecastResult.demandLevel === 'peak' ? 'SCARCE' : forecastResult.demandLevel === 'high' ? 'MODERATE' : 'PLENTY';

    const destinationHint = /airport/i.test(context.destination.formattedAddress) ? ' Airport demand is expected around this time.' : '';

    return {
      origin: context.origin,
      destination: context.destination,
      targetTimeLabel: `${target.label}`,
      currentFare,
      forecastFareLow,
      forecastFareHigh,
      demandMultiplier: forecastResult.forecastMultiplier,
      targetHour: target.hour,
      hourlyCurve: this.forecast.dayCurve(),
      expectedAvailability,
      reason: `${forecastResult.explanation}${destinationHint}`,
      disclaimer: 'This is a heuristic time-of-day estimate, not a guaranteed fare.',
    };
  }

  // ------------------------------------------------------------------
  // multi_stop_trip_planner
  // ------------------------------------------------------------------
  @Tool({
    name: 'multi_stop_trip_planner',
    description:
      'Plan a trip with one or more intermediate stops, e.g. "campus to airport, stopping at Gandhipuram" — totals distance, time, and fare. With optimizeOrder, A* search finds the fastest order to visit the intermediate stops.',
    inputSchema: multiStopTripPlannerSchema,
    examples: {
      request: { stops: ['Amrita University Ettimadai', 'Coimbatore Airport', 'Gandhipuram', 'RS Puram', 'Coimbatore Junction'], optimizeOrder: true },
    },
  })
  @Widget('ride-map')
  async multiStopTripPlanner(input: { stops: string[]; optimizeOrder?: boolean }, ctx: ExecutionContext) {
    ctx.logger.info('multi_stop_trip_planner', { stopCount: input.stops.length, optimizeOrder: input.optimizeOrder });
    return this.multiStop.planTrip(input.stops, input.optimizeOrder ?? false, ctx.logger);
  }

  // ------------------------------------------------------------------
  // car_pooling_assistant
  // ------------------------------------------------------------------
  @Tool({
    name: 'car_pooling_assistant',
    description: 'Simulate matching with a nearby rider on a similar route and recommend whether to pool, e.g. "Can I share this ride?"',
    inputSchema: carPoolingAssistantSchema,
    examples: {
      request: { origin: 'Amrita University Ettimadai', destination: 'Coimbatore Airport' },
    },
  })
  @Widget('pooling-analysis')
  async carPoolingAssistant(input: { origin: string; destination: string; maxExtraMinutes?: number }, ctx: ExecutionContext) {
    return this.pooling.analyzePooling(input.origin, input.destination, input.maxExtraMinutes, ctx.logger);
  }

  // ------------------------------------------------------------------
  // sos_emergency — SIMULATION ONLY
  // ------------------------------------------------------------------
  @Tool({
    name: 'sos_emergency',
    description:
      'SIMULATED emergency SOS — shares the rider\'s current location and (if provided) active trip details with simulated emergency contacts. Does NOT contact real emergency services; direct the user to call their local emergency number for real danger.',
    inputSchema: sosEmergencySchema,
    examples: {
      request: { currentLocation: 'Coimbatore Airport Road' },
    },
  })
  @Widget('safety-alert')
  async sosEmergency(input: { currentLocation: string; bookingId?: string; note?: string }, ctx: ExecutionContext) {
    ctx.logger.warn('sos_emergency triggered (simulated)', { currentLocation: input.currentLocation });
    return this.safety.triggerSos(input.currentLocation, input.bookingId, input.note, ctx.logger);
  }

  // ------------------------------------------------------------------
  // booking_simulation — never books without explicit confirmation
  // ------------------------------------------------------------------
  @Tool({
    name: 'booking_simulation',
    description:
      'Simulates the ride booking lifecycle (Searching → Driver Assigned → Driver Arriving → Trip Started → Completed). Requires searchId + optionId + confirmed:true to actually create a booking — otherwise returns a confirmation preview only. Call again with the returned bookingId to advance the lifecycle.',
    inputSchema: bookingSimulationSchema,
    examples: {
      request: { searchId: 'example-search-id', optionId: 'example-option-id', confirmed: false },
    },
  })
  @Widget('booking-status')
  async bookingSimulation(
    input: { searchId?: string; optionId?: string; bookingId?: string; confirmed?: boolean },
    ctx: ExecutionContext
  ) {
    // Advance/check an existing booking.
    if (input.bookingId) {
      const booking = this.booking.advanceBooking(input.bookingId);
      if (!booking) {
        throw new Error(`No active booking found for bookingId "${input.bookingId}".`);
      }
      return booking;
    }

    if (!input.searchId || !input.optionId) {
      throw new Error('Provide either an existing bookingId, or a searchId + optionId to start a new booking.');
    }

    const search = this.searchStore.get(input.searchId);
    if (!search) {
      throw new Error(`No active search found for searchId "${input.searchId}". Please run find_rides again.`);
    }
    const option = search.options.find((o) => o.optionId === input.optionId);
    if (!option) {
      throw new Error(`No ride option "${input.optionId}" found in this search.`);
    }

    // Never create a booking without explicit confirmation.
    if (!input.confirmed) {
      return {
        status: 'PENDING_CONFIRMATION' as const,
        message: `Please confirm booking: ${option.providerName} ${option.vehicleType} for ₹${option.fare}, from ${search.origin.formattedAddress} to ${search.destination.formattedAddress}. Call booking_simulation again with confirmed: true to book.`,
        rideSummary: {
          provider: option.provider,
          providerName: option.providerName,
          vehicleType: option.vehicleType,
          fare: option.fare,
          origin: search.origin.formattedAddress,
          destination: search.destination.formattedAddress,
        },
      };
    }

    // Dispatch through the multi-agent marketplace: the chosen provider
    // offers the trip to its nearby driver agents and only a driver who
    // actually accepts is assigned. maxAwards: 1 — the rider confirmed THIS
    // ride, so the rider agent must not silently switch to another one.
    const dispatch = await this.marketplace.run(
      { origin: search.origin, destination: search.destination, route: search.route, preferences: search.preferences },
      { preferredOptionId: option.optionId, maxAwards: 1, seed: `${input.searchId}|${option.optionId}`, logger: ctx.logger }
    );
    const dispatchSummary = {
      messagesExchanged: dispatch.metrics.messageCount,
      driversContacted: dispatch.metrics.driverOffers,
      driverAcceptances: dispatch.metrics.driverAcceptances,
      incentiveRounds: dispatch.metrics.incentiveRounds,
      trace: dispatch.messages.filter((m) => m.from.startsWith('driver:') || m.to.startsWith('driver:')).map((m) => `${m.performative} ${m.from} → ${m.to}: ${m.summary}`),
    };

    if (dispatch.outcome.status !== 'MATCHED' || !dispatch.outcome.driver) {
      return {
        status: 'CANCELLED' as const,
        message: `No driver accepted this ${option.providerName} ${option.vehicleType} trip: ${dispatch.outcome.reason} Try another option from the same search.`,
        rideSummary: { provider: option.provider, providerName: option.providerName, vehicleType: option.vehicleType, fare: option.fare },
        dispatch: dispatchSummary,
      };
    }

    // The confirmed booking is a revealed preference — the rider agent learns from it.
    const learning = this.ranking.learnFromChoice(option, search.options);

    const rankedOption = this.ranking.rank([option], search.rankingMode)[0];
    const created = this.booking.createBooking(input.searchId, input.optionId, rankedOption, search.origin, search.destination, {
      driverName: dispatch.outcome.driver.name,
      rating: dispatch.outcome.driver.rating,
      etaMinutes: dispatch.outcome.pickupEtaMinutes ?? 5,
    });
    ctx.logger.info('Booking confirmed', { bookingId: created.bookingId, status: created.status, driver: dispatch.outcome.driver.name });
    return { ...created, dispatch: dispatchSummary, learning };
  }
}
