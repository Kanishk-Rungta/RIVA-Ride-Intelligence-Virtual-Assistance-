'use client';

import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Meter, Pill, Route, Shell, Stat, inr } from '../../components/ui';

interface Match { matchedRiderDestination: string; routeOverlapPercent: number; savingsInr: number; extraMinutes: number }
interface PoolingData {
  origin: { formattedAddress: string };
  destination: { formattedAddress: string };
  soloFare: number;
  bestMatch: Match | null;
  otherMatches: Match[];
  recommendation: 'POOL' | 'DO_NOT_POOL';
  reason: string;
}

export default function PoolingAnalysis() {
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<PoolingData>();
  if (!data) return <Loading label="Looking for riders going your way…" />;

  const pool = data.recommendation === 'POOL';
  const matches = [data.bestMatch, ...data.otherMatches].filter(Boolean) as Match[];
  return (
    <Shell title="Share this ride?" subtitle="Simulated riders on overlapping routes">
      <Glass i={1} tone={pool ? 'green' : 'slate'} hero>
        <div className="between">
          <div><div className="small">{pool ? 'Pooling is worth it' : 'Ride solo'}</div><div className="mid" style={{ marginTop: 2 }}>{data.reason}</div></div>
        </div>
      </Glass>
      <div className="split">
        <Glass i={2} tone="teal" lift><Route from={data.origin.formattedAddress} to={data.destination.formattedAddress} /></Glass>
        <div className="g2">
          <Stat i={3} tone="amber" label="Solo fare" value={inr(data.soloFare)} />
          <Stat i={4} tone="green" label="Pooled fare" value={data.bestMatch ? inr(data.soloFare - data.bestMatch.savingsInr) : '—'} />
        </div>
      </div>
      <div className="g2">
        {matches.map((m, k) => (
          <Glass key={k} i={5 + k} tone={k === 0 ? 'green' : 'teal'} lift active={k === 0 && pool}>
            <div className="between"><span className="strong">{cap1(m.matchedRiderDestination)}</span>{k === 0 ? <Pill tone="green">Best match</Pill> : null}</div>
            <div className="between small" style={{ margin: '8px 0 4px' }}><span className="muted">Route overlap</span><span className="num strong">{m.routeOverlapPercent}%</span></div>
            <Meter value={m.routeOverlapPercent} max={100} tone="teal" i={5 + k} />
            <div className="chips" style={{ marginTop: 8 }}><Pill tone="green">Save {inr(m.savingsInr)}</Pill><Pill tone="amber">+{m.extraMinutes} min</Pill></div>
          </Glass>
        ))}
      </div>
    </Shell>
  );
}

const cap1 = (s: string) => s[0].toUpperCase() + s.slice(1);
