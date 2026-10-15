'use client';

import { useTheme, useWidgetState, useWidgetSDK } from '@nitrostack/widgets';

interface StrategyResult {
  strategy: 'bfs' | 'ucs' | 'greedy' | 'astar';
  label: string;
  via: string[];
  nodeIds: string[];
  distanceKm: number;
  durationMinutes: number;
  cost: number;
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
  alternativeObjective: { objective: string; distanceKm: number; durationMinutes: number; via: string[] };
  insight: string;
  heuristic: string;
  graph: {
    nodes: Array<{ id: string; name: string; lat: number; lng: number }>;
    edges: Array<{ from: string; to: string; roadClass: 'highway' | 'arterial' | 'local' }>;
  };
}

const STRATEGY_COLOR: Record<string, string> = { bfs: '#8b5cf6', ucs: '#0ea5e9', greedy: '#f59e0b', astar: '#22c55e' };
const W = 420;
const H = 300;
const PAD = 16;

export default function SearchComparison() {
  const theme = useTheme();
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<SearchComparisonData>();
  const [state, setState] = useWidgetState<{ selected: string }>(() => ({ selected: 'astar' }));
  const isDark = theme === 'dark';

  const bg = isDark ? '#111318' : '#f7f8fa';
  const cardBg = isDark ? '#1c1f26' : '#ffffff';
  const text = isDark ? '#f2f3f5' : '#15181e';
  const muted = isDark ? 'rgba(242,243,245,0.62)' : 'rgba(21,24,30,0.6)';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  if (!data) return <div style={{ padding: 24, color: text, background: bg }}>Running search strategies…</div>;

  const selected = data.results.find((r) => r.strategy === (state?.selected ?? 'astar')) ?? data.results[0];
  const lats = data.graph.nodes.map((n) => n.lat);
  const lngs = data.graph.nodes.map((n) => n.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const xy = (id: string) => {
    const n = data.graph.nodes.find((g) => g.id === id)!;
    return { x: PAD + ((n.lng - minLng) / (maxLng - minLng)) * (W - 2 * PAD), y: PAD + ((maxLat - n.lat) / (maxLat - minLat)) * (H - 2 * PAD) };
  };
  const expanded = new Set(selected.expandedOrder);
  const onPath = new Set(selected.nodeIds.slice(0, -1).map((id, i) => `${id}|${selected.nodeIds[i + 1]}`));
  const maxExpanded = Math.max(...data.results.map((r) => r.nodesExpanded), 1);
  const unit = data.objective === 'time' ? 'min' : 'km';

  return (
    <div style={{ padding: 20, background: bg, borderRadius: 18, maxWidth: 460, fontFamily: 'system-ui, -apple-system, sans-serif', color: text }}>
      <div style={{ fontSize: 14, fontWeight: 700 }}>
        {data.origin.node} → {data.destination.node}
      </div>
      <div style={{ fontSize: 12, color: muted, marginTop: 2, marginBottom: 12 }}>
        Minimising {data.objective === 'time' ? 'travel time' : 'distance'} · departing {data.time} · 32-junction Coimbatore road graph
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', background: cardBg, borderRadius: 14, border: `1px solid ${border}` }}>
        {data.graph.edges.map((e) => {
          const a = xy(e.from);
          const b = xy(e.to);
          const hot = onPath.has(`${e.from}|${e.to}`) || onPath.has(`${e.to}|${e.from}`);
          return (
            <line
              key={`${e.from}-${e.to}`}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={hot ? STRATEGY_COLOR[selected.strategy] : isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)'}
              strokeWidth={hot ? 4 : e.roadClass === 'highway' ? 2 : 1}
              strokeDasharray={e.roadClass === 'local' && !hot ? '3 3' : undefined}
            />
          );
        })}
        {data.graph.nodes.map((n) => {
          const p = xy(n.id);
          const endpoint = n.id === selected.nodeIds[0] || n.id === selected.nodeIds.at(-1);
          return (
            <g key={n.id}>
              <circle
                cx={p.x} cy={p.y} r={endpoint ? 7 : 4.5}
                fill={endpoint ? STRATEGY_COLOR[selected.strategy] : expanded.has(n.id) ? `${STRATEGY_COLOR[selected.strategy]}99` : cardBg}
                stroke={isDark ? '#9aa1ad' : '#6b7280'} strokeWidth={1}
              >
                <title>{n.name}{expanded.has(n.id) ? ` — expanded #${selected.expandedOrder.indexOf(n.id) + 1}` : ''}</title>
              </circle>
              {endpoint && (
                <text x={p.x > W / 2 ? p.x - 9 : p.x + 9} y={p.y + 4} textAnchor={p.x > W / 2 ? 'end' : 'start'} fontSize={10} fill={text} fontWeight={600}>
                  {n.name.split(',')[0].replace('International ', '')}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div style={{ fontSize: 11, color: muted, marginTop: 6 }}>
        Filled nodes were expanded by {selected.label}; the coloured line is the path it returned. Tap a strategy below.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {data.results.map((r) => (
          <div
            key={r.strategy}
            onClick={() => setState({ selected: r.strategy })}
            style={{
              background: cardBg,
              border: r.strategy === selected.strategy ? `1.5px solid ${STRATEGY_COLOR[r.strategy]}` : `1px solid ${border}`,
              borderRadius: 12,
              padding: '10px 12px',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ fontWeight: 700 }}>
                <span style={{ color: STRATEGY_COLOR[r.strategy] }}>●</span> {r.label}
              </span>
              <span>
                <strong>{data.objective === 'time' ? r.durationMinutes : r.distanceKm} {unit}</strong>{' '}
                <span style={{ fontSize: 11, color: r.optimal ? '#22c55e' : '#ef4444' }}>{r.optimal ? 'optimal' : 'suboptimal'}</span>
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: border }}>
                <div style={{ width: `${(r.nodesExpanded / maxExpanded) * 100}%`, height: 6, borderRadius: 3, background: STRATEGY_COLOR[r.strategy] }} />
              </div>
              <span style={{ fontSize: 11, color: muted, minWidth: 92, textAlign: 'right' }}>{r.nodesExpanded} nodes expanded</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)', fontSize: 12, lineHeight: 1.5 }}>
        {data.insight}
      </div>
      <div style={{ fontSize: 11, color: muted, marginTop: 8, lineHeight: 1.5 }}>
        {data.heuristic}
        <br />
        Optimising for {data.alternativeObjective.objective} instead gives {data.alternativeObjective.distanceKm} km / {data.alternativeObjective.durationMinutes} min.
      </div>
    </div>
  );
}
