'use client';

import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Meter, Pill, Route, Shell, Stat, cap, inr, type Tone } from '../../components/ui';

interface DriverTripAnalysisData {
  provider: string;
  vehicleType: string;
  currentLocation: { formattedAddress: string };
  destination: { formattedAddress: string };
  totalDistanceKm: number;
  breakdown: {
    grossEarning: number; fuelCost: number; fuelCostExplanation: string; platformCommission: number; platformCommissionRate: number;
    netEarning: number; costPerKm: number; estimatedTripMinutes: number; estimatedHourlyEarning: number;
  };
  destinationAttractiveness: { demandLevel: 'HIGH' | 'MEDIUM' | 'LOW'; returnProbability: number; explanation: string };
  recommendation: 'ACCEPT' | 'CONSIDER' | 'REJECT';
  reason: string;
}

const VERDICT: Record<string, { tone: Tone; label: string }> = {
  ACCEPT: { tone: 'green', label: 'Take this trip' },
  CONSIDER: { tone: 'amber', label: 'Borderline' },
  REJECT: { tone: 'rose', label: 'Skip this one' },
};
const DEMAND_TONE: Record<string, Tone> = { HIGH: 'green', MEDIUM: 'amber', LOW: 'rose' };

export default function DriverTripAnalysis() {
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<DriverTripAnalysisData>();
  if (!data) return <Loading label="Working out what this trip really pays…" />;

  const b = data.breakdown;
  const v = VERDICT[data.recommendation];
  const d = data.destinationAttractiveness;
  const parts: Array<[string, number, Tone]> = [['Fuel', b.fuelCost, 'amber'], [`Commission (${Math.round(b.platformCommissionRate * 100)}%)`, b.platformCommission, 'violet'], ['You keep', b.netEarning, 'green']];

  return (
    <Shell title="Should you accept?" subtitle={`${cap(data.provider)} ${data.vehicleType} offer, ${data.totalDistanceKm} km including pickup`}>
      <Glass i={1} tone={v.tone} hero>
        <div className="between">
          <div><div className="small">{v.label}</div><div className="mid" style={{ marginTop: 2 }}>{inr(b.netEarning)} net from {inr(b.grossEarning)}</div></div>
          <div style={{ textAlign: 'right' }}><div className="num big">{inr(b.estimatedHourlyEarning)}</div><div className="small">per hour</div></div>
        </div>
        <div className="small" style={{ marginTop: 8, opacity: 0.92 }}>{data.reason}</div>
      </Glass>
      <div className="split">
        <Glass i={2} tone="green">
          <div className="h">Where the fare goes</div>
          <div className="stack" style={{ gap: 10 }}>
            {parts.map(([label, value, tone], k) => (
              <div key={label}>
                <div className="between small"><span className="muted">{label}</span><span className="num strong">{inr(value)}</span></div>
                <Meter value={Math.max(value, 0)} max={b.grossEarning} tone={tone} i={2 + k} />
              </div>
            ))}
          </div>
          <div className="faint" style={{ marginTop: 10 }}>{b.fuelCostExplanation}</div>
        </Glass>
        <div className="stack">
          <Glass i={3} tone="teal" lift><Route from={data.currentLocation.formattedAddress} to={data.destination.formattedAddress} middle={`About ${b.estimatedTripMinutes} min`} /></Glass>
          <Glass i={4} tone={DEMAND_TONE[d.demandLevel]} lift>
            <div className="between"><span className="h" style={{ margin: 0 }}>Return demand</span><Pill tone={DEMAND_TONE[d.demandLevel]}>{cap(d.demandLevel)}</Pill></div>
            <div className="small muted" style={{ marginTop: 6 }}>{Math.round(d.returnProbability * 100)}% chance of a ride back. {d.explanation}</div>
          </Glass>
          <Stat i={5} tone="amber" label="Cost per paid km" value={inr(b.costPerKm)} />
        </div>
      </div>
    </Shell>
  );
}
