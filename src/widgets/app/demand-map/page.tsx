'use client';

import { useState } from 'react';
import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Pill, Shell, Stat, cap, type Tone } from '../../components/ui';
import { AreaChart, CountUp, Gauge, Slider, projector } from '../../components/charts';

type Level = 'HIGH' | 'MEDIUM' | 'LOW';
interface Place {
  destination: { formattedAddress: string };
  matchedZone: string | null;
  time: string;
  hour?: number;
  demandLevel: Level;
  demandScore?: number;
  hourlyScores?: number[];
  expectedRideAvailability: string;
  expectedWaitingMinutes: number;
  returnProbability: number;
  explanation: string;
}
interface Zone { zoneName: string; coordinates: { lat: number; lng: number }; distanceFromCurrentKm: number; demandLevel: Level; demandScore: number; reasoning: string }
interface Zones { currentLocation: { formattedAddress: string; coordinates: { lat: number; lng: number } }; time: string; topRecommendation: Zone | null; alternatives: Zone[] }

const TONE: Record<Level, Tone> = { HIGH: 'green', MEDIUM: 'amber', LOW: 'rose' };
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`;
const levelOf = (s: number): Level => (s >= 62 ? 'HIGH' : s >= 38 ? 'MEDIUM' : 'LOW');

export default function DemandMap() {
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<Place | Zones>();
  const [hover, setHover] = useState<number | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [pick, setPick] = useState(0);
  if (!data) return <Loading label="Reading demand across the city…" />;

  if ('topRecommendation' in data) {
    const zones = [data.topRecommendation, ...data.alternatives].filter(Boolean) as Zone[];
    const project = projector([data.currentLocation.coordinates, ...zones.map((z) => z.coordinates)], 440, 300, 40);
    const me = project(data.currentLocation.coordinates);
    const focus = zones[pick];
    return (
      <Shell title="Where to head next" subtitle={`From ${data.currentLocation.formattedAddress}, ${data.time}`} width={740}>
        <div className="split">
          <Glass i={1} tone={TONE[focus.demandLevel]} style={{ padding: 10 }}>
            <svg className="chart" viewBox="0 0 440 300" role="img" aria-label="Map of recommended zones">
              {zones.map((z, k) => { const p = project(z.coordinates); return <line key={z.zoneName} x1={me.x} y1={me.y} x2={p.x} y2={p.y} stroke={`var(--${TONE[z.demandLevel]})`} strokeWidth={k === pick ? 3 : 1.5} strokeDasharray="6 5" strokeOpacity={k === pick ? 1 : 0.4} />; })}
              <circle cx={me.x} cy={me.y} r="22" fill="var(--teal)" fillOpacity="0.15" className="ping" /><circle cx={me.x} cy={me.y} r="8" fill="var(--teal)" stroke="#fff" strokeWidth="3" />
              <text x={me.x} y={me.y + 24} textAnchor="middle" style={{ fill: 'var(--ink)', fontWeight: 800 }}>You</text>
              {zones.map((z, k) => {
                const p = project(z.coordinates);
                const r = 14 + (z.demandScore / 100) * 24;
                return (
                  <g key={z.zoneName} className={`hit pop ${pick === k ? 'on' : ''}`} style={{ ['--i' as string]: k } as React.CSSProperties} onClick={() => setPick(k)}>
                    <circle cx={p.x} cy={p.y} r={r} fill={`var(--${TONE[z.demandLevel]})`} fillOpacity="0.28" stroke={`var(--${TONE[z.demandLevel]})`} strokeWidth="2.5" />
                    <text x={p.x} y={p.y + 4} textAnchor="middle" style={{ fill: 'var(--ink)', fontWeight: 800, fontSize: 12 }}>{z.demandScore}</text>
                    <text x={p.x} y={p.y + r + 13} textAnchor="middle" style={{ fill: 'var(--ink-2)' }}>{z.zoneName}</text>
                  </g>
                );
              })}
            </svg>
            <div className="faint" style={{ padding: '0 6px' }}>Bubble size and number show the demand score out of 100. Tap a zone.</div>
          </Glass>
          <div className="stack">
            {zones.map((z, k) => (
              <Glass key={z.zoneName} i={2 + k} tone={k === 0 ? 'green' : TONE[z.demandLevel]} lift active={pick === k} onClick={() => setPick(k)}>
                <div className="between"><div><div className="strong">{z.zoneName}</div><div className="faint">{z.distanceFromCurrentKm} km away</div></div>
                  <div className="row">{k === 0 ? <Pill tone="green" solid>Best move</Pill> : null}<Pill tone={TONE[z.demandLevel]}>{cap(z.demandLevel)}</Pill></div></div>
                {pick === k ? <div className="small muted" style={{ marginTop: 8 }}>{z.reasoning}</div> : null}
              </Glass>
            ))}
          </div>
        </div>
      </Shell>
    );
  }

  const scores = data.hourlyScores;
  const hour = data.hour ?? 18;
  const at = hover ?? sel ?? hour;
  const score = scores ? scores[at] : data.demandScore ?? 50;
  const lvl = levelOf(score);
  return (
    <Shell title={`Demand at ${data.matchedZone ?? data.destination.formattedAddress}`} subtitle={`Estimated for ${data.time}`} width={720}>
      <div className="split">
        <Glass i={1} tone={TONE[data.demandLevel]} hero>
          <div className="small">Demand right now</div>
          <div className="num big" style={{ fontSize: 34 }}>{cap(data.demandLevel)}</div>
          <div className="chips" style={{ marginTop: 8 }}><span className="pill solid" style={{ background: 'rgba(255,255,255,.22)' }}>{cap(data.expectedRideAvailability)} rides</span></div>
          <div className="small" style={{ marginTop: 10, opacity: 0.92 }}>{data.explanation}</div>
        </Glass>
        <Glass i={2} tone={TONE[lvl]}>
          <div className="h">Demand at {hourLabel(at)}</div>
          <Gauge value={score} min={0} max={100} label="Demand score" valueLabel={`${score} of 100`} zones={[{ to: 38, tone: 'rose' }, { to: 62, tone: 'amber' }, { to: 100, tone: 'green' }]} />
        </Glass>
      </div>
      {scores ? (
        <Glass i={3} tone="teal">
          <div className="between" style={{ flexWrap: 'wrap' }}><div className="h" style={{ margin: 0 }}>Demand through the day</div><Pill tone={TONE[lvl]}>{hourLabel(at)}: {cap(lvl)}</Pill></div>
          <div style={{ margin: '10px 0' }}>
            <AreaChart values={scores} labels={scores.map((_, h) => hourLabel(h))} format={(v) => `${v}`} tone="teal" marker={hour} markerLabel={`Now ${hourLabel(hour)}`} active={hover ?? sel} onActive={setHover} yMin={0} ariaLabel="Demand score for each hour of the day" />
          </div>
          <Slider label="Check another hour" value={sel ?? hour} min={0} max={23} onChange={setSel} format={hourLabel} />
        </Glass>
      ) : null}
      <div className="g2">
        <Stat i={4} tone="teal" label="Expected wait" value={<CountUp value={data.expectedWaitingMinutes} format={(n) => `${Math.round(n)} min`} />} />
        <Stat i={5} tone="violet" label="Return-ride chance" value={<CountUp value={data.returnProbability * 100} format={(n) => `${Math.round(n)}%`} />} />
      </div>
    </Shell>
  );
}
