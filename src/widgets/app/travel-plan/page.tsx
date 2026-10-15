'use client';

import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Mark, Pill, Route, Shell, Stat, inr } from '../../components/ui';

interface Ride { provider?: string; providerName: string; vehicleType: string; fare: number; pickupEtaMinutes: number; rating: number }
interface TravelPlanData {
  origin: { formattedAddress: string };
  destination: { formattedAddress: string };
  arriveByLabel: string;
  recommendedPickupLabel: string;
  bufferMinutes: number;
  bufferReason: string;
  trafficAdjustedTravelMinutes: number;
  trafficMultiplier: number;
  route: { distanceKm: number; source: string; via?: string[] };
  recommendation: Ride | null;
  recommendationReason: string;
}

const providerKey = (r: Ride) => (r.provider ?? r.providerName).toLowerCase();

export default function TravelPlan() {
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<TravelPlanData>();
  if (!data) return <Loading label="Planning backwards from your deadline…" />;

  const r = data.recommendation;
  return (
    <Shell title={`Be there by ${data.arriveByLabel}`} subtitle="Pickup time worked back from traffic and a safety buffer">
      <Glass i={1} tone="violet" hero>
        <div className="between">
          <div><div className="small">Leave at</div><div className="num big">{data.recommendedPickupLabel}</div></div>
          <div style={{ textAlign: 'right' }}><div className="small">Arrive by</div><div className="num mid">{data.arriveByLabel}</div></div>
        </div>
      </Glass>
      <div className="g3">
        <Stat i={2} tone="teal" label="Drive time" value={`${data.trafficAdjustedTravelMinutes} min`} sub={`Traffic ×${data.trafficMultiplier}`} />
        <Stat i={3} tone="amber" label="Buffer" value={`${data.bufferMinutes} min`} />
        <Stat i={4} tone="violet" label="Distance" value={`${data.route.distanceKm} km`} sub={data.route.source === 'road_graph' ? 'A* route' : undefined} />
      </div>
      <div className="split">
        <Glass i={5} tone="teal" lift>
          <Route from={data.origin.formattedAddress} to={data.destination.formattedAddress} middle={data.route.via && data.route.via.length > 2 ? `Via ${data.route.via.slice(1, -1).slice(0, 4).join(', ')}` : undefined} />
          <div className="faint" style={{ marginTop: 8 }}>{data.bufferReason}</div>
        </Glass>
        {r ? (
          <Glass i={6} tone="green" lift>
            <div className="between">
              <div className="row"><Mark provider={providerKey(r)} vehicle={r.vehicleType} /><div><div className="strong">{r.providerName} {r.vehicleType}</div><div className="faint">★ {r.rating}, {r.pickupEtaMinutes} min away</div></div></div>
              <span className="num mid">{inr(r.fare)}</span>
            </div>
            <div className="chips" style={{ marginTop: 8 }}><Pill tone="green" solid>Book this</Pill></div>
            <div className="faint" style={{ marginTop: 6 }}>{data.recommendationReason}</div>
          </Glass>
        ) : null}
      </div>
    </Shell>
  );
}
