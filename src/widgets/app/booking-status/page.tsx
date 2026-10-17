'use client';

import { useEffect, useRef, useState } from 'react';
import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Mark, Note, Route, Shell, Stat, cap, inr } from '../../components/ui';
import { CountUp } from '../../components/charts';

type Status = 'SEARCHING' | 'DRIVER_ASSIGNED' | 'DRIVER_ARRIVING' | 'TRIP_STARTED' | 'COMPLETED' | 'CANCELLED';
interface Summary { provider: string; providerName: string; vehicleType: string; fare: number; origin?: string; destination?: string }
interface Pending { status: 'PENDING_CONFIRMATION' | 'CANCELLED'; message: string; rideSummary: Summary }
interface Booking {
  bookingId: string; provider: string; vehicleType: string; fare: number;
  origin: { formattedAddress: string }; destination: { formattedAddress: string };
  status: Status; driver: { driverName: string; vehicleNumber: string; rating: number; etaMinutes: number } | null;
  dispatch?: { driversContacted: number; driverAcceptances: number };
  learning?: { before: { fare: number; pickupEta: number; rating: number }; after: { fare: number; pickupEta: number; rating: number } };
}

const STAGES: Array<{ status: Status; label: string; hint: string }> = [
  { status: 'SEARCHING', label: 'Finding a driver', hint: 'Offers go out to nearby drivers' },
  { status: 'DRIVER_ASSIGNED', label: 'Driver assigned', hint: 'A driver accepted your trip' },
  { status: 'DRIVER_ARRIVING', label: 'Driver arriving', hint: 'On the way to your pickup' },
  { status: 'TRIP_STARTED', label: 'On the way', hint: 'You are riding' },
  { status: 'COMPLETED', label: 'Arrived', hint: 'Trip complete' },
];
const ROAD = 'M36 92 C 140 8, 290 150, 400 60 S 470 70 484 44';

export default function BookingStatusWidget() {
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<Pending | Booking>();
  const [stage, setStage] = useState<number | null>(null);
  const [pts, setPts] = useState<Array<{ x: number; y: number }>>([]);
  const road = useRef<SVGPathElement>(null);

  useEffect(() => {
    const p = road.current;
    if (!p) return;
    const len = p.getTotalLength();
    setPts(STAGES.map((_, k) => { const q = p.getPointAtLength((k / (STAGES.length - 1)) * len); return { x: q.x, y: q.y }; }));
  }, [data]);

  if (!data) return <Loading label="Dispatching your ride…" />;

  if (!('bookingId' in data)) {
    const pending = data.status === 'PENDING_CONFIRMATION';
    const r = data.rideSummary;
    return (
      <Shell title={pending ? 'Confirm your booking' : 'No driver accepted'} subtitle="Simulated booking, no payment is taken" width={620}>
        <Glass i={1} tone={pending ? 'violet' : 'rose'} lift>
          <div className="between"><div className="row"><Mark provider={r.provider} vehicle={r.vehicleType} /><div className="strong">{r.providerName} {r.vehicleType}</div></div><span className="num mid">{inr(r.fare)}</span></div>
          {r.origin && r.destination ? <div style={{ marginTop: 10 }}><Route from={r.origin} to={r.destination} /></div> : null}
        </Glass>
        <div className="rise" style={{ ['--i' as string]: 2 }}><Note tone={pending ? 'violet' : 'rose'} icon={pending ? '?' : '!'}>{data.message}</Note></div>
      </Shell>
    );
  }

  const initial = Math.max(0, STAGES.findIndex((s) => s.status === data.status));
  const now = stage ?? initial;
  const car = pts[now];
  const eta = data.driver ? Math.max(0, data.driver.etaMinutes - Math.max(0, now - 1) * 2) : null;
  const trail = pts.length ? (pts[now].x - pts[0].x) / (pts[pts.length - 1].x - pts[0].x) : 0;

  return (
    <Shell title={STAGES[now].label} subtitle={`Booking ${data.bookingId.slice(0, 8)}, simulated`} width={740}>
      {data.driver ? (
        <Glass i={1} tone="green" hero>
          <div className="between">
            <div className="row"><div className="avatar" style={{ background: 'rgba(255,255,255,.25)' }}>{data.driver.driverName[0]}</div><div><div className="mid">{data.driver.driverName}, ★ {data.driver.rating}</div><div className="small">{data.driver.vehicleNumber}</div></div></div>
            <div style={{ textAlign: 'right' }}><div className="num big">{now >= 3 ? 'On trip' : <><CountUp value={eta ?? 0} /> min</>}</div><div className="small">{now >= 3 ? STAGES[now].hint : 'to pickup'}</div></div>
          </div>
        </Glass>
      ) : null}

      <Glass i={2} tone="teal">
        <div className="between" style={{ marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
          <div className="h" style={{ margin: 0 }}>Trip progress</div>
          <div className="row">
            <button className="btn" disabled={now === 0} onClick={() => setStage(Math.max(0, now - 1))} style={{ opacity: now === 0 ? 0.4 : 1 }}>Back</button>
            <button className="btn" onClick={() => setStage(now >= STAGES.length - 1 ? 0 : now + 1)}>{now >= STAGES.length - 1 ? 'Restart' : 'Advance trip'}</button>
          </div>
        </div>
        <svg className="chart" viewBox="0 0 520 150" role="img" aria-label={`Trip stage: ${STAGES[now].label}`}>
          <path ref={road} d={ROAD} fill="none" stroke="var(--ink-3)" strokeOpacity="0.35" strokeWidth="8" strokeLinecap="round" strokeDasharray="2 12" />
          <path d={ROAD} fill="none" stroke="var(--teal)" strokeWidth="8" strokeLinecap="round" pathLength={1} strokeDasharray={`${trail} 1`} style={{ transition: 'stroke-dasharray 1.1s cubic-bezier(.65,0,.35,1)', filter: 'drop-shadow(0 4px 8px rgba(13,158,147,.5))' }} />
          {pts.map((p, k) => (
            <g key={k}><circle cx={p.x} cy={p.y} r="11" fill={k <= now ? 'var(--teal)' : 'var(--base)'} stroke={k <= now ? '#fff' : 'var(--ink-3)'} strokeWidth="3" style={{ transition: 'fill .4s' }} /><text x={p.x} y={p.y + 4} textAnchor="middle" style={{ fill: k <= now ? '#0d0f24' : 'var(--ink-3)', fontWeight: 800, fontSize: 10 }}>{k < now ? '✓' : k + 1}</text>
              <text x={p.x} y={p.y + (k % 2 ? -18 : 28)} textAnchor="middle" style={{ fill: k === now ? 'var(--ink)' : 'var(--ink-3)', fontWeight: k === now ? 800 : 600 }}>{STAGES[k].label}</text></g>
          ))}
          {car ? <g className="car" style={{ transform: `translate(${car.x}px, ${car.y}px)` }}><circle r="17" fill="var(--glass-hi)" stroke="var(--teal)" strokeWidth="2.5" /><text y="6" textAnchor="middle" style={{ fontSize: 18, fill: 'initial' }}>🚗</text></g> : null}
        </svg>
        <div className="readout tone-teal"><b>{STAGES[now].label}</b><span className="muted">{STAGES[now].hint}</span></div>
      </Glass>

      <div className="split">
        <Glass i={3} tone="teal" lift><Route from={data.origin.formattedAddress} to={data.destination.formattedAddress} /></Glass>
        <div className="g2">
          <Stat i={4} tone="amber" label="Fare" value={inr(data.fare)} sub={`${cap(data.provider)} ${data.vehicleType}`} />
          <Stat i={5} tone="violet" label="Drivers asked" value={data.dispatch ? data.dispatch.driversContacted : '—'} sub={data.dispatch ? `${data.dispatch.driverAcceptances} accepted` : undefined} />
        </div>
      </div>
      {data.learning ? <div className="faint rise" style={{ ['--i' as string]: 6, padding: '0 4px' }}>RIVA learned from this choice. Weights now: fare {Math.round(data.learning.after.fare * 100)}%, pickup {Math.round(data.learning.after.pickupEta * 100)}%, rating {Math.round(data.learning.after.rating * 100)}%.</div> : null}
    </Shell>
  );
}
