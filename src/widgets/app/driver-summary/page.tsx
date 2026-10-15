'use client';

import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Meter, Shell, Stat, inr } from '../../components/ui';

interface SummaryData {
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
  const data = getToolOutput<SummaryData>();
  if (!data) return <Loading label="Adding up your day…" />;

  const margin = data.totalEarnings > 0 ? Math.round((data.netProfit / data.totalEarnings) * 100) : 0;
  return (
    <Shell title="Your earnings" subtitle={`${data.estimatedHoursWorked} hours${data.hoursWorkedIsEstimated ? ' (estimated from distance)' : ''}`}>
      <Glass i={1} tone="green" hero>
        <div className="between">
          <div><div className="small">Take-home</div><div className="num big">{inr(data.netProfit)}</div></div>
          <div style={{ textAlign: 'right' }}><div className="small">from {inr(data.totalEarnings)} collected</div><div className="num mid">{margin}% kept</div></div>
        </div>
      </Glass>
      <div className="g3">
        <Stat i={2} tone="teal" label="Per hour" value={inr(data.averageEarningPerHour)} />
        <Stat i={3} tone="violet" label="Per trip" value={inr(data.averageEarningPerTrip)} />
        <Stat i={4} tone="amber" label="Per km" value={`₹${data.averageEarningPerKm}`} />
      </div>
      <div className="split">
        <Glass i={5} tone="amber">
          <div className="h">Where the money went</div>
          {([['Fuel', data.expenses.fuelCost, 'amber'], ['Platform commission (est.)', data.expenses.estimatedPlatformCommission, 'violet'], ['Kept', data.netProfit, 'green']] as const).map(([label, v, tone], k) => (
            <div key={label} style={{ marginBottom: 9 }}>
              <div className="between small"><span className="muted">{label}</span><span className="num strong">{inr(v)}</span></div>
              <Meter value={v} max={data.totalEarnings} tone={tone} i={5 + k} />
            </div>
          ))}
        </Glass>
        <Glass i={6} tone="violet">
          <div className="h">Suggestions</div>
          <div className="stack" style={{ gap: 8 }}>
            {data.recommendations.map((r) => <div key={r} className="small muted">• {r}</div>)}
          </div>
        </Glass>
      </div>
    </Shell>
  );
}
