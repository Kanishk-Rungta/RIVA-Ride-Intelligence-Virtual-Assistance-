'use client';

import { useTheme, useWidgetState, useWidgetSDK } from '@nitrostack/widgets';

interface TraceMessage {
  id: number;
  t: number;
  from: string;
  to: string;
  performative: string;
  conversationId: string;
  summary: string;
}

interface MarketplaceData {
  protocol: string;
  origin: { formattedAddress: string };
  destination: { formattedAddress: string };
  time: string;
  outcome: {
    status: 'MATCHED' | 'NO_MATCH';
    option: { providerName: string; vehicleType: string; fare: number } | null;
    driver: { name: string; rating: number; vehicleType: string; fuelType: string } | null;
    pickupEtaMinutes: number | null;
    incentive: number;
    reason: string;
    relaxedConstraints: string[];
  };
  participants: Array<{ id: string; role: 'rider' | 'provider' | 'driver'; label: string }>;
  messages: TraceMessage[];
  metrics: {
    messageCount: number;
    fleetSize: number;
    driverOffers: number;
    driverAcceptances: number;
    driverAcceptanceRate: number;
    awards: number;
    incentiveRounds: number;
    timeToOutcomeSeconds: number;
  };
}

const PERFORMATIVE_COLOR: Record<string, string> = {
  CFP: '#0ea5e9',
  PROPOSE: '#22c55e',
  REFUSE: '#ef4444',
  ACCEPT_PROPOSAL: '#16a34a',
  REJECT_PROPOSAL: '#9ca3af',
  INFORM: '#a855f7',
  FAILURE: '#dc2626',
};

const ROLE_ICON: Record<string, string> = { rider: '🧑', provider: '🏢', driver: '🚖' };

export default function AgentTrace() {
  const theme = useTheme();
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<MarketplaceData>();
  const [state, setState] = useWidgetState<{ showAll: boolean }>(() => ({ showAll: false }));
  const isDark = theme === 'dark';

  const bg = isDark ? '#111318' : '#f7f8fa';
  const cardBg = isDark ? '#1c1f26' : '#ffffff';
  const text = isDark ? '#f2f3f5' : '#15181e';
  const muted = isDark ? 'rgba(242,243,245,0.62)' : 'rgba(21,24,30,0.6)';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  if (!data) return <div style={{ padding: 24, color: text, background: bg }}>Agents negotiating…</div>;

  const label = (id: string) => {
    const p = data.participants.find((x) => x.id === id);
    const role = id.split(':')[0];
    const name = p ? (role === 'driver' ? p.label.split(' ·')[0] : p.label) : id;
    return `${ROLE_ICON[role] ?? ''} ${name}`;
  };
  const matched = data.outcome.status === 'MATCHED';
  const shown = state?.showAll ? data.messages : data.messages.filter((m) => m.performative !== 'REJECT_PROPOSAL').slice(0, 24);
  const m = data.metrics;

  return (
    <div style={{ padding: 20, background: bg, borderRadius: 18, maxWidth: 480, fontFamily: 'system-ui, -apple-system, sans-serif', color: text }}>
      <div style={{ fontSize: 14, fontWeight: 700 }}>Multi-agent negotiation</div>
      <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>
        {data.origin.formattedAddress} → {data.destination.formattedAddress} · {data.time}
      </div>
      <div style={{ fontSize: 11, color: muted, marginTop: 2, marginBottom: 12 }}>{data.protocol}</div>

      <div
        style={{
          borderRadius: 14,
          padding: 14,
          color: 'white',
          background: matched ? 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)' : 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 11, opacity: 0.85, letterSpacing: 0.4 }}>{matched ? 'MATCHED' : 'NO MATCH'}</div>
        {matched && data.outcome.option && data.outcome.driver ? (
          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>
            {data.outcome.option.providerName} {data.outcome.option.vehicleType} · ₹{data.outcome.option.fare} · {data.outcome.driver.name} {data.outcome.driver.rating}★ in {data.outcome.pickupEtaMinutes} min
          </div>
        ) : null}
        <div style={{ fontSize: 12, marginTop: 4, opacity: 0.92 }}>{data.outcome.reason}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
        {[
          ['Messages', m.messageCount],
          ['Driver offers', m.driverOffers],
          ['Accepted', `${Math.round(m.driverAcceptanceRate * 100)}%`],
          ['Sim. time', `${m.timeToOutcomeSeconds}s`],
        ].map(([k, v]) => (
          <div key={k as string} style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 10, padding: '8px 6px', textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{v}</div>
            <div style={{ fontSize: 10, color: muted }}>{k}</div>
          </div>
        ))}
      </div>

      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 14, padding: '6px 0' }}>
        {shown.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', gap: 8, padding: '6px 12px', fontSize: 12, alignItems: 'flex-start' }}>
            <span style={{ color: muted, minWidth: 40, fontVariantNumeric: 'tabular-nums' }}>{msg.t.toFixed(1)}s</span>
            <div style={{ flex: 1 }}>
              <div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'white',
                    background: PERFORMATIVE_COLOR[msg.performative] ?? '#6b7280',
                    borderRadius: 6,
                    padding: '1px 6px',
                    marginRight: 6,
                  }}
                >
                  {msg.performative}
                </span>
                <strong>{label(msg.from)}</strong> → {label(msg.to)}
              </div>
              <div style={{ color: muted, marginTop: 2, lineHeight: 1.4 }}>{msg.summary}</div>
            </div>
          </div>
        ))}
      </div>
      {data.messages.length > shown.length || state?.showAll ? (
        <div
          onClick={() => setState({ showAll: !state?.showAll })}
          style={{ fontSize: 12, color: '#5b8def', textAlign: 'center', marginTop: 8, cursor: 'pointer' }}
        >
          {state?.showAll ? 'Show fewer messages' : `Show all ${data.messages.length} messages`}
        </div>
      ) : null}
      <div style={{ fontSize: 11, color: muted, textAlign: 'center', marginTop: 8 }}>
        {m.fleetSize} simulated drivers · {m.awards} award{m.awards === 1 ? '' : 's'} · {m.incentiveRounds} incentive round{m.incentiveRounds === 1 ? '' : 's'}
      </div>
    </div>
  );
}
