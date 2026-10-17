'use client';

import { useEffect, useState } from 'react';
import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Pill, Shell, inr, type Tone } from '../../components/ui';
import { CountUp } from '../../components/charts';

interface Msg { id: number; t: number; from: string; to: string; performative: string; summary: string }
interface Data {
  protocol: string;
  origin: { formattedAddress: string };
  destination: { formattedAddress: string };
  time: string;
  outcome: { status: 'MATCHED' | 'NO_MATCH'; option: { providerName: string; vehicleType: string; fare: number } | null; driver: { name: string; rating: number } | null; pickupEtaMinutes: number | null; reason: string };
  participants: Array<{ id: string; label: string }>;
  messages: Msg[];
  metrics: { messageCount: number; driverOffers: number; driverAcceptanceRate: number; awards: number; incentiveRounds: number; timeToOutcomeSeconds: number; fleetSize: number };
}

const ACT: Record<string, { label: string; tone: Tone }> = {
  CFP: { label: 'Call for proposals', tone: 'teal' }, PROPOSE: { label: 'Propose', tone: 'green' }, REFUSE: { label: 'Refuse', tone: 'rose' },
  ACCEPT_PROPOSAL: { label: 'Accept', tone: 'violet' }, REJECT_PROPOSAL: { label: 'Reject', tone: 'slate' }, INFORM: { label: 'Inform', tone: 'amber' }, FAILURE: { label: 'Failure', tone: 'rose' },
};
const LANES = [
  { key: 'rider', label: 'Rider', icon: '🧑' }, { key: 'uber', label: 'Uber', icon: '🏢' }, { key: 'ola', label: 'Ola', icon: '🏢' },
  { key: 'rapido', label: 'Rapido', icon: '🏢' }, { key: 'driver', label: 'Drivers', icon: '🚖' },
];
const laneOf = (id: string) => (id.startsWith('rider:') ? 0 : id.startsWith('driver:') ? 4 : LANES.findIndex((l) => l.key === id.replace('provider:', '')));

export default function AgentTrace() {
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<Data>();
  const [step, setStep] = useState<number | null>(null); // number of messages revealed
  const [playing, setPlaying] = useState(true);
  const [hover, setHover] = useState<number | null>(null);

  const total = data?.messages.length ?? 0;
  const shown = step ?? total;
  useEffect(() => {
    if (!data || !playing) return;
    if (step === null) { setStep(0); return; }
    if (step >= total) { setPlaying(false); return; }
    const id = setTimeout(() => setStep(step + 1), 170);
    return () => clearTimeout(id);
  }, [data, playing, step, total]);

  if (!data) return <Loading label="Rider, providers and drivers are negotiating…" />;

  const W = 500, top = 56, rowH = 12.5, left = 40;
  const H = top + total * rowH + 14;
  const laneX = (i: number) => left + ((W - left - 14) / (LANES.length - 1)) * i;
  const cursor = Math.min(shown, total) - 1;
  const current = data.messages[hover ?? Math.max(cursor, 0)];
  const matched = data.outcome.status === 'MATCHED';
  const m = data.metrics;
  const driverName = (id: string) => data.participants.find((p) => p.id === id)?.label.split(' ·')[0] ?? id;
  const who = (id: string) => (id.startsWith('driver:') ? driverName(id) : data.participants.find((p) => p.id === id)?.label ?? id);

  return (
    <Shell title="Agents negotiating your ride" subtitle={`${data.origin.formattedAddress} to ${data.destination.formattedAddress}, ${data.time}`} width={760}>
      <div className="split">
        <Glass i={1} tone={matched ? 'green' : 'rose'} hero>
          <div className="small">{matched ? 'Driver found' : 'No driver found'}</div>
          <div className="mid" style={{ marginTop: 2 }}>{matched && data.outcome.driver && data.outcome.option ? `${data.outcome.driver.name}, ${data.outcome.option.providerName} ${data.outcome.option.vehicleType}` : 'Every award fell through'}</div>
          <div className="small" style={{ marginTop: 6, opacity: 0.92 }}>{data.outcome.reason}</div>
          {matched && data.outcome.option ? <div className="num big" style={{ marginTop: 8 }}><CountUp value={data.outcome.option.fare} format={(n) => inr(n)} /> <span className="small">arrives in {data.outcome.pickupEtaMinutes} min</span></div> : null}
        </Glass>
        <div className="g2">
          <Glass i={2} tone="teal" tight lift className="stat"><div className="label">Messages</div><div className="value"><CountUp value={m.messageCount} /></div></Glass>
          <Glass i={3} tone="amber" tight lift className="stat"><div className="label">Driver offers</div><div className="value"><CountUp value={m.driverOffers} /></div></Glass>
          <Glass i={4} tone="violet" tight lift className="stat"><div className="label">Accepted</div><div className="value"><CountUp value={m.driverAcceptanceRate * 100} format={(n) => `${Math.round(n)}%`} /></div></Glass>
          <Glass i={5} tone="green" tight lift className="stat"><div className="label">Simulated time</div><div className="value">{m.timeToOutcomeSeconds}s</div></Glass>
        </div>
      </div>

      <Glass i={6} tone="violet">
        <div className="between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
          <div><div className="h" style={{ margin: 0 }}>Who said what, in order</div><div className="faint">{data.protocol}</div></div>
          <div className="row">
            <button className="btn" onClick={() => { if (shown >= total) setStep(0); setPlaying(!playing || shown >= total); }}>{playing && shown < total ? 'Pause' : shown >= total ? 'Replay' : 'Play'}</button>
          </div>
        </div>
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sequence diagram of the agent messages">
          {LANES.map((l, i) => (
            <g key={l.key}>
              <line x1={laneX(i)} x2={laneX(i)} y1={top - 12} y2={H - 6} stroke="var(--ink-3)" strokeOpacity="0.28" strokeWidth="2" strokeDasharray="2 5" />
              <rect x={laneX(i) - 32} y={6} width="64" height="34" rx="12" fill="var(--glass-hi)" stroke="var(--edge-dim)" />
              <text x={laneX(i)} y={21} textAnchor="middle" style={{ fontSize: 13 }}>{l.icon}</text>
              <text x={laneX(i)} y={34} textAnchor="middle" style={{ fill: 'var(--ink)', fontWeight: 800 }}>{l.label}</text>
            </g>
          ))}
          {data.messages.map((msg, k) => {
            const a = laneOf(msg.from), b = laneOf(msg.to);
            const y = top + k * rowH;
            const act = ACT[msg.performative] ?? { label: msg.performative, tone: 'slate' as Tone };
            const on = k < shown;
            const x1 = laneX(a), x2 = laneX(b);
            const dir = x2 > x1 ? 1 : -1;
            const c = `var(--${act.tone})`;
            return (
              <g key={msg.id} style={{ opacity: on ? 1 : 0.1, transition: 'opacity .3s', cursor: 'pointer' }} onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)}>
                <rect x={Math.min(x1, x2) - 4} y={y - rowH / 2} width={Math.abs(x2 - x1) + 8} height={rowH} fill="transparent" />
                <line x1={x1} x2={x2 - dir * 5} y1={y} y2={y} stroke={c} strokeWidth={hover === k || cursor === k ? 3.6 : 2.2} strokeLinecap="round" />
                <path d={`M${x2} ${y} l${-dir * 7} -4 l0 8 z`} fill={c} />
                <circle cx={x1} cy={y} r="2.8" fill={c} />
                {k % 4 === 0 ? <text x={4} y={y + 3}>{msg.t.toFixed(1)}s</text> : null}
              </g>
            );
          })}
        </svg>
        <div className="legend" style={{ margin: '6px 0' }}>
          {Object.entries(ACT).map(([k, a]) => <span key={k} className="row" style={{ gap: 5 }}><i style={{ background: `var(--${a.tone})` }} />{a.label}</span>)}
        </div>
        <div className={`readout tone-${(ACT[current.performative] ?? { tone: 'slate' }).tone}`}>
          <Pill tone={(ACT[current.performative] ?? { tone: 'slate' as Tone }).tone} solid>{(ACT[current.performative] ?? { label: current.performative }).label}</Pill>
          <div><b>{who(current.from)}</b> to <b>{who(current.to)}</b> <span className="faint">at {current.t.toFixed(1)}s</span><div className="muted small">{current.summary}</div></div>
        </div>
      </Glass>
      <div className="faint rise" style={{ ['--i' as string]: 8, textAlign: 'center' }}>{m.fleetSize} simulated drivers, {m.awards} award{m.awards === 1 ? '' : 's'}, {m.incentiveRounds} incentive round{m.incentiveRounds === 1 ? '' : 's'}</div>
    </Shell>
  );
}
