'use client';

import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Mark, Note, Route, Shell, Stat, cap, inr } from '../../components/ui';

type BookingStatus = 'SEARCHING' | 'DRIVER_ASSIGNED' | 'DRIVER_ARRIVING' | 'TRIP_STARTED' | 'COMPLETED' | 'CANCELLED';
interface RideSummary { provider: string; providerName: string; vehicleType: string; fare: number; origin?: string; destination?: string }
interface PendingData { status: 'PENDING_CONFIRMATION'; message: string; rideSummary: RideSummary }
interface CancelledData { status: 'CANCELLED'; message: string; rideSummary: RideSummary; dispatch?: { driversContacted: number } }
interface BookingData {
  bookingId: string;
  provider: string;
  vehicleType: string;
  fare: number;
  origin: { formattedAddress: string };
  destination: { formattedAddress: string };
  status: BookingStatus;
  driver: { driverName: string; vehicleNumber: string; rating: number; etaMinutes: number } | null;
  dispatch?: { driversContacted: number; driverAcceptances: number };
  learning?: { after: { fare: number; pickupEta: number; rating: number } };
}

const LIFECYCLE: BookingStatus[] = ['SEARCHING', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'TRIP_STARTED', 'COMPLETED'];
const LABEL: Record<string, string> = { SEARCHING: 'Finding a driver', DRIVER_ASSIGNED: 'Driver assigned', DRIVER_ARRIVING: 'Driver arriving', TRIP_STARTED: 'On the way', COMPLETED: 'Arrived' };

export default function BookingStatusWidget() {
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<PendingData | CancelledData | BookingData>();
  if (!data) return <Loading label="Dispatching your ride…" />;

  if (!('bookingId' in data)) {
    const pending = data.status === 'PENDING_CONFIRMATION';
    const r = data.rideSummary;
    return (
      <Shell title={pending ? 'Confirm your booking' : 'No driver accepted'} subtitle="Simulated booking, no payment is taken" width={600}>
        <Glass i={1} tone={pending ? 'violet' : 'rose'} lift>
          <div className="between">
            <div className="row"><Mark provider={r.provider} vehicle={r.vehicleType} /><div className="strong">{r.providerName} {r.vehicleType}</div></div>
            <span className="num mid">{inr(r.fare)}</span>
          </div>
          {r.origin && r.destination ? <div style={{ marginTop: 10 }}><Route from={r.origin} to={r.destination} /></div> : null}
        </Glass>
        <div className="rise" style={{ ['--i' as string]: 2 }}><Note tone={pending ? 'violet' : 'rose'} icon={pending ? '?' : '!'}>{data.message}</Note></div>
      </Shell>
    );
  }

  const current = LIFECYCLE.indexOf(data.status);
  return (
    <Shell title={LABEL[data.status] ?? cap(data.status)} subtitle={`Booking ${data.bookingId.slice(0, 8)}, simulated`}>
      {data.driver ? (
        <Glass i={1} tone="green" hero>
          <div className="between">
            <div><div className="small">Your driver</div><div className="mid">{data.driver.driverName}, ★ {data.driver.rating}</div><div className="small">{data.driver.vehicleNumber}</div></div>
            <div style={{ textAlign: 'right' }}><div className="num big">{data.driver.etaMinutes} min</div><div className="small">to pickup</div></div>
          </div>
        </Glass>
      ) : null}
      <div className="split">
        <Glass i={2} tone="teal">
          <div className="steps">
            {LIFECYCLE.map((s, k) => (
              <div key={s} className={`step tone-${k <= current ? 'green' : 'slate'}${k > current ? ' todo' : ''}${k === current ? ' now' : ''}`}>
                <span className="bullet">{k < current ? '✓' : k + 1}</span>
                <div className={k <= current ? 'strong' : 'muted'} style={{ paddingTop: 2 }}>{LABEL[s]}</div>
              </div>
            ))}
          </div>
        </Glass>
        <div className="stack">
          <Glass i={3} tone="teal" lift><Route from={data.origin.formattedAddress} to={data.destination.formattedAddress} /></Glass>
          <div className="g2">
            <Stat i={4} tone="amber" label="Fare" value={inr(data.fare)} sub={`${cap(data.provider)} ${data.vehicleType}`} />
            <Stat i={5} tone="violet" label="Drivers asked" value={data.dispatch ? data.dispatch.driversContacted : '—'} sub={data.dispatch ? `${data.dispatch.driverAcceptances} accepted` : undefined} />
          </div>
        </div>
      </div>
      {data.learning ? (
        <div className="faint rise" style={{ ['--i' as string]: 6, padding: '0 4px' }}>
          RIVA learned from this choice: fare {Math.round(data.learning.after.fare * 100)}%, pickup {Math.round(data.learning.after.pickupEta * 100)}%, rating {Math.round(data.learning.after.rating * 100)}%.
        </div>
      ) : null}
    </Shell>
  );
}
