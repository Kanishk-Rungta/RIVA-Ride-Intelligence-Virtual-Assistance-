'use client';

import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Note, Shell, Stat, inr } from '../../components/ui';

interface MultiStopPlanData {
  stops: Array<{ formattedAddress: string }>;
  legs: Array<{ from: string; to: string; distanceKm: number; durationMinutes: number; fare: number }>;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  estimatedFare: number;
  optimization?: { algorithm: string; originalEstimateMinutes: number; optimizedEstimateMinutes: number; savedMinutes: number; statesExpanded: number };
}

export default function RideMap() {
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<MultiStopPlanData>();
  if (!data) return <Loading label="Finding the best order for your stops…" />;

  const o = data.optimization;
  return (
    <Shell title="Multi-stop trip" subtitle={`${data.stops.length} stops, ${data.legs.length} legs`}>
      <div className="g3">
        <Stat i={1} tone="teal" label="Distance" value={`${data.totalDistanceKm} km`} />
        <Stat i={2} tone="violet" label="Drive time" value={`${data.totalDurationMinutes} min`} />
        <Stat i={3} tone="amber" label="Estimated fare" value={inr(data.estimatedFare)} />
      </div>
      {o ? (
        <div className="rise" style={{ ['--i' as string]: 4 }}>
          <Note tone="green" icon="✓">
            {o.savedMinutes > 0 ? <><b>Stops reordered, saving about {o.savedMinutes} min</b> ({o.originalEstimateMinutes} to {o.optimizedEstimateMinutes} min). </> : <><b>Your order was already the fastest.</b> </>}
            {o.algorithm}, {o.statesExpanded} states expanded.
          </Note>
        </div>
      ) : null}
      <Glass i={5} tone="teal">
        <div className="steps">
          {data.stops.map((s, k) => {
            const leg = data.legs[k];
            const last = k === data.stops.length - 1;
            return (
              <div key={k} className={`step tone-${k === 0 ? 'teal' : last ? 'rose' : 'violet'}`}>
                <span className="bullet">{k === 0 ? '●' : last ? '■' : k}</span>
                <div>
                  <div className="strong">{s.formattedAddress}</div>
                  <div className="faint">{k === 0 ? 'Start' : last ? 'Final destination' : `Stop ${k}`}</div>
                  {leg ? (
                    <Glass tight lift tone="teal" style={{ marginTop: 6 }}>
                      <div className="between small">
                        <span className="muted">{leg.distanceKm} km, {leg.durationMinutes} min</span>
                        <span className="num strong">{inr(leg.fare)}</span>
                      </div>
                    </Glass>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Glass>
    </Shell>
  );
}
