'use client';

import { useWidgetState, useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Mark, Note, Pill, Route, Shell, Stat, cap, inr } from '../../components/ui';

interface RankedRideOption {
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
  rank: number;
  scoreReason: string;
  paretoOptimal?: boolean;
}

interface RideComparisonData {
  origin: { formattedAddress: string; source: string; estimationNote?: string };
  destination: { formattedAddress: string; source: string; estimationNote?: string };
  route: { distanceKm: number; durationMinutes: number; source: 'live' | 'road_graph' | 'estimated'; staticMapUrl?: string; via?: string[]; search?: { nodesExpanded: number } };
  rankingMode: string;
  rankingExplanation: string;
  totalOptionsFound: number;
  options: RankedRideOption[];
  constraints?: { relaxed: string[]; unsatisfiableHard: string | null; note?: string };
}

const ROUTE_SOURCE = { live: 'Live route', road_graph: 'A* road-graph route', estimated: 'Straight-line estimate' };

export default function RideComparison() {
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<RideComparisonData>();
  const [state, setState] = useWidgetState<{ open: string | null }>(() => ({ open: null }));

  if (!data) return <Loading label="Asking Uber, Ola and Rapido for quotes…" />;

  const available = data.options.filter((o) => o.availability);
  const top = available[0];
  const cheapest = available.length ? Math.min(...available.map((o) => o.fare)) : null;
  const quickest = available.length ? Math.min(...available.map((o) => o.pickupEtaMinutes)) : null;

  return (
    <Shell title="Ride comparison" subtitle={`${data.totalOptionsFound} quotes, ranked for ${cap(data.rankingMode)}`}>
      <div className="split">
        <Glass i={1} tone="teal" lift>
          <Route
            from={data.origin.formattedAddress}
            to={data.destination.formattedAddress}
            middle={`${data.route.distanceKm.toFixed(1)} km, ${Math.round(data.route.durationMinutes)} min`}
          />
          <div className="chips" style={{ marginTop: 10 }}>
            <Pill tone="teal">{ROUTE_SOURCE[data.route.source]}</Pill>
            {data.route.search ? <Pill tone="violet">{data.route.search.nodesExpanded} nodes expanded</Pill> : null}
          </div>
          {data.route.via && data.route.via.length > 2 ? (
            <div className="faint" style={{ marginTop: 8 }}>Via {data.route.via.slice(1, -1).join(', ')}</div>
          ) : null}
        </Glass>
        <div className="g2">
          <Stat i={2} tone="amber" label="Cheapest" value={inr(cheapest)} />
          <Stat i={3} tone="teal" label="Quickest pickup" value={`${quickest ?? '—'} min`} />
          <Stat i={4} tone="violet" label="Not dominated" value={`${available.filter((o) => o.paretoOptimal).length} of ${available.length}`} sub="Pareto-optimal" />
          <Stat i={5} tone="green" label="Top pick" value={top ? inr(top.fare) : '—'} sub={top ? `${top.providerName} ${top.vehicleType}` : undefined} />
        </div>
      </div>

      {data.constraints?.note ? <div className="rise" style={{ ['--i' as string]: 6 }}><Note tone={data.constraints.unsatisfiableHard ? 'rose' : 'amber'} icon="⚖">{data.constraints.note}</Note></div> : null}
      {data.origin.source === 'estimated' && data.origin.estimationNote ? (
        <div className="faint rise" style={{ ['--i' as string]: 6, padding: '0 4px' }}>Approximate locations: set GEOAPIFY_API_KEY for live geocoding.</div>
      ) : null}

      {data.options.length === 0 ? (
        <Glass i={7} tone="rose"><div className="strong">No ride fits these preferences</div><div className="muted small">Relax the budget or vehicle filter and search again.</div></Glass>
      ) : (
        <div className="g2">
          {data.options.slice(0, 8).map((o, idx) => {
            const open = state?.open === o.optionId;
            return (
              <Glass key={o.optionId} i={7 + idx} tone={o.rank === 1 ? 'green' : 'teal'} lift active={open || o.rank === 1}
                onClick={() => setState({ open: open ? null : o.optionId })} style={{ opacity: o.availability ? undefined : 0.55 }}>
                <div className="between">
                  <div className="row">
                    <Mark provider={o.provider} vehicle={o.vehicleType} />
                    <div>
                      <div className="strong">{o.providerName} {o.vehicleType}</div>
                      <div className="faint">★ {o.rating.toFixed(1)}, pickup in {o.pickupEtaMinutes} min</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="num mid">{inr(o.fare)}</div>
                    <div className="faint">#{o.rank}</div>
                  </div>
                </div>
                <div className="chips" style={{ marginTop: 8 }}>
                  {o.rank === 1 ? <Pill tone="green" solid>Recommended</Pill> : null}
                  {!o.availability ? <Pill tone="rose">Unavailable</Pill> : o.paretoOptimal === false ? <Pill tone="slate">Dominated</Pill> : <Pill tone="violet">Pareto-optimal</Pill>}
                  {o.surgeMultiplier > 1.05 ? <Pill tone="amber">Surge {o.surgeMultiplier}×</Pill> : null}
                  {o.luggageFriendly ? <Pill tone="teal">Luggage</Pill> : null}
                  {o.hasFemaleDriverOption ? <Pill tone="teal">Female driver</Pill> : null}
                </div>
                {open ? (
                  <div className="small muted" style={{ marginTop: 8 }}>
                    {o.scoreReason}. Trip about {o.tripDurationMinutes} min over {o.distanceKm} km{o.isSimulated ? ', simulated quote' : ', live quote'}.
                    {o.notes ? ` ${o.notes}` : ''}
                  </div>
                ) : null}
              </Glass>
            );
          })}
        </div>
      )}
      <div className="faint rise" style={{ ['--i' as string]: 16, textAlign: 'center' }}>{data.rankingExplanation} Tap a ride for details.</div>
    </Shell>
  );
}
