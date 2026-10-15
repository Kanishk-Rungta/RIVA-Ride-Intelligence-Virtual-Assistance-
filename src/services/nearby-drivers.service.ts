import { Injectable } from '@nitrostack/core';
import type { LatLng, NearbyDriver, ProviderId, VehicleType } from '../domain/types.js';
import { createSeededRandom, hashString, randomBetween, pick } from './sim.util.js';

const PROVIDERS: Array<{ id: ProviderId; name: string; count: number; vehicles: VehicleType[] }> = [
  { id: 'uber', name: 'Uber', count: 5, vehicles: ['auto', 'mini', 'sedan', 'suv'] },
  { id: 'ola', name: 'Ola', count: 5, vehicles: ['bike', 'auto', 'mini', 'sedan'] },
  { id: 'rapido', name: 'Rapido', count: 4, vehicles: ['bike', 'auto', 'mini'] },
];

/**
 * NearbyDriversService
 *
 * Simulation only — no real driver tracking, per Phase 1 scope. Positions
 * are scattered deterministically around the resolved pickup point within
 * the requested radius, purely for map visualization.
 */
@Injectable()
export class NearbyDriversService {
  /**
   * `epoch` defaults to the current ~second so the map shimmers between
   * calls like a live map; pass a fixed value for a reproducible scene.
   * `perProvider` overrides the default fleet size (the marketplace uses a
   * larger fleet than the map).
   */
  generate(
    center: LatLng,
    seedKey: string,
    radiusKm: number,
    options: { epoch?: number; perProvider?: number } = {}
  ): NearbyDriver[] {
    const drivers: NearbyDriver[] = [];
    const epoch = options.epoch ?? Date.now() >> 10;

    for (const provider of PROVIDERS) {
      const rng = createSeededRandom(hashString(`${seedKey}|${provider.id}|${epoch}`));
      const count = options.perProvider ?? provider.count;
      for (let i = 0; i < count; i++) {
        const angle = randomBetween(rng, 0, 2 * Math.PI);
        const distanceKm = randomBetween(rng, 0.1, radiusKm);

        // Approximate offset: 1 degree latitude ~ 111km.
        const dLat = (distanceKm / 111) * Math.cos(angle);
        const dLng = (distanceKm / (111 * Math.cos((center.lat * Math.PI) / 180))) * Math.sin(angle);

        drivers.push({
          driverId: `${provider.id}-driver-${i}`,
          provider: provider.id,
          providerName: provider.name,
          vehicleType: pick(rng, provider.vehicles),
          coordinates: { lat: center.lat + dLat, lng: center.lng + dLng },
          etaMinutes: Math.max(1, Math.round((distanceKm / 28) * 60)),
          rating: Math.round(randomBetween(rng, 4.0, 4.9) * 10) / 10,
          isFemaleDriver: randomBetween(rng, 0, 1) > 0.7,
        });
      }
    }

    return drivers.sort((a, b) => a.etaMinutes - b.etaMinutes);
  }
}
