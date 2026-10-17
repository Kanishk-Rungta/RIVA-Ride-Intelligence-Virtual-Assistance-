'use client';

import { useState } from 'react';
import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Pill, Route, Shell, inr } from '../../components/ui';
import { CountUp, Slider } from '../../components/charts';

interface Match { matchedRiderDestination: string; routeOverlapPercent: number; savingsInr: number; extraMinutes: number }
interface Data {
  origin: { formattedAddress: string };
  destination: { formattedAddress: string };
  soloFare: number;
  bestMatch: Match | null;
  otherMatches: Match[];
  recommendation: 'POOL' | 'DO_NOT_POOL';
  reason: string;
}

const label = (s: string) => s.replace(/^a rider heading towards /i, '').replace(/^the /i, '');

export default function PoolingAnalysis() {
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<Data>();
  const [pick, setPick] = useState(0);
  const [limit, setLimit] = useState(15);
  if (!data) return <Loading label="Looking for riders going your way…" />;

  const matches = [data.bestMatch, ...data.otherMatches].filter(Boolean) as Match[];
  const m = matches[Math.min(pick, matches.length - 1)];
  if (!m) {
    return <Shell title="Share this ride?"><Glass i={1} tone="slate"><div className="strong">No co-riders on this route right now</div><div className="muted small">{data.reason}</div></Glass></Shell>;
  }
  const ok = m.extraMinutes <= limit && m.routeOverlapPercent >= 60 && m.savingsInr >= 30;
  const split = m.routeOverlapPercent / 100;
  const W = 500;

  return (
    <Shell title="Share this ride?" subtitle="Simulated riders on overlapping routes" width={720}>
      <Glass i={1} tone={ok ? 'green' : 'slate'} hero>
        <div className="between">
          <div><div className="small">{ok ? 'Pooling is worth it' : 'Better to ride solo'}</div><div className="num big"><CountUp value={data.soloFare - (ok ? m.savingsInr : 0)} format={inr} /></div></div>
          <div style={{ textAlign: 'right' }}><div className="small">{ok ? `You save ${inr(m.savingsInr)}` : `Solo fare ${inr(data.soloFare)}`}</div><div className="small">{ok ? `for ${m.extraMinutes} extra minutes` : m.extraMinutes > limit ? `${m.extraMinutes} extra minutes is over your ${limit}` : 'savings or overlap too small'}</div></div>
        </div>
      </Glass>

      <Glass i={2} tone="teal" lift><Route from={data.origin.formattedAddress} to={data.destination.formattedAddress} /></Glass>

      <Glass i={3} tone="green">
        <div className="h">Where your routes overlap</div>
        <svg className="chart" viewBox={`0 0 ${W} 150`} role="img" aria-label={`${m.routeOverlapPercent}% route overlap`}>
          <path d="M30 40 H470" stroke="var(--teal)" strokeWidth="8" strokeLinecap="round" pathLength={1} className="draw" fill="none" />
          <path key={pick} d={`M30 110 H${30 + 440 * split} C${30 + 440 * split + 40} 110 ${30 + 440 * split + 30} 75 ${30 + 440 * split + 90} 85 S ${470} 95 ${470} 125`} stroke="var(--amber)" strokeWidth="8" strokeLinecap="round" fill="none" pathLength={1} className="draw" strokeDasharray="1" />
          <rect x="30" y="30" width={440 * split} height="90" rx="18" fill="var(--green)" fillOpacity="0.14" stroke="var(--green)" strokeDasharray="5 5" style={{ transition: 'width .6s cubic-bezier(.34,1.3,.64,1)' }} />
          <text x={30 + (440 * split) / 2} y="78" textAnchor="middle" style={{ fill: 'var(--green)', fontSize: 14, fontWeight: 800 }}>{m.routeOverlapPercent}% shared</text>
          <text x="30" y="22">You</text><text x="30" y="142">{label(m.matchedRiderDestination)}</text>
          <circle cx="30" cy="40" r="9" fill="var(--teal)" stroke="#fff" strokeWidth="3" /><circle cx="30" cy="110" r="9" fill="var(--amber)" stroke="#fff" strokeWidth="3" />
          <circle cx="470" cy="40" r="9" fill="var(--rose)" stroke="#fff" strokeWidth="3" />
          <text x={30 + 440 * split * 0.5} y="56" textAnchor="middle" style={{ fontSize: 18 }}>🚗</text>
        </svg>
        <div style={{ marginTop: 10 }}><Slider label="Longest extra detour you will accept" value={limit} min={0} max={30} step={1} tone="green" onChange={setLimit} format={(v) => `${v} min`} /></div>
      </Glass>

      <div className="g3">
        {matches.map((x, k) => {
          const pass = x.extraMinutes <= limit;
          return (
            <Glass key={k} i={4 + k} tone={k === pick ? 'green' : 'teal'} lift active={k === pick} onClick={() => setPick(k)} style={{ opacity: pass ? 1 : 0.5 }}>
              <div className="strong">{label(x.matchedRiderDestination)}</div>
              <div className="chips" style={{ marginTop: 8 }}><Pill tone="teal">{x.routeOverlapPercent}% overlap</Pill><Pill tone="green">Save {inr(x.savingsInr)}</Pill><Pill tone={pass ? 'amber' : 'rose'}>+{x.extraMinutes} min</Pill></div>
              {k === 0 ? <div className="faint" style={{ marginTop: 6 }}>Best overlap</div> : null}
            </Glass>
          );
        })}
      </div>
    </Shell>
  );
}
