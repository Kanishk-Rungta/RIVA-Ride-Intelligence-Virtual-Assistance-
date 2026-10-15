'use client';

import { useWidgetState, useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Pill, Shell, Stat, inr, type Tone } from '../../components/ui';

interface TraceMessage { id: number; t: number; from: string; to: string; performative: string; summary: string }

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
  };
  participants: Array<{ id: string; role: 'rider' | 'provider' | 'driver'; label: string }>;
  messages: TraceMessage[];
  metrics: { messageCount: number; fleetSize: number; driverOffers: number; driverAcceptanceRate: number; awards: number; incentiveRounds: number; timeToOutcomeSeconds: number };
}

const SPEECH_ACT: Record<string, { label: string; tone: Tone }> = {
  CFP: { label: 'Call for proposals', tone: 'teal' },
  PROPOSE: { label: 'Propose', tone: 'green' },
  REFUSE: { label: 'Refuse', tone: 'rose' },
  ACCEPT_PROPOSAL: { label: 'Accept', tone: 'violet' },
  REJECT_PROPOSAL: { label: 'Reject', tone: 'slate' },
  INFORM: { label: 'Inform', tone: 'amber' },
  FAILURE: { label: 'Failure', tone: 'rose' },
};
const ROLE_ICON: Record<string, string> = { rider: '🧑', provider: '🏢', driver: '🚖' };

export default function AgentTrace() {
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<MarketplaceData>();
  const [state, setState] = useWidgetState<{ all: boolean }>(() => ({ all: false }));
  if (!data) return <Loading label="Rider, providers and drivers are negotiating…" />;

  const name = (id: string) => {
    const p = data.participants.find((x) => x.id === id);
    const role = id.split(':')[0];
    return `${ROLE_ICON[role] ?? ''} ${p ? (role === 'driver' ? p.label.split(' ·')[0] : p.label) : id}`;
  };
  const matched = data.outcome.status === 'MATCHED';
  const visible = state?.all ? data.messages : data.messages.filter((m) => m.performative !== 'REJECT_PROPOSAL').slice(0, 14);
  const m = data.metrics;

  return (
    <Shell title="Agents negotiating your ride" subtitle={`${data.origin.formattedAddress} to ${data.destination.formattedAddress}, ${data.time}`}>
      <Glass i={1} tone={matched ? 'green' : 'rose'} hero>
        <div className="between">
          <div>
            <div className="small">{matched ? 'Driver found' : 'No driver found'}</div>
            <div className="mid" style={{ marginTop: 2 }}>
              {matched && data.outcome.option && data.outcome.driver
                ? `${data.outcome.driver.name}, ${data.outcome.option.providerName} ${data.outcome.option.vehicleType}`
                : 'Every award fell through'}
            </div>
          </div>
          {matched && data.outcome.option ? (
            <div style={{ textAlign: 'right' }}>
              <div className="num big">{inr(data.outcome.option.fare)}</div>
              <div className="small">arrives in {data.outcome.pickupEtaMinutes} min</div>
            </div>
          ) : null}
        </div>
        <div className="small" style={{ marginTop: 8, opacity: 0.92 }}>{data.outcome.reason}</div>
      </Glass>

      <div className="g4">
        <Stat i={2} tone="teal" label="Messages" value={m.messageCount} />
        <Stat i={3} tone="amber" label="Driver offers" value={m.driverOffers} />
        <Stat i={4} tone="violet" label="Accepted" value={`${Math.round(m.driverAcceptanceRate * 100)}%`} />
        <Stat i={5} tone="green" label="Simulated time" value={`${m.timeToOutcomeSeconds}s`} />
      </div>

      <Glass i={6} tone="violet" style={{ padding: '10px 8px' }}>
        <div className="between" style={{ padding: '2px 8px 8px' }}>
          <span className="h" style={{ margin: 0 }}>Message trace</span>
          <span className="faint">{data.protocol}</span>
        </div>
        <div className="g2" style={{ gap: 8 }}>
          {visible.map((msg, k) => {
            const act = SPEECH_ACT[msg.performative] ?? { label: msg.performative, tone: 'slate' as Tone };
            return (
              <Glass key={msg.id} i={7 + Math.min(k, 12)} tone={act.tone} tight lift>
                <div className="between">
                  <Pill tone={act.tone} solid={msg.performative === 'ACCEPT_PROPOSAL' || msg.performative === 'FAILURE'}>{act.label}</Pill>
                  <span className="faint num">{msg.t.toFixed(1)}s</span>
                </div>
                <div className="small strong" style={{ marginTop: 6 }}>{name(msg.from)} <span className="faint">to</span> {name(msg.to)}</div>
                <div className="faint" style={{ marginTop: 2 }}>{msg.summary}</div>
              </Glass>
            );
          })}
        </div>
        <div style={{ textAlign: 'center', marginTop: 6 }}>
          <button className="link" onClick={() => setState({ all: !state?.all })}>
            {state?.all ? 'Show fewer messages' : `Show all ${data.messages.length} messages`}
          </button>
        </div>
      </Glass>
      <div className="faint rise" style={{ ['--i' as string]: 20, textAlign: 'center' }}>
        {m.fleetSize} simulated drivers, {m.awards} award{m.awards === 1 ? '' : 's'}, {m.incentiveRounds} incentive round{m.incentiveRounds === 1 ? '' : 's'}
      </div>
    </Shell>
  );
}
