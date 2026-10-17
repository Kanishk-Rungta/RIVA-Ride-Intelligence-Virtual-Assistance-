'use client';

import { useState } from 'react';
import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Mark, Pill, Shell, inr, type Tone } from '../../components/ui';
import { CountUp, Radar } from '../../components/charts';

interface Ride {
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
}

interface Data {
  mode?: string;
  modeExplanation?: string;
  selectedRide: Ride | null;
  reasoning?: string;
  alternatives: Ride[];
  message?: string;
}

const TONES: Tone[] = ['teal', 'amber', 'violet', 'rose'];
const AXES = ['Price', 'Pickup', 'Rating', 'Trip speed', 'Steady fare'];

export default function Recommendation() {
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<Data>();
  const [focus, setFocus] = useState<number | null>(null);
  const [hidden, setHidden] = useState<number[]>([]);

  if (!data) return <Loading label="Weighing fare, pickup time and rating…" />;
  const ride = data.selectedRide;
  if (!ride) {
    return <Shell title="Recommendation"><Glass i={1} tone="rose"><div className="strong">No ride matches right now</div><div className="muted small">{data.message ?? 'Relax a preference and try again.'}</div></Glass></Shell>;
  }

  const rides = [ride, ...data.alternatives.slice(0, 3)];
  const span = (f: (r: Ride) => number) => [Math.min(...rides.map(f)), Math.max(...rides.map(f))];
  const score = (v: number, [lo, hi]: number[], invert: boolean) => (hi === lo ? 0.7 : invert ? 1 - (v - lo) / (hi - lo) * 0.85 : 0.15 + ((v - lo) / (hi - lo)) * 0.85);
  const [fare, eta, trip, surge] = [span((r) => r.fare), span((r) => r.pickupEtaMinutes), span((r) => r.tripDurationMinutes), span((r) => r.surgeMultiplier)];
  const values = (r: Ride) => [score(r.fare, fare, true), score(r.pickupEtaMinutes, eta, true), (r.rating - 3.5) / 1.5, score(r.tripDurationMinutes, trip, true), score(r.surgeMultiplier, surge, true)];
  const series = rides.map((r, k) => ({ name: `${r.providerName} ${r.vehicleType}`, values: values(r), tone: TONES[k] })).filter((_, k) => !hidden.includes(k));
  const shownIdx = rides.map((_, k) => k).filter((k) => !hidden.includes(k));
  const f = focus === null ? ride : rides[focus];

  return (
    <Shell title="Best ride for you" subtitle={data.mode ? `Chosen by ${data.mode.replace('_', ' ')}` : undefined} width={720}>
      <Glass i={1} tone="green" hero>
        <div className="between">
          <div className="row"><Mark provider={ride.provider} vehicle={ride.vehicleType} /><div><div className="mid">{ride.providerName} {ride.vehicleType}</div><div className="small">★ {ride.rating.toFixed(1)}, pickup in {ride.pickupEtaMinutes} min</div></div></div>
          <div className="num big"><CountUp value={ride.fare} format={(n) => inr(n)} /></div>
        </div>
        {data.reasoning ? <div className="small" style={{ marginTop: 10, opacity: 0.92 }}>{data.reasoning}</div> : null}
      </Glass>

      <div className="split">
        <Glass i={2} tone="violet">
          <div className="h">How the choices compare</div>
          <Radar axes={AXES} series={series} active={focus === null ? null : shownIdx.indexOf(focus)} />
          <div className="faint" style={{ textAlign: 'center' }}>Further from the centre is better on that axis.</div>
        </Glass>
        <div className="stack">
          <Glass i={3} tone="teal">
            <div className="h">Tap to show or hide, hover to highlight</div>
            <div className="stack" style={{ gap: 6 }}>
              {rides.map((r, k) => (
                <div key={r.optionId} className={`glass lift tight tone-${TONES[k]}`} style={{ opacity: hidden.includes(k) ? 0.4 : 1 }} tabIndex={0}
                  onMouseEnter={() => setFocus(k)} onMouseLeave={() => setFocus(null)}
                  onClick={() => setHidden(hidden.includes(k) ? hidden.filter((x) => x !== k) : [...hidden, k])}>
                  <div className="between">
                    <div className="row"><span className="legend"><i style={{ background: `var(--${TONES[k]})` }} /></span><div><div className="strong">{r.providerName} {r.vehicleType}</div><div className="faint">{r.pickupEtaMinutes} min away, {r.tripDurationMinutes} min trip</div></div></div>
                    <span className="num strong">{inr(r.fare)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Glass>
          <Glass i={4} tone={TONES[focus ?? 0]}>
            <div className="h">{f.providerName} {f.vehicleType}</div>
            <div className="chips"><Pill tone="amber">{inr(f.fare)}</Pill><Pill tone="teal">{f.pickupEtaMinutes} min pickup</Pill><Pill tone="violet">{f.rating.toFixed(1)}★</Pill><Pill tone={f.surgeMultiplier > 1.05 ? 'rose' : 'green'}>Surge {f.surgeMultiplier}×</Pill></div>
          </Glass>
        </div>
      </div>
      {data.modeExplanation ? <div className="faint rise" style={{ ['--i' as string]: 6, textAlign: 'center' }}>{data.modeExplanation}</div> : null}
    </Shell>
  );
}
