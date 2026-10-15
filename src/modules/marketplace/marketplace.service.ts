import { Injectable } from '@nitrostack/core';
import type { Logger } from '@nitrostack/core';
import { MessageBus, type AgentRole } from '../../agents/acl.js';
import { RiderAgent } from '../../agents/rider.agent.js';
import { ProviderAgent, type TripOffer } from '../../agents/provider.agent.js';
import { DriverAgent, type DriverProfile, type TripEvaluator } from '../../agents/driver.agent.js';
import { RideSearchService } from '../../services/ride-search.service.js';
import { RankingService } from '../../services/ranking.service.js';
import { NearbyDriversService } from '../../services/nearby-drivers.service.js';
import { ProfitabilityService } from '../driver/profitability.service.js';
import { DemandService } from '../driver/demand.service.js';
import { RecommendationService } from '../driver/recommendation.service.js';
import { UberMockProvider } from '../../providers/uber-mock.provider.js';
import { OlaMockProvider } from '../../providers/ola-mock.provider.js';
import { RapidoHybridProvider } from '../../providers/rapido-hybrid.provider.js';
import { DRIVER_NAMES, createSeededRandom, hashString, haversineDistanceKm, pick, randomBetween } from '../../services/sim.util.js';
import { formatHourLabel, isWeekend } from '../../services/time.util.js';
import type {
  DriverTripInput,
  FuelType,
  ProviderId,
  RankedRideOption,
  RideOption,
  RideSearchContext,
  RouteInfo,
  RiderPreferences,
  ResolvedLocation,
  VehicleType,
} from '../../domain/types.js';

const FUEL_BY_VEHICLE: Record<VehicleType, FuelType[]> = {
  bike: ['petrol', 'petrol', 'electric'],
  auto: ['cng', 'cng', 'electric', 'diesel'],
  mini: ['cng', 'petrol', 'electric'],
  sedan: ['diesel', 'cng', 'petrol'],
  suv: ['diesel'],
};

/** Market parameters. Tuned so the default scene has both accepting and refusing drivers. */
const MARKET = {
  fleetRadiusKm: 4,
  driversPerProvider: 8,
  dispatchRadiusKm: 4,
  offersPerRound: 3,
  maxRounds: 2,
  incentiveRate: 0.15,
  reservationHourly: [160, 420] as [number, number],
};

export interface MarketplaceOptions {
  hour?: number;
  weekend?: boolean;
  /** Same seed → same fleet, same latencies, same trace. */
  seed?: string;
  preferredOptionId?: string;
  maxAwards?: number;
  /** Offer rounds per award (1 = no incentive re-offer). */
  maxRounds?: number;
  logger?: Logger;
}

export interface MarketplaceResult {
  protocol: string;
  origin: ResolvedLocation;
  destination: ResolvedLocation;
  route: RouteInfo;
  time: string;
  outcome: {
    status: 'MATCHED' | 'NO_MATCH';
    option: RankedRideOption | null;
    driver: (Pick<DriverProfile, 'id' | 'name' | 'rating' | 'vehicleType' | 'fuelType' | 'provider'>) | null;
    pickupEtaMinutes: number | null;
    incentive: number;
    reason: string;
    relaxedConstraints: string[];
  };
  participants: Array<{ id: string; role: AgentRole; label: string }>;
  messages: Array<{ id: number; t: number; from: string; to: string; performative: string; conversationId: string; summary: string }>;
  metrics: {
    messageCount: number;
    fleetSize: number;
    providersQueried: number;
    proposals: number;
    refusals: number;
    awards: number;
    driverOffers: number;
    driverAcceptances: number;
    driverAcceptanceRate: number;
    incentiveRounds: number;
    timeToOutcomeSeconds: number;
  };
}

/**
 * MarketplaceService — builds and runs the multi-agent ride market.
 *
 * Society: one RiderAgent, one ProviderAgent per platform, and a fleet of
 * DriverAgents per platform scattered around the pickup point. They
 * negotiate through two nested FIPA Contract Nets on a discrete-event
 * message bus (see agents/). The service only assembles the society and
 * reads the outcome — every decision is made inside an agent.
 */
@Injectable({
  deps: [
    RideSearchService,
    RankingService,
    NearbyDriversService,
    ProfitabilityService,
    DemandService,
    RecommendationService,
    UberMockProvider,
    OlaMockProvider,
    RapidoHybridProvider,
  ],
})
export class MarketplaceService {
  private readonly adapters: Record<ProviderId, { providerName: string; getRideOptions(ctx: RideSearchContext, logger?: Logger): Promise<RideOption[]> }>;

  constructor(
    private readonly rideSearch: RideSearchService,
    private readonly ranking: RankingService,
    private readonly nearbyDrivers: NearbyDriversService,
    private readonly profitability: ProfitabilityService,
    private readonly demand: DemandService,
    private readonly recommendation: RecommendationService,
    uber: UberMockProvider,
    ola: OlaMockProvider,
    rapido: RapidoHybridProvider
  ) {
    this.adapters = { uber, ola, rapido };
  }

  async simulate(
    origin: string,
    destination: string,
    preferences: RiderPreferences | undefined,
    options: MarketplaceOptions = {}
  ): Promise<MarketplaceResult> {
    const hour = options.hour ?? new Date().getHours();
    const context = await this.rideSearch.buildSearchContext(origin, destination, preferences, options.logger, hour);
    return this.run(context, { ...options, hour });
  }

  async run(context: RideSearchContext, options: MarketplaceOptions = {}): Promise<MarketplaceResult> {
    const hour = options.hour ?? new Date().getHours();
    const weekend = options.weekend ?? isWeekend();
    const seed = options.seed ?? `${context.origin.formattedAddress}|${context.destination.formattedAddress}|${hour}`;
    const rng = createSeededRandom(hashString(seed));
    const latency = (min: number, max: number) => Math.round(randomBetween(rng, min, max) * 100) / 100;

    const bus = new MessageBus();
    const fleet = this.buildFleet(context, seed);
    const evaluate = this.driverEvaluator(weekend);

    const drivers = fleet.map((profile) => new DriverAgent(profile, evaluate, latency));
    const providers = (Object.keys(this.adapters) as ProviderId[]).map(
      (providerId) =>
        new ProviderAgent({
          providerId,
          providerName: this.adapters[providerId].providerName,
          quote: () => this.adapters[providerId].getRideOptions(context, options.logger),
          fleet: fleet.filter((d) => d.provider === providerId),
          pickup: context.origin.coordinates,
          destination: context.destination,
          tripDistanceKm: context.route.distanceKm,
          hour,
          dispatchRadiusKm: MARKET.dispatchRadiusKm,
          offersPerRound: MARKET.offersPerRound,
          maxRounds: options.maxRounds ?? MARKET.maxRounds,
          incentiveRate: MARKET.incentiveRate,
          latency,
        })
    );
    const rider = new RiderAgent({
      id: 'rider:you',
      providerAgentIds: providers.map((p) => p.id),
      context,
      satisfy: (opts) => this.rideSearch.satisfyPreferences(opts, context.preferences),
      rank: (opts) => this.ranking.rank(opts, 'best_value'),
      preferredOptionId: options.preferredOptionId,
      maxAwards: options.maxAwards ?? 3,
      latency,
    });

    bus.register(rider, ...providers, ...drivers);
    rider.start(bus);
    const log = await bus.run();

    const outcome = rider.outcome;
    const count = (p: string, fromRole?: string) =>
      log.filter((m) => m.performative === p && (!fromRole || m.from.startsWith(fromRole))).length;
    const driverOffers = log.filter((m) => m.performative === 'CFP' && m.to.startsWith('driver:')).length;
    const driverAcceptances = count('PROPOSE', 'driver:');
    const contacted = new Set(log.filter((m) => m.to.startsWith('driver:')).map((m) => m.to));
    const labelOf = (id: string) => {
      if (id === rider.id) return 'Rider (you)';
      if (id.startsWith('provider:')) return this.adapters[id.slice('provider:'.length) as ProviderId].providerName;
      const d = fleet.find((f) => f.id === id)!;
      return `${d.name} · ${d.vehicleType} (${d.fuelType})`;
    };

    return {
      protocol: 'FIPA Contract Net, nested: rider ⇄ providers, provider ⇄ drivers',
      origin: context.origin,
      destination: context.destination,
      route: context.route,
      time: formatHourLabel(hour),
      outcome: {
        status: outcome.status === 'MATCHED' ? 'MATCHED' : 'NO_MATCH',
        option: outcome.status === 'MATCHED' ? outcome.option : null,
        driver:
          outcome.status === 'MATCHED'
            ? (({ id, name, rating, vehicleType, fuelType, provider }) => ({ id, name, rating, vehicleType, fuelType, provider }))(outcome.assignment.driver)
            : null,
        pickupEtaMinutes: outcome.status === 'MATCHED' ? outcome.assignment.pickupEtaMinutes : null,
        incentive: outcome.status === 'MATCHED' ? outcome.assignment.incentive : 0,
        reason:
          outcome.status === 'MATCHED'
            ? `${outcome.option.providerName} ${outcome.option.vehicleType} won the rider's contract${outcome.awards > 1 ? ` on award #${outcome.awards}` : ''}; ${outcome.assignment.driver.name} accepted ${outcome.assignment.round > 1 ? 'after an incentive was added' : 'the first offer round'}.`
            : outcome.status === 'NO_MATCH'
              ? outcome.reason
              : 'Protocol ended without an outcome.',
        relaxedConstraints: rider.relaxedConstraints,
      },
      participants: [rider.id, ...providers.map((p) => p.id), ...contacted].map((id) => ({
        id,
        role: id.split(':')[0] as AgentRole,
        label: labelOf(id),
      })),
      messages: log.map(({ id, t, from, to, performative, conversationId, summary }) => ({ id, t, from, to, performative, conversationId, summary })),
      metrics: {
        messageCount: log.length,
        fleetSize: fleet.length,
        providersQueried: providers.length,
        proposals: count('PROPOSE', 'provider:'),
        refusals: count('REFUSE', 'provider:'),
        awards: count('ACCEPT_PROPOSAL', 'rider:'),
        driverOffers,
        driverAcceptances,
        driverAcceptanceRate: driverOffers > 0 ? Math.round((driverAcceptances / driverOffers) * 100) / 100 : 0,
        incentiveRounds: new Set(log.filter((m) => m.conversationId.match(/-r[2-9]$/)).map((m) => m.conversationId)).size,
        timeToOutcomeSeconds: Math.round((log.at(-1)?.t ?? 0) * 10) / 10,
      },
    };
  }

  private buildFleet(context: RideSearchContext, seed: string): DriverProfile[] {
    return this.nearbyDrivers
      .generate(context.origin.coordinates, `${seed}|fleet`, MARKET.fleetRadiusKm, { epoch: 0, perProvider: MARKET.driversPerProvider })
      .map((d) => {
        const rng = createSeededRandom(hashString(`${seed}|${d.driverId}`));
        return {
          id: `driver:${d.driverId}`,
          name: pick(rng, DRIVER_NAMES),
          provider: d.provider,
          vehicleType: d.vehicleType,
          fuelType: pick(rng, FUEL_BY_VEHICLE[d.vehicleType]),
          coordinates: d.coordinates,
          rating: d.rating,
          reservationHourly: Math.round(randomBetween(rng, ...MARKET.reservationHourly) / 10) * 10,
        };
      });
  }

  /** The driver agents' shared world model: the same profitability, demand, and recommendation engines as analyse_driver_trip. */
  private driverEvaluator(weekend: boolean): TripEvaluator {
    return (offer: TripOffer, driver: DriverProfile) => {
      const pickupDistanceKm = Math.round(haversineDistanceKm(driver.coordinates, offer.pickup) * 1.3 * 10) / 10;
      const input: DriverTripInput = {
        provider: offer.provider,
        offeredFare: offer.fare + offer.incentive,
        tripDistance: offer.tripDistanceKm,
        pickupDistance: pickupDistanceKm,
        vehicleType: driver.vehicleType,
        fuelType: driver.fuelType,
        currentLocation: `${driver.coordinates.lat},${driver.coordinates.lng}`,
        destination: offer.destination.formattedAddress,
      };
      const breakdown = this.profitability.analyzeTrip(input);
      const demand = this.demand.getDemandForLocation(offer.destination, offer.hour, weekend, formatHourLabel(offer.hour));
      const { recommendation, reason } = this.recommendation.recommendTripAcceptance(input, breakdown, demand);
      return {
        pickupDistanceKm,
        pickupEtaMinutes: Math.max(1, Math.round((pickupDistanceKm / 24) * 60)),
        netEarning: breakdown.netEarning,
        hourlyEarning: breakdown.estimatedHourlyEarning,
        recommendation,
        reason,
      };
    };
  }
}
