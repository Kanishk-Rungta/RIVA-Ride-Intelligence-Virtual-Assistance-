'use client';

import { useWidgetState, useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Meter, Note, Pill, Shell, type Tone } from '../../components/ui';

interface StrategyResult {
  strategy: 'bfs' | 'ucs' | 'greedy' | 'astar';
  label: string;
  nodeIds: string[];
  distanceKm: number;
  durationMinutes: number;
  optimal: boolean;
  nodesExpanded: number;
  nodesGenerated: number;
  expandedOrder: string[];
}

interface SearchComparisonData {
  origin: { node: string };
  destination: { node: string };
  objective: 'time' | 'distance';
  time: string;
  results: StrategyResult[];
  alternativeObjective: { objective: string; distanceKm: number; durationMinutes: number };
  insight: string;
  heuristic: string;
  graph: { nodes: Array<{ id: string; name: string; lat: number; lng: number }>; edges: Array<{ from: string; to: string; roadClass: string }> };
}

const TONE: Record<string, Tone> = { bfs: 'violet', ucs: 'slate', greedy: 'amber', astar: 'teal' };
const W = 400;
const H = 300;
const PAD = 18;

export default function SearchComparison() {
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<SearchComparisonData>();
  const [state, setState] = useWidgetState<{ selected: string }>(() => ({ selected: 'astar' }));
  if (!data) return <Loading label="Expanding the search frontier…" />;

  const sel = data.results.find((r) => r.strategy === (state?.selected ?? 'astar')) ?? data.results[0];
  const lats = data.graph.nodes.map((n) => n.lat);
  const lngs = data.graph.nodes.map((n) => n.lng);
  const [a, b, c, d] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const pos = new Map(data.graph.nodes.map((n) => [n.id, { x: PAD + ((n.lng - c) / (d - c)) * (W - 2 * PAD), y: PAD + ((b - n.lat) / (b - a)) * (H - 2 * PAD), name: n.name }]));
  const expanded = new Set(sel.expandedOrder);
  const onPath = new Set(sel.nodeIds.slice(0, -1).map((id, k) => [id, sel.nodeIds[k + 1]].sort().join('|')));
  const maxExp = Math.max(...data.results.map((r) => r.nodesExpanded), 1);
  const unit = data.objective === 'time' ? 'min' : 'km';
  const colour = `var(--${TONE[sel.strategy]})`;

  return (
    <Shell title={`${data.origin.node.split(',')[0]} to ${data.destination.node.split(',')[0]}`} subtitle={`How RIVA searched for the ${data.objective === 'time' ? 'fastest' : 'shortest'} route, departing ${data.time}`}>
      <div className="split">
        <Glass i={1} tone={TONE[sel.strategy]} style={{ padding: 8 }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${sel.label} on the road graph`}>
            {data.graph.edges.map((e) => {
              const p = pos.get(e.from)!;
              const q = pos.get(e.to)!;
              const hot = onPath.has([e.from, e.to].sort().join('|'));
              return <line key={e.from + e.to} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={hot ? colour : 'var(--ink-3)'} strokeOpacity={hot ? 1 : 0.35}
                strokeWidth={hot ? 4.5 : e.roadClass === 'highway' ? 2 : 1.2} strokeLinecap="round" strokeDasharray={!hot && e.roadClass === 'local' ? '3 4' : undefined}
                style={hot ? { filter: `drop-shadow(0 0 5px ${colour})` } : undefined} />;
            })}
            {data.graph.nodes.map((n) => {
              const p = pos.get(n.id)!;
              const end = n.id === sel.nodeIds[0] || n.id === sel.nodeIds.at(-1);
              const order = sel.expandedOrder.indexOf(n.id);
              return (
                <g key={n.id}>
                  <circle cx={p.x} cy={p.y} r={end ? 8 : 5} fill={end || expanded.has(n.id) ? colour : 'var(--base)'} fillOpacity={end ? 1 : expanded.has(n.id) ? 0.55 : 1}
                    stroke={end ? '#fff' : 'var(--ink-3)'} strokeWidth={end ? 2.5 : 1}>
                    <title>{n.name}{order >= 0 ? `, expanded #${order + 1}` : ''}</title>
                  </circle>
                  {end ? <text x={p.x > W / 2 ? p.x - 4 : p.x + 4} y={p.y - 13} textAnchor={p.x > W / 2 ? 'end' : 'start'} fontSize={11} fontWeight={700} fill="var(--ink)">{n.name.split(',')[0].replace('International ', '')}</text> : null}
                </g>
              );
            })}
          </svg>
          <div className="faint" style={{ padding: '0 8px 4px' }}>Filled junctions were expanded by {sel.label}. The glowing line is the route it returned.</div>
        </Glass>
        <div className="stack" style={{ gap: 9 }}>
          {data.results.map((r, k) => (
            <Glass key={r.strategy} i={2 + k} tone={TONE[r.strategy]} lift tight active={r.strategy === sel.strategy} onClick={() => setState({ selected: r.strategy })}>
              <div className="between">
                <span className="strong">{r.label}</span>
                <Pill tone={r.optimal ? 'green' : 'rose'}>{r.optimal ? 'Optimal' : 'Suboptimal'}</Pill>
              </div>
              <div className="between" style={{ margin: '6px 0' }}>
                <span className="num mid accent">{data.objective === 'time' ? r.durationMinutes : r.distanceKm} {unit}</span>
                <span className="faint">{r.nodesExpanded} expanded</span>
              </div>
              <Meter value={r.nodesExpanded} max={maxExp} tone={TONE[r.strategy]} i={2 + k} />
            </Glass>
          ))}
        </div>
      </div>
      <div className="rise" style={{ ['--i' as string]: 7 }}><Note tone="green" icon="✓">{data.insight}</Note></div>
      <div className="faint rise" style={{ ['--i' as string]: 8, padding: '0 4px' }}>
        {data.heuristic} Optimising for {data.alternativeObjective.objective} instead gives {data.alternativeObjective.distanceKm} km in {data.alternativeObjective.durationMinutes} min.
      </div>
    </Shell>
  );
}
