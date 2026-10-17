'use client';

import { useState } from 'react';
import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Meter, Pill, Shell, Stat, inr, type Tone } from '../../components/ui';
import { Bars, CountUp } from '../../components/charts';

interface Data {
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
  const data = getToolOutput<Data>();
  const [active, setActive] = useState<number | null>(null);
  if (!data) return <Loading label="Solving your shift, hour by hour…" />;

  const e = data.expectedEarnings;
  const max = Math.max(e.optimal, e.greedy, e.stayPut, 1);
  const bars: Array<[string, number, Tone]> = [['Plan (MDP)', e.optimal, 'green'], ['Greedy', e.greedy, 'amber'], ['Stay put', e.stayPut, 'slate']];
  const sel = data.itinerary[active ?? 0];
  const moves = (s: string) => s.startsWith('Reposition');

  return (
    <Shell title={`Your next ${data.hours} hours`} subtitle={`Starting ${data.startTime} near ${data.startZone}${data.snappedFromKm > 0.3 ? `, ${data.snappedFromKm} km away` : ''}`} width={740}>
      <Glass i={1} tone="teal" hero>
        <div className="between">
          <div><div className="small">Do this now</div><div className="mid" style={{ marginTop: 2 }}>{data.firstMove}</div></div>
          <div style={{ textAlign: 'right' }}><div className="num big"><CountUp value={e.optimal} format={inr} /></div><div className="small">expected for the shift</div></div>
        </div>
      </Glass>

      <Glass i={2} tone="violet">
        <div className="h">Your route through the zones</div>
        <div className="row" style={{ gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
          {data.itinerary.map((s, k) => (
            <div key={k} className="row" style={{ gap: 0, flex: '1 0 auto' }}>
              <div className={`glass lift tight tone-${moves(s.action) ? 'violet' : 'teal'}${active === k ? ' active' : ''}`} style={{ minWidth: 118, textAlign: 'center' }} tabIndex={0}
                onMouseEnter={() => setActive(k)} onMouseLeave={() => setActive(null)} onClick={() => setActive(active === k ? null : k)}>
                <div className="faint">{s.time}</div>
                <div className="strong" style={{ fontSize: 12.5 }}>{s.zone.replace(' Corridor', '').replace('Coimbatore ', '')}</div>
                <div className="chips" style={{ justifyContent: 'center', marginTop: 4 }}><Pill tone={moves(s.action) ? 'violet' : 'teal'}>{moves(s.action) ? 'Move' : 'Wait'}</Pill></div>
              </div>
              {k < data.itinerary.length - 1 ? <svg width="26" height="14" viewBox="0 0 26 14" aria-hidden><path d="M2 7h18m-5-5 6 5-6 5" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
            </div>
          ))}
        </div>
      </Glass>

      <div className="split">
        <Glass i={3} tone="teal">
          <div className="h">Expected earnings each hour</div>
          <Bars items={data.itinerary.map((s) => ({ label: s.time.replace(':00 ', ''), value: s.expectedEarningThisHour }))} active={active} onActive={setActive} format={inr} tone="teal" />
          <div className={`readout tone-${moves(sel.action) ? 'violet' : 'teal'}`} style={{ marginTop: 8 }}>
            <div><b>{sel.time}</b>: {sel.action}<div className="faint">About {sel.expectedTrips} trips, {inr(sel.expectedEarningThisHour)} expected</div></div>
          </div>
        </Glass>
        <div className="stack">
          <div className="g2">
            <Stat i={4} tone="green" label="vs staying put" value={`+${data.upliftVsStayPutPercent}%`} />
            <Stat i={5} tone="amber" label="vs greedy" value={`+${data.upliftVsGreedyPercent}%`} />
          </div>
          <Glass i={6} tone="green">
            <div className="h">Three ways to spend the shift</div>
            <div className="stack" style={{ gap: 10 }}>
              {bars.map(([label, value, tone], k) => (
                <div key={label}><div className="between small"><span className="muted">{label}</span><span className="num strong">{inr(value)}</span></div><Meter value={value} max={max} tone={tone} i={6 + k} /></div>
              ))}
            </div>
          </Glass>
          <div className="faint rise" style={{ ['--i' as string]: 9, padding: '0 4px' }}>{data.model.method}, {data.model.states} states with {data.model.actionsPerState} actions each. Demand is simulated; treat the plan as advice.</div>
        </div>
      </div>
    </Shell>
  );
}
