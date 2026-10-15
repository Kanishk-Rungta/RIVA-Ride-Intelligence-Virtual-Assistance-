'use client';

import { useTheme, useWidgetSDK } from '@nitrostack/widgets';

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
  model: { method: string; states: number; actionsPerState: number; assumptions: string[] };
}

export default function ShiftPlan() {
  const theme = useTheme();
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<ShiftPlanData>();
  const isDark = theme === 'dark';

  const bg = isDark ? '#111318' : '#f7f8fa';
  const cardBg = isDark ? '#1c1f26' : '#ffffff';
  const text = isDark ? '#f2f3f5' : '#15181e';
  const muted = isDark ? 'rgba(242,243,245,0.62)' : 'rgba(21,24,30,0.6)';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  if (!data) return <div style={{ padding: 24, color: text, background: bg }}>Planning your shift…</div>;

  const e = data.expectedEarnings;
  const max = Math.max(e.optimal, e.greedy, e.stayPut, 1);
  const bars: Array<[string, number, string]> = [
    ['Optimal (MDP)', e.optimal, '#22c55e'],
    ['Greedy', e.greedy, '#f59e0b'],
    ['Stay put', e.stayPut, '#9ca3af'],
  ];

  return (
    <div style={{ padding: 20, background: bg, borderRadius: 18, maxWidth: 440, fontFamily: 'system-ui, -apple-system, sans-serif', color: text }}>
      <div style={{ fontSize: 14, fontWeight: 700 }}>Shift plan · {data.hours} hours from {data.startTime}</div>
      <div style={{ fontSize: 12, color: muted, marginTop: 2, marginBottom: 12 }}>
        Starting zone: {data.startZone}
        {data.snappedFromKm > 0.3 ? ` (${data.snappedFromKm} km from you)` : ''}
      </div>

      <div style={{ background: 'linear-gradient(135deg, #5b8def 0%, #3f6fd6 100%)', color: 'white', borderRadius: 14, padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 11, opacity: 0.85 }}>DO THIS NOW</div>
        <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{data.firstMove}</div>
      </div>

      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 14, padding: 12, marginBottom: 12 }}>
        {data.itinerary.map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderTop: i ? `1px solid ${border}` : undefined, fontSize: 12 }}>
            <span style={{ minWidth: 62, color: muted }}>{step.time}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{step.action}</div>
              <div style={{ color: muted, marginTop: 2 }}>
                ~{step.expectedTrips} trips · ₹{step.expectedEarningThisHour} expected
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 14, padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Expected net over the shift</div>
        {bars.map(([label, value, color]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12 }}>
            <span style={{ minWidth: 92, color: muted }}>{label}</span>
            <div style={{ flex: 1, height: 10, borderRadius: 5, background: border }}>
              <div style={{ width: `${(value / max) * 100}%`, height: 10, borderRadius: 5, background: color }} />
            </div>
            <strong style={{ minWidth: 48, textAlign: 'right' }}>₹{value}</strong>
          </div>
        ))}
        <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>
          +{data.upliftVsStayPutPercent}% vs staying put · +{data.upliftVsGreedyPercent}% vs greedy
        </div>
      </div>

      <div style={{ fontSize: 11, color: muted, marginTop: 10, lineHeight: 1.5 }}>
        {data.model.method}: {data.model.states} states × {data.model.actionsPerState} actions. Simulated demand — advisory only.
      </div>
    </div>
  );
}
