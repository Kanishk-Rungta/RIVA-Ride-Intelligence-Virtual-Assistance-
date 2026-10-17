'use client';

import { useState } from 'react';
import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Pill, Route, Shell, cap, inr, type Tone } from '../../components/ui';
import { Donut, Gauge, Slider } from '../../components/charts';

interface Data {
  provider: string;
  vehicleType: string;
  currentLocation: { formattedAddress: string };
  destination: { formattedAddress: string };
  totalDistanceKm: number;
  breakdown: { grossEarning: number; fuelCost: number; fuelCostExplanation: string; platformCommissionRate: number; estimatedTripMinutes: number };
  destinationAttractiveness: { demandLevel: 'HIGH' | 'MEDIUM' | 'LOW'; returnProbability: number; explanation: string };
  recommendation: 'ACCEPT' | 'CONSIDER' | 'REJECT';
  reason: string;
}

const VERDICT: Record<string, { tone: Tone; label: string }> = { ACCEPT: { tone: 'green', label: 'Take this trip' }, CONSIDER: { tone: 'amber', label: 'Borderline' }, REJECT: { tone: 'rose', label: 'Skip this one' } };
const DEMAND: Record<string, Tone> = { HIGH: 'green', MEDIUM: 'amber', LOW: 'rose' };

export default function DriverTripAnalysis() {
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<Data>();
  const [fare, setFare] = useState<number | null>(null);
  if (!data) return <Loading label="Working out what this trip really pays…" />;

  const b = data.breakdown;
  const offered = b.grossEarning;
  const f = fare ?? offered;
  const commission = Math.round(f * b.platformCommissionRate);
  const net = f - b.fuelCost - commission;
  const hourly = Math.round(net / (b.estimatedTripMinutes / 60));
  const breakEven = Math.ceil(b.fuelCost / (1 - b.platformCommissionRate));
  const v = VERDICT[data.recommendation];
  const d = data.destinationAttractiveness;
  const live = fare !== null && fare !== offered;
  const tone: Tone = net <= 0 ? 'rose' : hourly < 120 ? 'amber' : 'green';

  return (
    <Shell title="Should you accept?" subtitle={`${cap(data.provider)} ${data.vehicleType} offer, ${data.totalDistanceKm} km including the drive to pickup`} width={740}>
      <Glass i={1} tone={live ? tone : v.tone} hero>
        <div className="between">
          <div><div className="small">{live ? 'At the fare you are testing' : v.label}</div><div className="mid" style={{ marginTop: 2 }}>{net <= 0 ? `You lose ${inr(-net)}` : `You keep ${inr(net)} of ${inr(f)}`}</div></div>
          <div style={{ textAlign: 'right' }}><div className="num big">{inr(hourly)}</div><div className="small">per hour</div></div>
        </div>
        <div className="small" style={{ marginTop: 8, opacity: 0.92 }}>{live ? (net <= 0 ? 'Below break-even: fuel and commission cost more than the fare.' : hourly < 120 ? 'Thin: you would earn less than a typical hour on the road.' : 'A fare worth taking.') : data.reason}</div>
      </Glass>

      <div className="split">
        <Glass i={2} tone="green">
          <div className="h">Where the fare goes</div>
          <Donut centerLabel="You keep" centerValue={inr(Math.max(net, 0))} format={inr} size={150}
            slices={[{ label: 'Fuel', value: b.fuelCost, tone: 'amber' }, { label: `Commission ${Math.round(b.platformCommissionRate * 100)}%`, value: commission, tone: 'violet' }, { label: 'You keep', value: Math.max(net, 0), tone: 'green' }]} />
          <div style={{ marginTop: 14 }}>
            <Slider label="What if the fare were" value={f} min={Math.round(offered * 0.4)} max={Math.round(offered * 1.8)} step={5} tone={tone} onChange={setFare} format={(x) => `${inr(x)}${x === offered ? ' (offered)' : ''}`} />
            <div className="faint" style={{ marginTop: 6 }}>Break-even is {inr(breakEven)}. {b.fuelCostExplanation}</div>
            {live ? <button className="btn" style={{ marginTop: 8 }} onClick={() => setFare(null)}>Back to the offered fare</button> : null}
          </div>
        </Glass>
        <div className="stack">
          <Glass i={3} tone={tone}>
            <div className="h">Hourly earnings</div>
            <Gauge value={Math.max(0, Math.min(hourly, 400))} min={0} max={400} label="Net earning per hour" valueLabel={`${inr(hourly)}/hr`} zones={[{ to: 120, tone: 'rose' }, { to: 220, tone: 'amber' }, { to: 400, tone: 'green' }]} marker={120} markerLabel="120" />
          </Glass>
          <Glass i={4} tone="teal" lift><Route from={data.currentLocation.formattedAddress} to={data.destination.formattedAddress} middle={`About ${b.estimatedTripMinutes} min of driving`} /></Glass>
          <Glass i={5} tone={DEMAND[d.demandLevel]} lift>
            <div className="between"><span className="h" style={{ margin: 0 }}>Ride back from there</span><Pill tone={DEMAND[d.demandLevel]}>{cap(d.demandLevel)}</Pill></div>
            <div className="small muted" style={{ marginTop: 6 }}>{Math.round(d.returnProbability * 100)}% chance of a return fare. {d.explanation}</div>
          </Glass>
        </div>
      </div>
    </Shell>
  );
}
