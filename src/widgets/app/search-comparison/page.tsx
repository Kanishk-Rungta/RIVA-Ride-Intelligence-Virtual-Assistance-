'use client';

import { useEffect, useState } from 'react';
import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Meter, Note, Pill, Shell, type Tone } from '../../components/ui';
import { Slider } from '../../components/charts';

interface Strategy {
  strategy: 'bfs' | 'ucs' | 'greedy' | 'astar';
  label: string;
  nodeIds: string[];
  distanceKm: number;
  durationMinutes: number;
  optimal: boolean;
  nodesExpanded: number;
  expandedOrder: string[];
}

interface Data {
  origin: { node: string };
  destination: { node: string };
  objective: 'time' | 'distance';
  time: string;
  results: Strategy[];
  alternativeObjective: { objective: string; distanceKm: number; durationMinutes: number };
  insight: string;
  heuristic: string;
  graph: { nodes: Array<{ id: string; name: string; lat: number; lng: number }>; edges: Array<{ from: string; to: string; roadClass: string }> };
}

const TONE: Record<string, Tone> = { bfs: 'violet', ucs: 'slate', greedy: 'amber', astar: 'teal' };
const BLURB: Record<string, string> = {
  bfs: 'Fewest road segments, blind to travel time.',
  ucs: 'Always extends the cheapest path so far.',
  greedy: 'Heads for the goal and ignores what it cost.',
  astar: 'Cost so far plus an estimate of what is left.',
};
const W = 420, H = 310, PAD = 20;

export default function SearchComparison() {
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<Data>();
  const [pick, setPick] = useState('astar');
  const [step, setStep] = useState<number | null>(null);
  const [playing, setPlaying] = useState(true);
  const [hoverNode, setHoverNode] = useState<string | null>(null);

  const sel = data?.results.find((r) => r.strategy === pick) ?? data?.results[0];
  const max = sel?.expandedOrder.length ?? 0;
  const shown = step ?? max;
  useEffect(() => {
    if (!sel || !playing) return;
    if (step === null) { setStep(0); return; }
    if (step >= max) { setPlaying(false); return; }
    const id = setTimeout(() => setStep(step + 1), 190);
    return () => clearTimeout(id);
  }, [sel, playing, step, max]);

  if (!data || !sel) return <Loading label="Expanding the search frontier…" />;

  const lat = data.graph.nodes.map((n) => n.lat), lng = data.graph.nodes.map((n) => n.lng);
  const [a, b, c, d] = [Math.min(...lat), Math.max(...lat), Math.min(...lng), Math.max(...lng)];
  const pos = new Map(data.graph.nodes.map((n) => [n.id, { x: PAD + ((n.lng - c) / (d - c)) * (W - 2 * PAD), y: PAD + ((b - n.lat) / (b - a)) * (H - 2 * PAD), name: n.name }]));
  const done = shown >= max;
  const reached = new Map(sel.expandedOrder.slice(0, shown).map((id, k) => [id, k + 1]));
  const path = new Set(sel.nodeIds.slice(0, -1).map((id, k) => [id, sel.nodeIds[k + 1]].sort().join('|')));
  const colour = `var(--${TONE[sel.strategy]})`;
  const maxExp = Math.max(...data.results.map((r) => r.nodesExpanded), 1);
  const unit = data.objective === 'time' ? 'min' : 'km';
  const choose = (s: string) => { setPick(s); setStep(0); setPlaying(true); };

  return (
    <Shell title={`${data.origin.node.split(',')[0]} to ${data.destination.node.split(',')[0]}`} subtitle={`Watch each strategy search for the ${data.objective === 'time' ? 'fastest' : 'shortest'} route, departing ${data.time}`} width={760}>
      <div className="split">
        <Glass i={1} tone={TONE[sel.strategy]} style={{ padding: 10 }}>
          <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${sel.label} exploring the road graph`}>
            {data.graph.edges.map((e) => {
              const p = pos.get(e.from)!, q = pos.get(e.to)!;
              const hot = done && path.has([e.from, e.to].sort().join('|'));
              return <line key={e.from + e.to} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={hot ? colour : 'var(--ink-3)'} strokeOpacity={hot ? 1 : 0.3} strokeWidth={hot ? 5 : e.roadClass === 'highway' ? 2.2 : 1.2} strokeLinecap="round" strokeDasharray={!hot && e.roadClass === 'local' ? '3 4' : undefined} style={{ transition: 'stroke .4s, stroke-width .4s', filter: hot ? `drop-shadow(0 0 6px ${colour})` : undefined }} />;
            })}
            {data.graph.nodes.map((n) => {
              const p = pos.get(n.id)!;
              const end = n.id === sel.nodeIds[0] || n.id === sel.nodeIds.at(-1);
              const order = reached.get(n.id);
              const latest = order === shown;
              return (
                <g key={n.id} onMouseEnter={() => setHoverNode(n.id)} onMouseLeave={() => setHoverNode(null)} style={{ cursor: 'pointer' }}>
                  {latest && !done ? <circle cx={p.x} cy={p.y} r="14" fill="none" stroke={colour} strokeWidth="2" className="ping" /> : null}
                  <circle cx={p.x} cy={p.y} r={end ? 9 : order ? 7 : 4.5} fill={end || order ? colour : 'var(--base)'} fillOpacity={end ? 1 : order ? 0.7 : 1} stroke={end ? '#fff' : 'var(--ink-3)'} strokeWidth={end ? 2.5 : 1} style={{ transition: 'r .3s, fill .3s' }} />
                  {order && !end ? <text x={p.x} y={p.y + 3} textAnchor="middle" style={{ fill: '#0d0f24', fontSize: 8, fontWeight: 800 }}>{order}</text> : null}
                  {end || hoverNode === n.id ? <text x={p.x > W / 2 ? p.x - 12 : p.x + 12} y={p.y - 11} textAnchor={p.x > W / 2 ? 'end' : 'start'} style={{ fill: 'var(--ink)', fontSize: 11, fontWeight: 800 }}>{n.name.split(',')[0].replace('International ', '')}</text> : null}
                </g>
              );
            })}
          </svg>
          <div className="row" style={{ padding: '2px 6px 0', gap: 12 }}>
            <button className="btn" onClick={() => { if (done) setStep(0); setPlaying(!playing || done); }}>{playing && !done ? 'Pause' : done ? 'Replay' : 'Play'}</button>
            <div style={{ flex: 1 }}><Slider label="Junctions expanded" value={shown} min={0} max={Math.max(max, 1)} tone={TONE[sel.strategy]} onChange={(v) => { setPlaying(false); setStep(v); }} format={(v) => `${v} of ${max}`} /></div>
          </div>
        </Glass>
        <div className="stack" style={{ gap: 9 }}>
          {data.results.map((r, k) => (
            <Glass key={r.strategy} i={2 + k} tone={TONE[r.strategy]} lift tight active={r.strategy === sel.strategy} onClick={() => choose(r.strategy)}>
              <div className="between"><span className="strong">{r.label}</span><Pill tone={r.optimal ? 'green' : 'rose'}>{r.optimal ? 'Optimal' : 'Suboptimal'}</Pill></div>
              <div className="faint" style={{ margin: '2px 0 4px' }}>{BLURB[r.strategy]}</div>
              <div className="between" style={{ margin: '4px 0' }}><span className="num mid accent">{data.objective === 'time' ? r.durationMinutes : r.distanceKm} {unit}</span><span className="faint">{r.nodesExpanded} expanded</span></div>
              <Meter value={r.nodesExpanded} max={maxExp} tone={TONE[r.strategy]} i={2 + k} />
            </Glass>
          ))}
        </div>
      </div>
      <div className="rise" style={{ ['--i' as string]: 7 }}><Note tone="green" icon="✓">{data.insight}</Note></div>
      <div className="faint rise" style={{ ['--i' as string]: 8, padding: '0 4px' }}>{data.heuristic} Optimising for {data.alternativeObjective.objective} instead gives {data.alternativeObjective.distanceKm} km in {data.alternativeObjective.durationMinutes} min.</div>
    </Shell>
  );
}
