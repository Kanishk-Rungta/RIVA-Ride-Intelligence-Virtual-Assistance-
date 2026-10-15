'use client';

import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Meter, Shell, Stat, inr, type Tone } from '../../components/ui';

interface ShiftPlanData {
  startZone: string;
  snappedFromKm: number;
  startTime: string;
  hours: number;
  expectedEarnings: { optimal: number; greedy: number; stayPut: number };
  upliftVsGreedyPercent: number;
  upliftVsStayPutPercent: number;
  firstMove: string;
  itinerary: Array<{ time: string; zone: string; action: string; expectedTrips: number; expectedEarningThisHour: number }>;
  model: { method: string; states: number; actionsPerState: number };
}

export default function ShiftPlan() {
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<ShiftPlanData>();
  if (!data) return <Loading label="Solving your shift, hour by hour…" />;

  const e = data.expectedEarnings;
  const max = Math.max(e.optimal, e.greedy, e.stayPut, 1);
  const bars: Array<[string, number, Tone]> = [['Plan (MDP)', e.optimal, 'green'], ['Greedy', e.greedy, 'amber'], ['Stay put', e.stayPut, 'slate']];

  return (
    <Shell title={`Your next ${data.hours} hours`} subtitle={`Starting ${data.startTime} near ${data.startZone}${data.snappedFromKm > 0.3 ? `, ${data.snappedFromKm} km away` : ''}`}>
      <Glass i={1} tone="teal" hero>
        <div className="small">Do this now</div>
        <div className="mid" style={{ marginTop: 2 }}>{data.firstMove}</div>
      </Glass>
      <div className="split">
        <Glass i={2} tone="teal">
          <div className="h">Hour by hour</div>
          <div className="steps">
            {data.itinerary.map((s, k) => (
              <div key={k} className={`step tone-${s.action.startsWith('Reposition') ? 'violet' : 'teal'}${k === 0 ? ' now' : ''}`}>
                <span className="bullet">{k + 1}</span>
                <div>
                  <div className="between"><span className="strong">{s.time}</span><span className="num strong">{inr(s.expectedEarningThisHour)}</span></div>
                  <div className="small muted">{s.action}</div>
                  <div className="faint">About {s.expectedTrips} trips</div>
                </div>
              </div>
            ))}
          </div>
        </Glass>
        <div className="stack">
          <div className="g2">
            <Stat i={3} tone="green" label="vs staying put" value={`+${data.upliftVsStayPutPercent}%`} />
            <Stat i={4} tone="amber" label="vs greedy" value={`+${data.upliftVsGreedyPercent}%`} />
          </div>
          <Glass i={5} tone="green">
            <div className="h">Expected net for the shift</div>
            <div className="stack" style={{ gap: 10 }}>
              {bars.map(([label, value, tone], k) => (
                <div key={label}>
                  <div className="between small"><span className="muted">{label}</span><span className="num strong">{inr(value)}</span></div>
                  <Meter value={value} max={max} tone={tone} i={5 + k} />
                </div>
              ))}
            </div>
          </Glass>
          <div className="faint rise" style={{ ['--i' as string]: 8, padding: '0 4px' }}>
            {data.model.method}, {data.model.states} states with {data.model.actionsPerState} actions each. Demand is simulated; treat the plan as advice.
          </div>
        </div>
      </div>
    </Shell>
  );
}
