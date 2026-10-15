import type { Agent, AclMessage, MessageBus } from './acl.js';
import type { LatLng, ProviderId, ResolvedLocation, RideOption } from '../domain/types.js';
import type { DriverProfile } from './driver.agent.js';
import { haversineDistanceKm } from '../services/sim.util.js';

/** What a provider offers a driver: the trip, plus any platform-funded incentive. */
export interface TripOffer {
  optionId: string;
  provider: ProviderId;
  fare: number;
  incentive: number;
  pickup: LatLng;
  tripDistanceKm: number;
  destination: ResolvedLocation;
  hour: number;
}

export interface DriverReply {
  driverId: string;
  pickupDistanceKm: number;
  pickupEtaMinutes: number;
  netEarning: number;
  hourlyEarning: number;
  recommendation: 'ACCEPT' | 'CONSIDER' | 'REJECT';
  reason: string;
}

export interface DriverOfferAccepted {
  optionId: string;
  driver: DriverProfile;
  pickupEtaMinutes: number;
  fare: number;
  incentive: number;
  round: number;
}

export interface ProviderAgentConfig {
  providerId: ProviderId;
  providerName: string;
  quote: () => Promise<RideOption[]>;
  fleet: DriverProfile[];
  pickup: LatLng;
  destination: ResolvedLocation;
  tripDistanceKm: number;
  hour: number;
  /** Drivers further than this from the pickup are not offered the trip. */
  dispatchRadiusKm: number;
  /** Drivers contacted per round, nearest first. */
  offersPerRound: number;
  /** Rounds of offers; every round after the first adds a platform-funded incentive. */
  maxRounds: number;
  incentiveRate: number;
  latency: (min: number, max: number) => number;
}

/**
 * ProviderAgent — Uber, Ola, or Rapido.
 *
 * Plays two roles in two nested Contract Nets:
 *   1. CONTRACTOR to the rider: answers the rider's call for proposals with
 *      its fare quote (PROPOSE) or REFUSE when it has nothing available.
 *   2. MANAGER to its drivers: once awarded, it runs its own call for
 *      proposals to the nearest matching drivers, assigns the trip to the
 *      closest driver who accepts, and INFORMs the rider. If every driver
 *      refuses, it re-offers with a surge incentive; if that fails too, it
 *      reports FAILURE so the rider can re-award elsewhere.
 */
export class ProviderAgent implements Agent {
  readonly role = 'provider' as const;
  readonly id: string;

  private quoted: RideOption[] = [];
  private awarded: RideOption | null = null;
  private riderId = '';
  private riderConversation = '';
  private round = 0;
  private incentive = 0;
  private dispatchConversation = '';
  private offered: string[] = [];
  private acceptances: DriverReply[] = [];
  private repliesThisRound = 0;

  constructor(private readonly config: ProviderAgentConfig) {
    this.id = `provider:${config.providerId}`;
  }

  async receive(message: AclMessage, bus: MessageBus): Promise<void> {
    if (message.from.startsWith('rider:')) return this.fromRider(message, bus);
    return this.fromDriver(message, bus);
  }

  private async fromRider(message: AclMessage, bus: MessageBus): Promise<void> {
    this.riderId = message.from;
    this.riderConversation = message.conversationId;

    if (message.performative === 'CFP') {
      this.quoted = (await this.config.quote()).filter((o) => o.availability);
      const reply = this.quoted.length > 0
        ? {
            performative: 'PROPOSE' as const,
            content: { options: this.quoted },
            summary: `Bid: ${this.quoted.length} options from ₹${Math.min(...this.quoted.map((o) => o.fare))}`,
          }
        : { performative: 'REFUSE' as const, content: { reason: 'No vehicles available' }, summary: 'No vehicles available right now' };
      bus.send<unknown>(
        { from: this.id, to: message.from, conversationId: message.conversationId, ...reply },
        this.config.latency(0.4, 1.4) // pricing engine latency
      );
      return;
    }

    if (message.performative === 'ACCEPT_PROPOSAL') {
      const { optionId } = message.content as { optionId: string };
      this.awarded = this.quoted.find((o) => o.optionId === optionId) ?? null;
      this.round = 0;
      if (!this.awarded) {
        this.fail(bus, `Option ${optionId} is no longer offered`);
        return;
      }
      this.startRound(bus);
    }
    // REJECT_PROPOSAL needs no action — the bid simply lapses.
  }

  private startRound(bus: MessageBus): void {
    const option = this.awarded!;
    this.round++;
    this.acceptances = [];
    this.repliesThisRound = 0;

    const candidates = this.config.fleet
      .filter((d) => d.vehicleType === option.vehicleType)
      .map((d) => ({ d, km: haversineDistanceKm(d.coordinates, this.config.pickup) }))
      .filter(({ km }) => km <= this.config.dispatchRadiusKm)
      .sort((a, b) => a.km - b.km)
      .slice(0, this.config.offersPerRound);

    if (candidates.length === 0) {
      this.fail(bus, `No ${option.providerName} ${option.vehicleType} drivers within ${this.config.dispatchRadiusKm} km`);
      return;
    }

    const incentive = this.round === 1 ? 0 : Math.round((option.fare * this.config.incentiveRate * (this.round - 1)) / 5) * 5;
    this.incentive = incentive;
    this.dispatchConversation = `dispatch-${option.optionId}-r${this.round}`;
    const offer: TripOffer = {
      optionId: option.optionId,
      provider: this.config.providerId,
      fare: option.fare,
      incentive,
      pickup: this.config.pickup,
      tripDistanceKm: option.distanceKm,
      destination: this.config.destination,
      hour: this.config.hour,
    };

    this.offered = candidates.map(({ d }) => d.id);
    for (const { d } of candidates) {
      bus.send(
        {
          from: this.id,
          to: d.id,
          performative: 'CFP',
          conversationId: this.dispatchConversation,
          content: offer,
          summary: `Trip offer: ₹${option.fare}${incentive ? ` + ₹${incentive} incentive` : ''}, ${option.distanceKm} km to ${this.config.destination.formattedAddress}`,
        },
        this.config.latency(0.2, 0.4)
      );
    }
  }

  private fromDriver(message: AclMessage, bus: MessageBus): void {
    if (message.performative !== 'PROPOSE' && message.performative !== 'REFUSE') return;
    if (message.conversationId !== this.dispatchConversation || !this.offered.includes(message.from)) return;

    this.repliesThisRound++;
    if (message.performative === 'PROPOSE') this.acceptances.push(message.content as DriverReply);
    if (this.repliesThisRound < this.offered.length) return;

    if (this.acceptances.length === 0) {
      if (this.round < this.config.maxRounds) this.startRound(bus);
      else this.fail(bus, `All ${this.offered.length} nearby ${this.awarded!.vehicleType} drivers declined${this.round > 1 ? ', even with an incentive' : ''}`);
      return;
    }

    // Assign the trip to the accepting driver who can reach the rider soonest.
    this.acceptances.sort((a, b) => a.pickupEtaMinutes - b.pickupEtaMinutes);
    const [chosen, ...others] = this.acceptances;
    const conversationId = message.conversationId;

    bus.send(
      { from: this.id, to: chosen.driverId, performative: 'ACCEPT_PROPOSAL', conversationId, content: {}, summary: `Trip assigned — pickup in ${chosen.pickupEtaMinutes} min` },
      this.config.latency(0.1, 0.3)
    );
    for (const other of others) {
      bus.send(
        { from: this.id, to: other.driverId, performative: 'REJECT_PROPOSAL', conversationId, content: {}, summary: 'Trip went to a closer driver' },
        this.config.latency(0.1, 0.3)
      );
    }

    const driver = this.config.fleet.find((d) => d.id === chosen.driverId)!;
    const assignment: DriverOfferAccepted = {
      optionId: this.awarded!.optionId,
      driver,
      pickupEtaMinutes: chosen.pickupEtaMinutes,
      fare: this.awarded!.fare,
      incentive: this.incentive,
      round: this.round,
    };
    bus.send(
      {
        from: this.id,
        to: this.riderId,
        performative: 'INFORM',
        conversationId: this.riderConversation,
        content: assignment,
        summary: `Driver ${driver.name} (${driver.rating}★, ${driver.vehicleType}) arriving in ${chosen.pickupEtaMinutes} min`,
      },
      this.config.latency(0.2, 0.4)
    );
  }

  private fail(bus: MessageBus, reason: string): void {
    this.offered = [];
    bus.send(
      { from: this.id, to: this.riderId, performative: 'FAILURE', conversationId: this.riderConversation, content: { reason }, summary: reason },
      this.config.latency(0.2, 0.4)
    );
  }
}
