'use client';

import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Mark, Pill, Shell, Stat, cap, inr } from '../../components/ui';

interface RankedRideOption {
  optionId: string;
  provider: 'uber' | 'ola' | 'rapido';
  providerName: string;
  vehicleType: string;
  fare: number;
  pickupEtaMinutes: number;
  tripDurationMinutes: number;
  distanceKm: number;
  rating: number;
  surgeMultiplier: number;
  rank: number;
  scoreReason: string;
}

interface RecommendationData {
  mode?: string;
  modeExplanation?: string;
  selectedRide: RankedRideOption | null;
  reasoning?: string;
  alternatives: RankedRideOption[];
  fareBreakdown?: { totalFare: number; distanceKm: number; approxPerKm: number; surgeMultiplier: number; dataSource: string };
  message?: string;
}

export default function Recommendation() {
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<RecommendationData>();
  if (!data) return <Loading label="Weighing fare, pickup time and rating…" />;

  const ride = data.selectedRide;
  if (!ride) {
    return (
      <Shell title="Recommendation">
        <Glass i={1} tone="rose"><div className="strong">No ride matches right now</div><div className="muted small">{data.message ?? 'Relax a preference and try again.'}</div></Glass>
      </Shell>
    );
  }

  return (
    <Shell title="Best ride for you" subtitle={data.mode ? `Strategy: ${cap(data.mode)}` : undefined} width={620}>
      <Glass i={1} tone="green" hero>
        <div className="between">
          <div className="row">
            <Mark provider={ride.provider} vehicle={ride.vehicleType} />
            <div>
              <div className="mid">{ride.providerName} {ride.vehicleType}</div>
              <div className="muted small">★ {ride.rating.toFixed(1)}, pickup in {ride.pickupEtaMinutes} min</div>
            </div>
          </div>
          <div className="num big">{inr(ride.fare)}</div>
        </div>
        {data.reasoning ? <div className="small" style={{ marginTop: 10, opacity: 0.92 }}>{data.reasoning}</div> : null}
      </Glass>

      <div className="g3">
        <Stat i={2} tone="teal" label="Trip time" value={`${ride.tripDurationMinutes} min`} />
        {data.fareBreakdown ? <Stat i={3} tone="amber" label="Per km" value={inr(data.fareBreakdown.approxPerKm)} /> : <Stat i={3} tone="amber" label="Distance" value={`${ride.distanceKm} km`} />}
        <Stat i={4} tone="violet" label="Surge" value={`${ride.surgeMultiplier}×`} />
      </div>

      {data.alternatives.length ? (
        <Glass i={5} tone="slate">
          <div className="h">Also worth a look</div>
          <div className="stack" style={{ gap: 8 }}>
            {data.alternatives.map((a, k) => (
              <Glass key={a.optionId} i={6 + k} tight lift tone="teal">
                <div className="between">
                  <div className="row"><Mark provider={a.provider} vehicle={a.vehicleType} /><div><div className="strong">{a.providerName} {a.vehicleType}</div><div className="faint">{a.pickupEtaMinutes} min away, ★ {a.rating.toFixed(1)}</div></div></div>
                  <div className="row"><Pill tone="slate">#{a.rank}</Pill><span className="num mid">{inr(a.fare)}</span></div>
                </div>
              </Glass>
            ))}
          </div>
        </Glass>
      ) : null}
      {data.modeExplanation ? <div className="faint rise" style={{ ['--i' as string]: 10, textAlign: 'center' }}>{data.modeExplanation}</div> : null}
    </Shell>
  );
}
