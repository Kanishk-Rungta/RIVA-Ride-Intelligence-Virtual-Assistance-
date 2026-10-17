'use client';

import { useState } from 'react';
import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Mark, Note, Pill, Route, Shell, cap, inr } from '../../components/ui';
import { CountUp, Segmented, Slider } from '../../components/charts';

interface Option {
  optionId: string;
  provider: 'uber' | 'ola' | 'rapido';
  providerName: string;
  vehicleType: string;
  fare: number;
  pickupEtaMinutes: number;
  tripDurationMinutes: number;
  distanceKm: number;
  availability: boolean;
  isSimulated: boolean;
  rating: number;
  hasFemaleDriverOption: boolean;
  luggageFriendly: boolean;
  surgeMultiplier: number;
  notes?: string;
  scoreReason: string;
  paretoOptimal?: boolean;
}

interface Data {
  origin: { formattedAddress: string };
  destination: { formattedAddress: string };
  route: { distanceKm: number; durationMinutes: number; source: 'live' | 'road_graph' | 'estimated'; via?: string[]; search?: { nodesExpanded: number } };
  rankingMode: string;
  totalOptionsFound: number;
  options: Option[];
  utilityWeights?: { fare: number; pickupEta: number; rating: number };
  constraints?: { relaxed: string[]; unsatisfiableHard: string | null; note?: string };
}

type Mode = 'best_value' | 'cheapest' | 'fastest';
const DOT: Record<string, string> = { uber: '#c9cdf7', ola: '#a4c21b', rapido: '#f5b700' };
const SOURCE = { live: 'Live route', road_graph: 'A* road-graph route', estimated: 'Straight-line estimate' };

function rankBy(options: Option[], mode: Mode, w: { fare: number; pickupEta: number; rating: number }) {
  const live = options.filter((o) => o.availability);
  const maxFare = Math.max(...live.map((o) => o.fare), 1);
  const maxEta = Math.max(...live.map((o) => o.pickupEtaMinutes), 1);
  const score = (o: Option) =>
    mode === 'cheapest' ? o.fare : mode === 'fastest' ? o.pickupEtaMinutes + o.tripDurationMinutes : w.fare * (o.fare / maxFare) + w.pickupEta * (o.pickupEtaMinutes / maxEta) + w.rating * (1 - o.rating / 5);
  return [...options].sort((a, b) => Number(!a.availability) - Number(!b.availability) || score(a) - score(b));
}

export default function RideComparison() {
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<Data>();
  const [mode, setMode] = useState<Mode>('best_value');
  const [budget, setBudget] = useState<number | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  if (!data) return <Loading label="Asking Uber, Ola and Rapido for quotes…" />;

  const w = data.utilityWeights ?? { fare: 0.45, pickupEta: 0.35, rating: 0.2 };
  const ranked = rankBy(data.options, mode, w);
  const live = ranked.filter((o) => o.availability);
  const minFare = Math.min(...live.map((o) => o.fare));
  const maxFare = Math.max(...live.map((o) => o.fare));
  const limit = budget ?? maxFare;
  const within = (o: Option) => o.availability && o.fare <= limit;
  const focus = hover ?? picked;
  const focused = ranked.find((o) => o.optionId === focus) ?? null;
  const best = ranked.find(within) ?? null;

  // Chart geometry: pickup wait on x, fare on y, bubble size = rating.
  const W = 460, H = 250, L = 46, R = 16, T = 16, B = 34;
  const maxEta = Math.max(...live.map((o) => o.pickupEtaMinutes)) + 1;
  const yLo = Math.floor((minFare * 0.9) / 50) * 50;
  const yHi = Math.ceil((maxFare * 1.06) / 50) * 50;
  const x = (v: number) => L + (v / maxEta) * (W - L - R);
  const y = (v: number) => T + (1 - (v - yLo) / (yHi - yLo)) * (H - T - B);
  // Cheapest fare available at each wait time or shorter: the staircase of sensible choices.
  let floor = Infinity;
  const stairs = [...live].sort((a, b) => a.pickupEtaMinutes - b.pickupEtaMinutes || a.fare - b.fare).filter((o) => (o.fare < floor ? ((floor = o.fare), true) : false));
  const stairPath = stairs.map((o, i) => `${i ? `L${x(o.pickupEtaMinutes)} ${y(stairs[i - 1].fare)} L` : 'M'}${x(o.pickupEtaMinutes)} ${y(o.fare)}`).join(' ');

  return (
    <Shell title="Ride comparison" subtitle={`${data.totalOptionsFound} quotes from three platforms`} width={760}>
      <div className="split">
        <Glass i={1} tone="teal" lift>
          <Route from={data.origin.formattedAddress} to={data.destination.formattedAddress} middle={`${data.route.distanceKm.toFixed(1)} km, about ${Math.round(data.route.durationMinutes)} min`} />
          <div className="chips" style={{ marginTop: 10 }}>
            <Pill tone="teal">{SOURCE[data.route.source]}</Pill>
            {data.route.search ? <Pill tone="violet">{data.route.search.nodesExpanded} nodes searched</Pill> : null}
          </div>
        </Glass>
        <Glass i={2} tone="green" hero>
          <div className="small">{best ? 'Top pick within budget' : 'Nothing within budget'}</div>
          <div className="num big"><CountUp value={best?.fare ?? 0} format={(n) => inr(n)} /></div>
          <div className="small">{best ? `${best.providerName} ${best.vehicleType}, pickup in ${best.pickupEtaMinutes} min` : 'Raise the budget slider'}</div>
        </Glass>
      </div>
      {data.constraints?.note ? <div className="rise" style={{ ['--i' as string]: 3 }}><Note tone={data.constraints.unsatisfiableHard ? 'rose' : 'amber'} icon="⚖">{data.constraints.note}</Note></div> : null}

      <Glass i={4} tone="violet">
        <div className="between" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
          <div className="h" style={{ margin: 0 }}>Price against wait</div>
          <Segmented<Mode> label="Rank by" value={mode} onChange={setMode} options={[{ value: 'best_value', label: 'Best value' }, { value: 'cheapest', label: 'Cheapest' }, { value: 'fastest', label: 'Fastest' }]} />
        </div>
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Fare against pickup wait for each ride">
          {Array.from({ length: 4 }, (_, k) => yLo + ((yHi - yLo) * k) / 3).map((v) => (
            <g key={v}><line className="grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} /><text x={L - 8} y={y(v) + 3} textAnchor="end">{inr(v)}</text></g>
          ))}
          {Array.from({ length: maxEta + 1 }, (_, k) => k).filter((k) => k % 2 === 0).map((k) => <text key={k} x={x(k)} y={H - 14} textAnchor="middle">{k}</text>)}
          <text x={(L + W - R) / 2} y={H - 1} textAnchor="middle">Pickup wait (min)</text>
          <rect x={L} y={y(limit)} width={W - L - R} height={Math.max(0, H - B - y(limit))} fill="var(--green)" fillOpacity="0.08" />
          <line x1={L} x2={W - R} y1={y(limit)} y2={y(limit)} stroke="var(--green)" strokeWidth="1.5" strokeDasharray="5 4" />
          <path d={stairPath} pathLength={1} className="draw" fill="none" stroke="var(--violet)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
          {ranked.map((o, k) => {
            const on = within(o);
            const r = 6 + Math.max(0, o.rating - 4) * 9;
            return (
              <g key={o.optionId} className={`hit pop ${focus === o.optionId ? 'on' : ''}${on ? '' : ' dim'}`} style={{ ['--i' as string]: k } as React.CSSProperties}
                onMouseEnter={() => setHover(o.optionId)} onMouseLeave={() => setHover(null)} onClick={() => setPicked(picked === o.optionId ? null : o.optionId)}>
                {o.paretoOptimal ? <circle cx={x(o.pickupEtaMinutes)} cy={y(o.fare)} r={r + 5} fill="none" stroke="var(--violet)" strokeWidth="1.6" strokeDasharray="3 3" /> : null}
                <circle cx={x(o.pickupEtaMinutes)} cy={y(o.fare)} r={r} fill={DOT[o.provider]} fillOpacity={o.availability ? 0.92 : 0.25} stroke="#fff" strokeWidth="2" />
              </g>
            );
          })}
        </svg>
        <div className="legend" style={{ margin: '4px 0 8px' }}>
          {Object.entries(DOT).map(([p, c]) => <span key={p} className="row" style={{ gap: 6 }}><i style={{ background: c, borderRadius: 99 }} />{cap(p)}</span>)}
          <span className="row" style={{ gap: 6 }}><i style={{ background: 'none', border: '2px dashed var(--violet)', borderRadius: 99 }} />Pareto-optimal</span>
          <span className="faint">Bigger bubble = higher rating. The violet line joins the cheapest ride at each wait.</span>
        </div>
        <div className="readout tone-teal" style={{ marginBottom: 12 }}>
          {focused ? (
            <><Mark provider={focused.provider} vehicle={focused.vehicleType} />
              <div><b>{focused.providerName} {focused.vehicleType}</b>, {inr(focused.fare)}, pickup in {focused.pickupEtaMinutes} min, {focused.rating.toFixed(1)}★
                <div className="faint">{focused.paretoOptimal ? 'No other ride beats it on price, wait and rating together.' : 'Another ride is at least as good on every measure.'}</div></div></>
          ) : <span className="muted">Hover or tap a bubble to inspect a ride.</span>}
        </div>
        <Slider label="Budget" value={limit} min={minFare} max={maxFare} step={5} tone="green" onChange={setBudget} format={(v) => `${inr(v)}, ${live.filter((o) => o.fare <= v).length} of ${live.length} rides`} />
      </Glass>

      <div className="g2">
        {ranked.slice(0, 8).map((o, k) => (
          <Glass key={o.optionId} i={5 + k} tone={within(o) && k === ranked.findIndex(within) ? 'green' : 'teal'} lift active={focus === o.optionId || (k === ranked.findIndex(within) && within(o))}
            onClick={() => setPicked(picked === o.optionId ? null : o.optionId)} style={{ opacity: within(o) ? 1 : 0.4 }}>
            <div className="between" onMouseEnter={() => setHover(o.optionId)} onMouseLeave={() => setHover(null)}>
              <div className="row"><Mark provider={o.provider} vehicle={o.vehicleType} /><div><div className="strong">{o.providerName} {o.vehicleType}</div><div className="faint">★ {o.rating.toFixed(1)}, pickup {o.pickupEtaMinutes} min</div></div></div>
              <div style={{ textAlign: 'right' }}><div className="num mid">{inr(o.fare)}</div><div className="faint">#{k + 1}</div></div>
            </div>
            <div className="chips" style={{ marginTop: 8 }}>
              {k === ranked.findIndex(within) && within(o) ? <Pill tone="green" solid>Recommended</Pill> : null}
              {!o.availability ? <Pill tone="rose">Unavailable</Pill> : !within(o) ? <Pill tone="slate">Over budget</Pill> : o.paretoOptimal === false ? <Pill tone="slate">Dominated</Pill> : <Pill tone="violet">Pareto-optimal</Pill>}
              {o.surgeMultiplier > 1.05 ? <Pill tone="amber">Surge {o.surgeMultiplier}×</Pill> : null}
              {o.luggageFriendly ? <Pill tone="teal">Luggage</Pill> : null}
              {o.hasFemaleDriverOption ? <Pill tone="teal">Female driver</Pill> : null}
            </div>
            {picked === o.optionId ? <div className="small muted" style={{ marginTop: 8 }}>{o.scoreReason}. About {o.tripDurationMinutes} min over {o.distanceKm} km{o.isSimulated ? ', simulated quote' : ', live quote'}.{o.notes ? ` ${o.notes}` : ''}</div> : null}
          </Glass>
        ))}
      </div>
    </Shell>
  );
}
