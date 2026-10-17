'use client';

import { useState } from 'react';
import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Note, Shell, Stat, inr } from '../../components/ui';
import { CountUp, Segmented, projector } from '../../components/charts';

interface Stop { formattedAddress: string; coordinates: { lat: number; lng: number } }
interface Data {
  stops: Stop[];
  legs: Array<{ from: string; to: string; distanceKm: number; durationMinutes: number; fare: number }>;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  estimatedFare: number;
  optimization?: { algorithm: string; originalOrder: string[]; optimizedOrder: string[]; originalEstimateMinutes: number; optimizedEstimateMinutes: number; savedMinutes: number; statesExpanded: number };
}

const W = 480, H = 330;
const short = (s: string) => s.split(',')[0].replace('Coimbatore International ', '').replace('Amrita Vishwa Vidyapeetham', 'Amrita');

export default function RideMap() {
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<Data>();
  const [view, setView] = useState<'best' | 'typed'>('best');
  const [leg, setLeg] = useState<number | null>(null);
  const [stop, setStop] = useState<number | null>(null);
  if (!data) return <Loading label="Finding the best order for your stops…" />;

  const o = data.optimization;
  const byName = new Map(data.stops.map((s) => [s.formattedAddress, s]));
  const order = (names: string[]) => names.map((n) => byName.get(n)!).filter(Boolean);
  const best = data.stops;
  const typed = o ? order(o.originalOrder) : best;
  const project = projector(best.map((s) => s.coordinates), W, H, 46);
  const pts = (list: Stop[]) => list.map((s) => project(s.coordinates));
  const line = (list: Stop[]) => pts(list).map((p, k) => `${k ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
  const shown = view === 'best' || !o ? best : typed;
  const other = view === 'best' ? typed : best;

  return (
    <Shell title="Multi-stop trip" subtitle={`${data.stops.length} stops, ${data.legs.length} legs`} width={740}>
      <div className="g3">
        <Stat i={1} tone="teal" label="Distance" value={<CountUp value={data.totalDistanceKm} format={(n) => `${n.toFixed(1)} km`} />} />
        <Stat i={2} tone="violet" label="Drive time" value={`${data.totalDurationMinutes} min`} />
        <Stat i={3} tone="amber" label="Estimated fare" value={<CountUp value={data.estimatedFare} format={inr} />} />
      </div>
      {o ? <div className="rise" style={{ ['--i' as string]: 4 }}><Note tone="green" icon="✓">{o.savedMinutes > 0 ? <><b>Reordering saves about {o.savedMinutes} min</b> ({o.originalEstimateMinutes} to {o.optimizedEstimateMinutes} min). </> : <><b>Your order was already the fastest.</b> </>}{o.algorithm}, {o.statesExpanded} states expanded.</Note></div> : null}

      <Glass i={5} tone="teal" style={{ padding: 10 }}>
        {o ? (
          <div className="between" style={{ margin: '2px 4px 8px', flexWrap: 'wrap', gap: 8 }}>
            <Segmented label="Order" value={view} onChange={setView} options={[{ value: 'best', label: `Best order, ${o.optimizedEstimateMinutes} min` }, { value: 'typed', label: `As you typed, ${o.originalEstimateMinutes} min` }]} />
          </div>
        ) : null}
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Schematic map of the trip">
          {o ? <path d={line(other)} fill="none" stroke="var(--ink-3)" strokeOpacity="0.45" strokeWidth="2.5" strokeDasharray="6 6" /> : null}
          <path id="route-path" key={view} d={line(shown)} pathLength={1} className="draw" fill="none" stroke={view === 'best' ? 'var(--teal)' : 'var(--amber)'} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 4px 8px rgba(13,158,147,.5))' }} />
          {pts(shown).map((p, k, a) => {
            if (!k) return null;
            if (Math.hypot(p.x - a[k - 1].x, p.y - a[k - 1].y) < 80) return null;
            const mid = { x: (p.x + a[k - 1].x) / 2, y: (p.y + a[k - 1].y) / 2 };
            return <g key={`l${k}`} style={{ opacity: leg === null || leg === k - 1 ? 1 : 0.3, transition: 'opacity .2s' }}><rect x={mid.x - 25} y={mid.y - 10} width="50" height="20" rx="10" fill="var(--glass-hi)" stroke="var(--edge-dim)" /><text x={mid.x} y={mid.y + 4} textAnchor="middle" style={{ fill: 'var(--ink)', fontWeight: 800 }}>{view === 'best' && data.legs[k - 1] ? `${data.legs[k - 1].durationMinutes} min` : `leg ${k}`}</text></g>;
          })}
          <circle r="7" fill="#fff" stroke="var(--violet)" strokeWidth="4"><animateMotion key={view} dur="6s" repeatCount="indefinite" path={line(shown)} /></circle>
          {shown.map((s, k) => {
            const p = project(s.coordinates);
            const end = k === shown.length - 1;
            const c = k === 0 ? 'var(--teal)' : end ? 'var(--rose)' : 'var(--violet)';
            return (
              <g key={s.formattedAddress} className={`hit pop ${stop === k ? 'on' : ''}`} style={{ ['--i' as string]: k } as React.CSSProperties} onMouseEnter={() => setStop(k)} onMouseLeave={() => setStop(null)}>
                <circle cx={p.x} cy={p.y} r="13" fill={c} stroke="#fff" strokeWidth="3" />
                <text x={p.x} y={p.y + 4} textAnchor="middle" style={{ fill: '#0d0f24', fontSize: 12, fontWeight: 800 }}>{k === 0 ? 'A' : end ? '★' : k}</text>
              </g>
            );
          })}
        </svg>
        <div className="chips" style={{ padding: '8px 6px 2px' }}>
          {shown.map((s, k) => (
            <span key={s.formattedAddress} className={`pill tone-${k === 0 ? 'teal' : k === shown.length - 1 ? 'rose' : 'violet'}${stop === k ? ' solid' : ''}`} style={{ cursor: 'pointer' }} onMouseEnter={() => setStop(k)} onMouseLeave={() => setStop(null)}>
              {k === 0 ? 'A' : k === shown.length - 1 ? '★' : k} {short(s.formattedAddress)}
            </span>
          ))}
        </div>
        <div className="faint" style={{ padding: '4px 6px 0' }}>Schematic, straight lines between stops. The dashed line is the other order.</div>
      </Glass>

      {view === 'best' ? (
        <div className="g2">
          {data.legs.map((l, k) => (
            <Glass key={k} i={6 + k} tone="teal" tight lift active={leg === k} onClick={() => setLeg(leg === k ? null : k)}>
              <div className="between"><div><div className="strong">{short(l.from)} to {short(l.to)}</div><div className="faint">{l.distanceKm} km, {l.durationMinutes} min</div></div><span className="num mid accent">{inr(l.fare)}</span></div>
            </Glass>
          ))}
        </div>
      ) : null}
    </Shell>
  );
}
