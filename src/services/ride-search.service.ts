import { Injectable } from '@nitrostack/core';
import type { Logger } from '@nitrostack/core';
import { MapsService } from './maps.service.js';
import { PreferenceService } from './preference.service.js';
import { UberMockProvider } from '../providers/uber-mock.provider.js';
import { OlaMockProvider } from '../providers/ola-mock.provider.js';
import { RapidoHybridProvider } from '../providers/rapido-hybrid.provider.js';
import type { PreferenceSatisfaction, ResolvedLocation, RideOption, RiderPreferences, RideSearchContext } from '../domain/types.js';

export interface SearchOutcome {
  context: RideSearchContext;
  rawOptions: RideOption[];
  filteredOptions: RideOption[];
  satisfaction: PreferenceSatisfaction;
}

interface PreferenceConstraint {
  name: string;
  test: (option: RideOption) => boolean;
}

/**
 * RideSearchService
 *
 * Extracted from RidesTools so every feature that needs "resolve a route,
 * ask all three providers for options, apply preference filters" — not
 * just find_rides itself — can reuse the exact same logic instead of
 * re-implementing it. Used by RidesTools (find_rides, search_ride_options,
 * plan_return_trip) and the Phase 3 journey tools (travel_concierge,
 * ride_later_forecast, multi_stop_trip_planner, car_pooling_assistant,
 * booking_simulation).
 */
@Injectable({ deps: [MapsService, PreferenceService, UberMockProvider, OlaMockProvider, RapidoHybridProvider] })
export class RideSearchService {
  constructor(
    private readonly maps: MapsService,
    private readonly preferences: PreferenceService,
    private readonly uber: UberMockProvider,
    private readonly ola: OlaMockProvider,
    private readonly rapido: RapidoHybridProvider
  ) {}

  async buildSearchContext(
    originQuery: string,
    destinationQuery: string,
    preferencesOverride: RiderPreferences | undefined,
    logger?: Logger,
    hour?: number
  ): Promise<RideSearchContext> {
    const [origin, destination] = await Promise.all([
      this.maps.resolveLocation(originQuery, logger),
      this.maps.resolveLocation(destinationQuery, logger),
    ]);

    const route = await this.maps.calculateRoute(origin, destination, logger, hour);
    const preferences = this.preferences.merge(preferencesOverride);

    return { origin, destination, route, preferences };
  }

  async queryAllProviders(context: RideSearchContext, logger?: Logger): Promise<RideOption[]> {
    const results = await Promise.allSettled([
      this.uber.getRideOptions(context),
      this.ola.getRideOptions(context),
      this.rapido.getRideOptions(context, logger),
    ]);

    const options: RideOption[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        options.push(...result.value);
      } else {
        // A single provider failure must never break the overall comparison —
        // the app should not know or care whether data is live or simulated.
        logger?.warn('Provider query failed', {
          reason: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }
    return options;
  }

  applyPreferenceFilter(options: RideOption[], preferences: RiderPreferences): RideOption[] {
    return this.satisfyPreferences(options, preferences).options;
  }

  /**
   * Treats rider preferences as a small constraint-satisfaction problem
   * over the candidate rides. femaleDriverOnly is a HARD constraint — it is
   * a safety preference, so it is never silently dropped. The rest are SOFT
   * constraints ordered by priority; when no ride satisfies all of them,
   * the lowest-priority constraint is relaxed and the search retried, so
   * the rider loses as little of what they asked for as possible and is
   * told exactly what was relaxed.
   */
  satisfyPreferences(options: RideOption[], preferences: RiderPreferences): PreferenceSatisfaction {
    const hard: PreferenceConstraint[] = [];
    if (preferences.femaleDriverOnly) {
      hard.push({ name: 'femaleDriverOnly', test: (o) => o.hasFemaleDriverOption });
    }

    // Highest priority first; relaxation pops from the end.
    const soft: PreferenceConstraint[] = [];
    if (preferences.luggageRequired) {
      soft.push({ name: 'luggageRequired', test: (o) => o.luggageFriendly });
    }
    if (preferences.budgetLimit) {
      const limit = preferences.budgetLimit;
      soft.push({ name: 'budgetLimit', test: (o) => o.fare <= limit });
    }
    if (preferences.excludeVehicleTypes?.length) {
      const excluded = preferences.excludeVehicleTypes;
      soft.push({ name: 'excludeVehicleTypes', test: (o) => !excluded.includes(o.vehicleType) });
    }

    const hardOk = options.filter((o) => hard.every((c) => c.test(o)));
    if (hard.length > 0 && hardOk.length === 0) {
      return { options: [], satisfied: [], relaxed: [], unsatisfiableHard: hard[0].name };
    }

    const relaxed: string[] = [];
    for (;;) {
      const matches = hardOk.filter((o) => soft.every((c) => c.test(o)));
      if (matches.length > 0 || soft.length === 0) {
        return {
          options: matches,
          satisfied: [...hard, ...soft].map((c) => c.name),
          relaxed,
          unsatisfiableHard: null,
        };
      }
      relaxed.push(soft.pop()!.name);
    }
  }

  /**
   * Same pipeline as search(), but for when the origin/destination are
   * already resolved (e.g. multi-stop trip legs, where each stop was
   * geocoded once up front). Skips MapsService.resolveLocation entirely —
   * re-geocoding an already-resolved location by its formatted-address
   * string is both wasteful (extra Geoapify calls) and slightly risky
   * (a second lookup isn't guaranteed to land on the exact same
   * coordinates as the first).
   */
  async searchResolved(
    origin: ResolvedLocation,
    destination: ResolvedLocation,
    preferencesOverride: RiderPreferences | undefined,
    logger?: Logger
  ): Promise<SearchOutcome> {
    const route = await this.maps.calculateRoute(origin, destination, logger);
    const preferences = this.preferences.merge(preferencesOverride);
    const context: RideSearchContext = { origin, destination, route, preferences };
    return this.collect(context, logger);
  }

  /** Convenience: full pipeline — resolve route, query all providers, apply preference constraints. */
  async search(
    originQuery: string,
    destinationQuery: string,
    preferencesOverride: RiderPreferences | undefined,
    logger?: Logger,
    hour?: number
  ): Promise<SearchOutcome> {
    const context = await this.buildSearchContext(originQuery, destinationQuery, preferencesOverride, logger, hour);
    return this.collect(context, logger);
  }

  private async collect(context: RideSearchContext, logger?: Logger): Promise<SearchOutcome> {
    const rawOptions = await this.queryAllProviders(context, logger);
    const satisfaction = this.satisfyPreferences(rawOptions, context.preferences);
    return { context, rawOptions, filteredOptions: satisfaction.options, satisfaction };
  }
}
