import type { Agent, AclMessage, MessageBus } from './acl.js';
import type { FuelType, LatLng, ProviderId, VehicleType } from '../domain/types.js';
import type { DriverReply, TripOffer } from './provider.agent.js';

export interface DriverProfile {
  id: string;
  name: string;
  provider: ProviderId;
  vehicleType: VehicleType;
  fuelType: FuelType;
  coordinates: LatLng;
  rating: number;
  /** Lowest hourly net earning (₹/hr) this driver accepts on a borderline trip — drivers differ. */
  reservationHourly: number;
}

/** The driver's evaluation model — ProfitabilityService + DemandService + RecommendationService. */
export type TripEvaluator = (offer: TripOffer, driver: DriverProfile) => Omit<DriverReply, 'driverId'>;

/**
 * DriverAgent — a Contract Net CONTRACTOR, and the same decision maker as
 * the analyse_driver_trip tool.
 *
 * Utility-based: on a trip offer it computes its own net earning (fare +
 * incentive − fuel − commission), hourly rate, pickup cost, and the
 * return-ride demand at the destination, then takes the recommendation
 * engine's ACCEPT / CONSIDER / REJECT. A CONSIDER is accepted only if the
 * hourly rate clears this driver's personal reservation wage, so two
 * drivers can rationally answer the same offer differently.
 */
export class DriverAgent implements Agent {
  readonly role = 'driver' as const;
  readonly id: string;
  status: 'IDLE' | 'ASSIGNED' = 'IDLE';

  constructor(
    readonly profile: DriverProfile,
    private readonly evaluate: TripEvaluator,
    private readonly latency: (min: number, max: number) => number
  ) {
    this.id = profile.id;
  }

  receive(message: AclMessage, bus: MessageBus): void {
    if (message.performative === 'ACCEPT_PROPOSAL') {
      this.status = 'ASSIGNED';
      return;
    }
    if (message.performative !== 'CFP' || this.status !== 'IDLE') return;

    const offer = message.content as TripOffer;
    const evaluation = this.evaluate(offer, this.profile);
    const accepts =
      evaluation.recommendation === 'ACCEPT' ||
      (evaluation.recommendation === 'CONSIDER' && evaluation.hourlyEarning >= this.profile.reservationHourly);

    const reply: DriverReply = { driverId: this.id, ...evaluation };
    bus.send(
      {
        from: this.id,
        to: message.from,
        performative: accepts ? 'PROPOSE' : 'REFUSE',
        conversationId: message.conversationId,
        content: reply,
        summary: accepts
          ? `Accept — nets ₹${evaluation.netEarning} (~₹${evaluation.hourlyEarning}/hr), ${evaluation.pickupDistanceKm} km to pickup`
          : `Decline — ${evaluation.recommendation === 'CONSIDER' ? `₹${evaluation.hourlyEarning}/hr is below my ₹${this.profile.reservationHourly}/hr floor` : evaluation.reason}`,
      },
      this.latency(2, 9) // a human glancing at the offer
    );
  }
}
