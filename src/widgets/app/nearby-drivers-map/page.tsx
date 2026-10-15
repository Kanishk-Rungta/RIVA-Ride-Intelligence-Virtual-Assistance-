'use client';

import { useWidgetSDK } from '@nitrostack/widgets';
import { Glass, Loading, Mark, Pill, Shell, Stat, inr } from '../../components/ui';

interface LatLng { lat: number; lng: number }
interface NearbyDriver { driverId: string; provider: string; providerName: string; vehicleType: string; coordinates: LatLng; etaMinutes: number; rating: number; isFemaleDriver: boolean }
interface DriversData { origin: { formattedAddress: string; coordinates: LatLng }; radiusKm: number; driverCount: number; countsByProvider: Record<string, number>; drivers: NearbyDriver[]; note: string }
interface Request { requestId: string; provider: string; pickupDistanceKm: number; dropZone: string; tripDistanceKm: number; fare: number; estimatedNetEarning: number }
interface RequestsData { currentLocation: { formattedAddress: string }; radiusKm: number; rideCount: number; rides: Request[]; note: string }

const DOT: Record<string, string> = { uber: '#24242c', ola: '#a4c21b', rapido: '#f5b700' };
const S = 300;

export default function NearbyDriversMap() {
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<DriversData | RequestsData>();
  if (!data) return <Loading label="Looking around you…" />;

  if ('rides' in data) {
    return (
      <Shell title="Ride requests near you" subtitle={`${data.rideCount} within ${data.radiusKm} km of ${data.currentLocation.formattedAddress}`}>
        <div className="g2">
          {data.rides.map((r, k) => (
            <Glass key={r.requestId} i={1 + k} tone={k === 0 ? 'green' : 'teal'} lift active={k === 0}>
              <div className="between"><span className="strong">To {r.dropZone}</span>{k === 0 ? <Pill tone="green" solid>Best</Pill> : <Pill tone="slate">{r.provider}</Pill>}</div>
              <div className="between" style={{ marginTop: 8 }}>
                <div className="faint">{r.pickupDistanceKm} km to pickup, {r.tripDistanceKm} km trip</div>
                <div style={{ textAlign: 'right' }}><div className="num mid accent">{inr(r.estimatedNetEarning)}</div><div className="faint">net of {inr(r.fare)}</div></div>
              </div>
            </Glass>
          ))}
        </div>
        <div className="faint rise" style={{ ['--i' as string]: 10, textAlign: 'center' }}>{data.note}</div>
      </Shell>
    );
  }

  const c = data.origin.coordinates;
  const project = (p: LatLng) => {
    const dx = (p.lng - c.lng) * 111 * Math.cos((c.lat * Math.PI) / 180);
    const dy = (p.lat - c.lat) * 111;
    return { x: S / 2 + (dx / data.radiusKm) * (S / 2 - 16), y: S / 2 - (dy / data.radiusKm) * (S / 2 - 16) };
  };
  const nearest = [...data.drivers].sort((a, b) => a.etaMinutes - b.etaMinutes).slice(0, 4);

  return (
    <Shell title="Drivers around you" subtitle={`${data.driverCount} within ${data.radiusKm} km of ${data.origin.formattedAddress}`}>
      <div className="split">
        <Glass i={1} tone="teal" style={{ padding: 8 }}>
          <svg viewBox={`0 0 ${S} ${S}`} width="100%" role="img" aria-label="Map of nearby drivers">
            {[1, 0.66, 0.33].map((f) => <circle key={f} cx={S / 2} cy={S / 2} r={(S / 2 - 16) * f} fill="none" stroke="var(--ink-3)" strokeOpacity={0.3} strokeDasharray="3 5" />)}
            {data.drivers.map((d) => {
              const p = project(d.coordinates);
              return <circle key={d.driverId} cx={p.x} cy={p.y} r={6} fill={DOT[d.provider]} stroke="#fff" strokeWidth={2}><title>{d.providerName} {d.vehicleType}, {d.etaMinutes} min</title></circle>;
            })}
            <circle cx={S / 2} cy={S / 2} r={16} fill="var(--teal)" fillOpacity={0.18} />
            <circle cx={S / 2} cy={S / 2} r={7} fill="var(--teal)" stroke="#fff" strokeWidth={2.5} />
          </svg>
        </Glass>
        <div className="stack">
          <div className="g3">
            {Object.entries(data.countsByProvider).map(([p, n], k) => <Stat key={p} i={2 + k} tone="teal" label={p} value={n} />)}
          </div>
          {nearest.map((d, k) => (
            <Glass key={d.driverId} i={5 + k} tone="teal" tight lift>
              <div className="between">
                <div className="row"><Mark provider={d.provider} vehicle={d.vehicleType} /><div><div className="strong">{d.providerName} {d.vehicleType}</div><div className="faint">★ {d.rating}{d.isFemaleDriver ? ', female driver' : ''}</div></div></div>
                <span className="num mid accent">{d.etaMinutes} min</span>
              </div>
            </Glass>
          ))}
        </div>
      </div>
      <div className="faint rise" style={{ ['--i' as string]: 10, textAlign: 'center' }}>{data.note}</div>
    </Shell>
  );
}
