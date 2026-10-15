import type { Agent, AclMessage, MessageBus } from './acl.js';
import type { PreferenceSatisfaction, RankedRideOption, RideOption, RideSearchContext } from '../domain/types.js';
import type { DriverOfferAccepted } from './provider.agent.js';

export interface RideRequest {
  origin: string;
  destination: string;
  distanceKm: number;
  durationMinutes: number;
}

export interface RiderAgentConfig {
  id: string;
  providerAgentIds: string[];
  context: RideSearchContext;
  /** The rider's hard and soft constraints. */
  satisfy: (options: RideOption[]) => PreferenceSatisfaction;
  /** The rider's utility function (RankingService with its learned weights). */
  rank: (options: RideOption[]) => RankedRideOption[];
  /** Award this option first (used when the rider already chose one, e.g. a confirmed booking). */
  preferredOptionId?: string;
  /** How many contracts to try before giving up — 1 means "this ride or nothing". */
  maxAwards: number;
  latency: (min: number, max: number) => number;
}

export type RiderOutcome =
  | { status: 'PENDING' }
  | { status: 'MATCHED'; option: RankedRideOption; assignment: DriverOfferAccepted; awards: number }
  | { status: 'NO_MATCH'; reason: string; awards: number };

/**
 * RiderAgent — the Contract Net MANAGER.
 *
 * Utility-based and learning: it broadcasts a call for proposals to every
 * provider, filters the bids through the rider's constraints, ranks them
 * with the rider's learned utility, and awards the contract to the best
 * bid. If the winning provider cannot find a driver it reports FAILURE,
 * and the rider re-awards to the next-best bid — so the overall plan
 * degrades gracefully instead of failing on the first refusal.
 */
export class RiderAgent implements Agent {
  readonly role = 'rider' as const;
  readonly id: string;
  outcome: RiderOutcome = { status: 'PENDING' };
  relaxedConstraints: string[] = [];

  private readonly proposals = new Map<string, RideOption[]>();
  private replies = 0;
  private candidates: RankedRideOption[] = [];
  private awards = 0;
  private readonly conversationId: string;

  constructor(private readonly config: RiderAgentConfig) {
    this.id = config.id;
    this.conversationId = `ride-request-${config.id}`;
  }

  start(bus: MessageBus): void {
    const { origin, destination, route } = this.config.context;
    const request: RideRequest = {
      origin: origin.formattedAddress,
      destination: destination.formattedAddress,
      distanceKm: route.distanceKm,
      durationMinutes: route.durationMinutes,
    };
    for (const provider of this.config.providerAgentIds) {
      bus.send(
        {
          from: this.id,
          to: provider,
          performative: 'CFP',
          conversationId: this.conversationId,
          content: request,
          summary: `Call for proposals: ${request.origin} → ${request.destination} (${request.distanceKm} km)`,
        },
        this.config.latency(0.1, 0.3)
      );
    }
  }

  receive(message: AclMessage, bus: MessageBus): void {
    switch (message.performative) {
      case 'PROPOSE':
        this.proposals.set(message.from, (message.content as { options: RideOption[] }).options);
        this.replies++;
        break;
      case 'REFUSE':
        this.replies++;
        break;
      case 'INFORM': {
        const assignment = message.content as DriverOfferAccepted;
        const option = this.candidates.find((c) => c.optionId === assignment.optionId)!;
        this.outcome = { status: 'MATCHED', option, assignment, awards: this.awards };
        this.closeLosingBids(bus, message.from);
        return;
      }
      case 'FAILURE':
        this.awardNext(bus, (message.content as { reason: string }).reason);
        return;
      default:
        return;
    }

    if (this.replies === this.config.providerAgentIds.length) this.evaluateBids(bus);
  }

  private evaluateBids(bus: MessageBus): void {
    const all = [...this.proposals.values()].flat();
    const satisfaction = this.config.satisfy(all);
    this.relaxedConstraints = satisfaction.relaxed;
    this.candidates = this.config.rank(satisfaction.options).filter((o) => o.availability);

    const preferred = this.candidates.findIndex((c) => c.optionId === this.config.preferredOptionId);
    if (preferred > 0) this.candidates.unshift(...this.candidates.splice(preferred, 1));

    if (this.candidates.length === 0) {
      const reason = satisfaction.unsatisfiableHard
        ? `No bid satisfies the hard constraint "${satisfaction.unsatisfiableHard}".`
        : 'No provider had an available vehicle.';
      this.outcome = { status: 'NO_MATCH', reason, awards: 0 };
      this.closeLosingBids(bus, null);
      return;
    }
    this.awardNext(bus, null);
  }

  private awardNext(bus: MessageBus, previousFailure: string | null): void {
    if (this.awards >= this.config.maxAwards || this.awards >= this.candidates.length) {
      this.outcome = {
        status: 'NO_MATCH',
        reason: previousFailure ?? 'No provider could fulfil the request.',
        awards: this.awards,
      };
      this.closeLosingBids(bus, null);
      return;
    }

    const winner = this.candidates[this.awards++];
    bus.send(
      {
        from: this.id,
        to: `provider:${winner.provider}`,
        performative: 'ACCEPT_PROPOSAL',
        conversationId: this.conversationId,
        content: { optionId: winner.optionId },
        summary: `${previousFailure ? 'Re-award' : 'Award'}: ${winner.providerName} ${winner.vehicleType} at ₹${winner.fare} (utility rank #${this.awards})`,
      },
      this.config.latency(0.2, 0.5)
    );
  }

  /** Contract Net closure: every bidder that did not win hears so explicitly. */
  private closeLosingBids(bus: MessageBus, winner: string | null): void {
    for (const provider of this.proposals.keys()) {
      if (provider === winner) continue;
      bus.send(
        {
          from: this.id,
          to: provider,
          performative: 'REJECT_PROPOSAL',
          conversationId: this.conversationId,
          content: {},
          summary: winner ? 'Your bid was not selected' : 'Request withdrawn',
        },
        this.config.latency(0.1, 0.2)
      );
    }
  }
}
