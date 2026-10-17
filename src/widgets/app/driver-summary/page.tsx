'use client';

import { useState } from 'react';
import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Shell, inr } from '../../components/ui';
import { CountUp, Donut, Gauge, Slider } from '../../components/charts';

interface Data {
  totalEarnings: number;
  expenses: { fuelCost: number; estimatedPlatformCommission: number; total: number };
  netProfit: number;
  estimatedHoursWorked: number;
  hoursWorkedIsEstimated: boolean;
  averageEarningPerHour: number;
  averageEarningPerTrip: number;
  averageEarningPerKm: number;
  recommendations: string[];
}

export default function DriverSummary() {
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<Data>();
  const [hours, setHours] = useState<number | null>(null);
  if (!data) return <Loading label="Adding up your day…" />;

  const h = hours ?? data.estimatedHoursWorked;
  const perHour = Math.round(data.netProfit / h);
  const margin = data.totalEarnings > 0 ? Math.round((data.netProfit / data.totalEarnings) * 100) : 0;
  const trips = data.averageEarningPerTrip > 0 ? Math.round(data.netProfit / data.averageEarningPerTrip) : 0;

  return (
    <Shell title="Your earnings" subtitle={`${trips} trips, ${data.estimatedHoursWorked} hours${data.hoursWorkedIsEstimated ? ' (estimated from distance)' : ''}`} width={740}>
      <div className="split" style={{ alignItems: 'stretch' }}>
        <Glass i={1} tone="green" hero style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="small">Take-home</div>
          <div className="num big" style={{ fontSize: 34 }}><CountUp value={data.netProfit} format={inr} /></div>
          <div className="small">{margin}% of the {inr(data.totalEarnings)} collected</div>
          <div className="chips" style={{ marginTop: 10 }}>
            <span className="pill solid" style={{ background: 'rgba(255,255,255,.22)' }}>{inr(data.averageEarningPerTrip)} per trip</span>
            <span className="pill solid" style={{ background: 'rgba(255,255,255,.22)' }}>₹{data.averageEarningPerKm} per km</span>
          </div>
        </Glass>
        <Glass i={2} tone="teal">
          <div className="h">Pace</div>
          <Gauge value={Math.max(0, Math.min(perHour, 500))} min={0} max={500} label="Take-home per hour" valueLabel={`${inr(perHour)}/hr`} zones={[{ to: 120, tone: 'rose' }, { to: 250, tone: 'amber' }, { to: 500, tone: 'green' }]} />
          <Slider label="If you worked" value={h} min={1} max={14} step={0.5} tone="teal" onChange={setHours} format={(v) => `${v} hours`} />
        </Glass>
      </div>
      <div className="split" style={{ alignItems: 'stretch' }}>
        <Glass i={3} tone="amber">
          <div className="h">Where the money went</div>
          <Donut centerLabel="Collected" centerValue={inr(data.totalEarnings)} format={inr} size={150}
            slices={[{ label: 'Fuel', value: data.expenses.fuelCost, tone: 'amber' }, { label: 'Commission (est.)', value: data.expenses.estimatedPlatformCommission, tone: 'violet' }, { label: 'Kept', value: data.netProfit, tone: 'green' }]} />
        </Glass>
        <Glass i={4} tone="violet">
          <div className="h">What to do next</div>
          <div className="stack" style={{ gap: 8 }}>{data.recommendations.map((r) => <div key={r} className="small muted">• {r}</div>)}</div>
        </Glass>
      </div>
    </Shell>
  );
}
