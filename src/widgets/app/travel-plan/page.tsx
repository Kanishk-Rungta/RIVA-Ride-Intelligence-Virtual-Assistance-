'use client';

import { useState } from 'react';
import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Mark, Pill, Route, Shell, Stat, inr } from '../../components/ui';
import { CountUp, Slider } from '../../components/charts';

interface Ride { provider?: string; providerName: string; vehicleType: string; fare: number; pickupEtaMinutes: number; rating: number }
interface Data {
  origin: { formattedAddress: string };
  destination: { formattedAddress: string };
  arriveByLabel: string;
  recommendedPickupLabel: string;
  bufferMinutes: number;
  bufferReason: string;
  trafficAdjustedTravelMinutes: number;
  trafficMultiplier: number;
  route: { distanceKm: number; source: string; via?: string[] };
  recommendation: Ride | null;
  recommendationReason: string;
}

/** Shifts a label such as "5:45 AM tomorrow" by whole minutes, keeping any trailing day word. */
function shift(label: string, minutes: number): string {
  const m = label.match(/(\d{1,2}):(\d{2})\s*(AM|PM)(.*)/i);
  if (!m) return label;
  let t = (Number(m[1]) % 12) * 60 + Number(m[2]) + (m[3].toUpperCase() === 'PM' ? 720 : 0) - minutes;
  t = ((t % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(t % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}${m[4]}`;
}

export default function TravelPlan() {
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<Data>();
  const [buffer, setBuffer] = useState<number | null>(null);
  if (!data) return <Loading label="Planning backwards from your deadline…" />;

  const b = buffer ?? data.bufferMinutes;
  const drive = data.trafficAdjustedTravelMinutes;
  const total = drive + b;
  const leave = shift(data.recommendedPickupLabel, b - data.bufferMinutes);
  const r = data.recommendation;
  const key = r ? (r.provider ?? r.providerName).toLowerCase() : '';

  return (
    <Shell title={`Be there by ${data.arriveByLabel}`} subtitle="Pickup time worked back from traffic and a safety buffer" width={740}>
      <Glass i={1} tone="violet" hero>
        <div className="between">
          <div><div className="small">Leave at</div><div className="num big" style={{ fontSize: 32 }}>{leave}</div></div>
          <div style={{ textAlign: 'right' }}><div className="small">Arrive by</div><div className="num mid">{data.arriveByLabel}</div></div>
        </div>
      </Glass>

      <Glass i={2} tone="teal">
        <div className="h">Your {total}-minute window</div>
        <div style={{ position: 'relative', display: 'flex', height: 54, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--edge)' }}>
          <div style={{ flex: drive, background: 'linear-gradient(90deg, var(--teal), color-mix(in srgb, var(--teal) 60%, var(--violet)))', transition: 'flex 0.5s cubic-bezier(.34,1.3,.64,1)', position: 'relative', display: 'grid', placeItems: 'center', color: '#0d0f24', fontWeight: 800 }}>
            <span style={{ position: 'absolute', left: 0, fontSize: 22, animation: 'riva-drive 5s ease-in-out infinite' }} aria-hidden>🚗</span>
            <span className="small" style={{ opacity: 0.95 }}>Drive {drive} min</span>
          </div>
          <div style={{ flex: Math.max(b, 0.001), background: 'repeating-linear-gradient(135deg, color-mix(in srgb, var(--amber) 85%, #fff) 0 10px, var(--amber) 10px 20px)', transition: 'flex 0.5s cubic-bezier(.34,1.3,.64,1)', display: 'grid', placeItems: 'center', color: '#3b2600', fontWeight: 800, overflow: 'hidden' }}>
            <span className="small">{b > 8 ? `Buffer ${b} min` : ''}</span>
          </div>
        </div>
        <div className="between faint" style={{ marginTop: 6 }}><span>🟢 {leave}</span><span>🏁 {data.arriveByLabel}</span></div>
        <div style={{ marginTop: 12 }}>
          <Slider label="Safety buffer" value={b} min={0} max={120} step={5} tone="amber" onChange={setBuffer} format={(v) => `${v} min${v === data.bufferMinutes ? ' (suggested)' : v > data.bufferMinutes ? `, leave ${v - data.bufferMinutes} min earlier` : `, leave ${data.bufferMinutes - v} min later`}`} />
          <div className="faint" style={{ marginTop: 6 }}>{data.bufferReason}</div>
        </div>
      </Glass>

      <div className="g3">
        <Stat i={3} tone="teal" label="Drive time" value={<CountUp value={drive} format={(n) => `${Math.round(n)} min`} />} sub={`Traffic ×${data.trafficMultiplier}`} />
        <Stat i={4} tone="amber" label="Buffer" value={`${b} min`} />
        <Stat i={5} tone="violet" label="Distance" value={`${data.route.distanceKm} km`} sub={data.route.source === 'road_graph' ? 'A* route' : undefined} />
      </div>
      <div className="split">
        <Glass i={6} tone="teal" lift><Route from={data.origin.formattedAddress} to={data.destination.formattedAddress} middle={data.route.via && data.route.via.length > 2 ? `Via ${data.route.via.slice(1, -1).slice(0, 4).join(', ')}` : undefined} /></Glass>
        {r ? (
          <Glass i={7} tone="green" lift>
            <div className="between"><div className="row"><Mark provider={key} vehicle={r.vehicleType} /><div><div className="strong">{r.providerName} {r.vehicleType}</div><div className="faint">★ {r.rating}, {r.pickupEtaMinutes} min away</div></div></div><span className="num mid">{inr(r.fare)}</span></div>
            <div className="chips" style={{ marginTop: 8 }}><Pill tone="green" solid>Book this</Pill></div>
            <div className="faint" style={{ marginTop: 6 }}>{data.recommendationReason}</div>
          </Glass>
        ) : null}
      </div>
    </Shell>
  );
}
