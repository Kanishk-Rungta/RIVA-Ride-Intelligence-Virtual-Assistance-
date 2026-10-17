'use client';

import { useState } from 'react';
import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Mark, Pill, Shell, inr, cap } from '../../components/ui';
import { Bars, CountUp, projector } from '../../components/charts';

interface LatLng { lat: number; lng: number }
interface Driver { driverId: string; provider: 'uber' | 'ola' | 'rapido'; providerName: string; vehicleType: string; coordinates: LatLng; etaMinutes: number; rating: number; isFemaleDriver: boolean }
interface Drivers { origin: { formattedAddress: string; coordinates: LatLng }; radiusKm: number; driverCount: number; drivers: Driver[]; note: string }
interface Request { requestId: string; provider: string; pickupDistanceKm: number; dropZone: string; tripDistanceKm: number; fare: number; estimatedNetEarning: number }
interface Requests { currentLocation: { formattedAddress: string }; radiusKm: number; rideCount: number; rides: Request[]; note: string }

const DOT: Record<string, string> = { uber: '#c9cdf7', ola: '#a4c21b', rapido: '#f5b700' };
const S = 320;

export default function NearbyDriversMap() {
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<Drivers | Requests>();
  const [off, setOff] = useState<string[]>([]);
  const [hover, setHover] = useState<string | null>(null);
  const [active, setActive] = useState<number | null>(null);
  if (!data) return <Loading label="Looking around you…" />;

  if ('rides' in data) {
    const rides = [...data.rides].sort((a, b) => b.estimatedNetEarning - a.estimatedNetEarning);
    const r = rides[active ?? 0];
    return (
      <Shell title="Ride requests near you" subtitle={`${data.rideCount} within ${data.radiusKm} km of ${data.currentLocation.formattedAddress}`} width={720}>
        <Glass i={1} tone="green" hero>
          <div className="small">Best request</div>
          <div className="between"><div className="mid">To {rides[0].dropZone}</div><div className="num big"><CountUp value={rides[0].estimatedNetEarning} format={inr} /></div></div>
          <div className="small">net after fuel and commission, from a {inr(rides[0].fare)} fare</div>
        </Glass>
        <Glass i={2} tone="teal">
          <div className="h">Net earning by request</div>
          <Bars items={rides.map((q) => ({ label: q.dropZone.split(' ')[0], value: Math.max(q.estimatedNetEarning, 0) }))} active={active} onActive={setActive} format={inr} tone="teal" height={170} />
          <div className="readout tone-teal" style={{ marginTop: 8 }}><div><b>To {r.dropZone}</b> via {cap(r.provider)}<div className="faint">{r.pickupDistanceKm} km to pickup, {r.tripDistanceKm} km trip, fare {inr(r.fare)}, net {inr(r.estimatedNetEarning)}</div></div></div>
        </Glass>
        <div className="faint rise" style={{ ['--i' as string]: 5, textAlign: 'center' }}>{data.note}</div>
      </Shell>
    );
  }

  const providers = ['uber', 'ola', 'rapido'];
  const project = projector([data.origin.coordinates, ...data.drivers.map((d) => d.coordinates)], S, S, 30);
  const c = project(data.origin.coordinates);
  const visible = data.drivers.filter((d) => !off.includes(d.provider));
  const nearest = [...visible].sort((a, b) => a.etaMinutes - b.etaMinutes);
  const focus = data.drivers.find((d) => d.driverId === hover) ?? nearest[0];
  const unit = (S / 2 - 30) / data.radiusKm;

  return (
    <Shell title="Drivers around you" subtitle={`${data.driverCount} within ${data.radiusKm} km of ${data.origin.formattedAddress}`} width={740}>
      <div className="split">
        <Glass i={1} tone="teal" style={{ padding: 8 }}>
          <svg className="chart" viewBox={`0 0 ${S} ${S}`} role="img" aria-label="Map of nearby drivers" style={{ borderRadius: 14 }}>
            {[1, 0.66, 0.33].map((f) => <circle key={f} cx={c.x} cy={c.y} r={data.radiusKm * unit * f} fill="none" stroke="var(--ink-3)" strokeOpacity="0.3" strokeDasharray="3 5" />)}
            {[0, 1, 2].map((k) => <circle key={k} cx={c.x} cy={c.y} r={data.radiusKm * unit} fill="none" stroke="var(--teal)" strokeWidth="2" className="ping" style={{ ['--i' as string]: k } as React.CSSProperties} />)}
            <g className="sweep" style={{ transformOrigin: `${c.x}px ${c.y}px` }}><path d={`M${c.x} ${c.y} L${c.x + data.radiusKm * unit} ${c.y} A${data.radiusKm * unit} ${data.radiusKm * unit} 0 0 0 ${c.x + data.radiusKm * unit * Math.cos(0.7)} ${c.y - data.radiusKm * unit * Math.sin(0.7)} Z`} fill="var(--teal)" fillOpacity="0.14" /></g>
            {data.drivers.map((d, k) => {
              const p = project(d.coordinates);
              const on = !off.includes(d.provider);
              return (
                <g key={d.driverId} className={`hit pop ${hover === d.driverId ? 'on' : ''}${on ? '' : ' dim'}`} style={{ ['--i' as string]: k } as React.CSSProperties} onMouseEnter={() => setHover(d.driverId)} onMouseLeave={() => setHover(null)}>
                  <circle cx={p.x} cy={p.y} r="8" fill={DOT[d.provider]} stroke="#fff" strokeWidth="2.5" />
                  {d.isFemaleDriver ? <circle cx={p.x} cy={p.y} r="3" fill="#fff" /> : null}
                </g>
              );
            })}
            <circle cx={c.x} cy={c.y} r="7" fill="var(--rose)" stroke="#fff" strokeWidth="3" />
          </svg>
          <div className="legend" style={{ padding: '2px 6px 0' }}>
            {providers.map((p) => (
              <button key={p} onClick={() => setOff(off.includes(p) ? off.filter((x) => x !== p) : [...off, p])} aria-pressed={!off.includes(p)} style={{ opacity: off.includes(p) ? 0.4 : 1 }}>
                <i style={{ background: DOT[p], borderRadius: 99 }} />{cap(p)} {data.drivers.filter((d) => d.provider === p).length}
              </button>
            ))}
            <span className="faint">White centre = female driver</span>
          </div>
        </Glass>
        <div className="stack" style={{ gap: 9 }}>
          {focus ? (
            <Glass i={2} tone="green" hero>
              <div className="row"><Mark provider={focus.provider} vehicle={focus.vehicleType} /><div><div className="mid">{focus.providerName} {focus.vehicleType}</div><div className="small">★ {focus.rating}{focus.isFemaleDriver ? ', female driver' : ''}</div></div></div>
              <div className="num big" style={{ marginTop: 8 }}>{focus.etaMinutes} min <span className="small">away</span></div>
            </Glass>
          ) : null}
          {nearest.slice(0, 4).map((d, k) => (
            <Glass key={d.driverId} i={3 + k} tone="teal" tight lift active={hover === d.driverId} onClick={() => setHover(d.driverId)}>
              <div className="between"><div className="row"><Pill tone="teal">{d.etaMinutes} min</Pill><span className="strong">{d.providerName} {d.vehicleType}</span></div><span className="faint">★ {d.rating}</span></div>
            </Glass>
          ))}
        </div>
      </div>
      <div className="faint rise" style={{ ['--i' as string]: 8, textAlign: 'center' }}>{data.note}</div>
    </Shell>
  );
}
