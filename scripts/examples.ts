/**
 * Regenerates the example data in src/widgets/widget-manifest.json by calling
 * the real tool methods, so every widget preview (gallery, screenshots,
 * NitroStack Studio) shows what the tools actually return.
 *
 *   npm run examples
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRiva } from './harness.js';
import { NearbyDriversService } from '../src/services/nearby-drivers.service.js';
import { SearchStoreService } from '../src/services/search-store.service.js';
import { RidesTools } from '../src/modules/rides/rides.tools.js';
import { DriverTools } from '../src/modules/driver/driver.tools.js';
import { NearbyRidesService } from '../src/modules/driver/nearby-rides.service.js';
import { JourneyTools } from '../src/modules/journey/journey.tools.js';
import { ConciergeService } from '../src/modules/journey/concierge.service.js';
import { PoolingService } from '../src/modules/journey/pooling.service.js';
import { BookingService } from '../src/modules/journey/booking.service.js';
import { SafetyService } from '../src/modules/journey/safety.service.js';
import { MarketplaceTools } from '../src/modules/marketplace/marketplace.tools.js';
import { RoutingTools } from '../src/modules/routing/routing.tools.js';

/** Builds a fresh set of services and tools, so no example can be influenced by another (learned weights, stored searches). */
function make() {
  const riva = createRiva();
  const store = new SearchStoreService();
  const booking = new BookingService();
  const rides = new RidesTools(riva.maps, riva.ranking, riva.preferences, store, riva.forecast, new NearbyDriversService(), riva.rideSearch);
  const driver = new DriverTools(riva.maps, riva.driver, riva.profitability, riva.demand, riva.recommendation, new NearbyRidesService(riva.demand, riva.driver), riva.shiftPlanner);
  const journey = new JourneyTools(
    new ConciergeService(riva.rideSearch, riva.ranking, riva.forecast, riva.maps), riva.multiStop, new PoolingService(riva.rideSearch, riva.ranking),
    booking, new SafetyService(riva.maps, booking), riva.rideSearch, riva.ranking, riva.forecast, store, riva.marketplace
  );
  return { riva, rides, driver, journey, market: new MarketplaceTools(riva.marketplace), routing: new RoutingTools(riva.maps) };
}
const ctx = { logger: { debug() {}, info() {}, warn() {}, error() {} } } as never;

/** Runs a call as if the clock read `hour`, so "now"-dependent tools give the same scene every time. */
async function at<T>(hour: number, run: () => Promise<T>): Promise<T> {
  const real = Date.prototype.getHours;
  Date.prototype.getHours = () => hour;
  try {
    return await run();
  } finally {
    Date.prototype.getHours = real;
  }
}
const plain = <T>(x: T): T => JSON.parse(JSON.stringify(x));

// A budget no ride meets: RIVA relaxes it (and says so) but still shows every quote.
const search = make();
const found: any = await at(9, () => search.rides.findRides({ origin: 'Amrita University', destination: 'Coimbatore Airport', preferences: { budgetLimit: 200 } }, ctx));
const recommended: any = await at(9, () => search.rides.recommendBestRide({ searchId: found.searchId, mode: 'best_value' }, ctx));
const tripInput = { provider: 'uber' as const, offeredFare: 310, tripDistance: 14, pickupDistance: 2.3, vehicleType: 'sedan' as const, fuelType: 'petrol' as const, currentLocation: 'Gandhipuram', destination: 'Coimbatore Airport' };

// A booking that a driver actually accepted (the dispatch seed is random per search id).
let booked: any;
const booking = make();
for (let k = 0; k < 30; k++) {
  const quote: any = await at(9, () => booking.rides.findRides({ origin: 'Amrita University', destination: 'Coimbatore Airport' }, ctx));
  const option = quote.options.find((o: any) => o.providerName === 'Uber' && o.vehicleType === 'sedan') ?? quote.options[0];
  booked = await at(9, () => booking.journey.bookingSimulation({ searchId: quote.searchId, optionId: option.optionId, confirmed: true }, ctx));
  if (booked.bookingId) break;
}

const examples: Record<string, Array<{ name: string; description: string; data: unknown }>> = {
  '/ride-comparison': [{ name: 'Budget too tight', description: 'No ride fits ₹200, so the budget is relaxed; A* road-graph route', data: found }],
  '/recommendation': [{ name: 'Best value pick', description: 'Top ride with alternatives', data: recommended }],
  '/nearby-drivers-map': [
    { name: 'Drivers around Gandhipuram', description: 'Simulated drivers within 3 km', data: await make().rides.getNearbyDriversMap({ origin: 'Gandhipuram', radiusKm: 3 }, ctx) },
    { name: 'Ride requests for a driver', description: 'Marketplace requests ranked by net earning', data: await make().driver.searchNearbyRides({ currentLocation: 'Gandhipuram' }, ctx) },
  ],
  '/return-fare-forecast': [{ name: 'Ride home at 9 PM', description: 'Airport to campus', data: await at(21, () => make().rides.planReturnTrip({ origin: 'Coimbatore Airport', destination: 'Amrita University', returnTime: '9 PM' }, ctx)) }],
  '/fare-forecast': [{ name: 'Tomorrow at 7 AM', description: 'Campus to airport', data: await at(9, () => make().journey.rideLaterForecast({ origin: 'Amrita University', destination: 'Coimbatore Airport', time: 'tomorrow 7 AM' }, ctx)) }],
  '/driver-trip-analysis': [{ name: 'Uber sedan to the airport', description: 'Offer from Gandhipuram', data: await at(18, () => make().driver.analyseDriverTrip(tripInput, ctx)) }],
  '/demand-map': [
    { name: 'Airport at 6 PM', description: 'Demand through the day', data: await make().driver.getDestinationDemand({ destination: 'Coimbatore Airport', time: '6 PM' }, ctx) },
    { name: 'Where to go next', description: 'Zone suggestions from RS Puram', data: await at(18, () => make().driver.suggestNextDriverZone({ currentLocation: 'RS Puram', time: 'now' }, ctx)) },
  ],
  '/driver-summary': [{ name: 'End of day', description: '12 trips', data: await make().driver.getDriverProfitabilitySummary({ tripsCompleted: 12, totalRevenue: 3200, totalDistance: 145, fuelCost: 620 }, ctx) }],
  '/shift-plan': [{ name: 'Late-night auto shift', description: 'Repositioning out of a quiet IT corridor at 11 PM', data: await make().driver.planDriverShift({ currentLocation: 'Tidel Park', startTime: '11 PM', hours: 4, vehicleType: 'auto', fuelType: 'cng' }, ctx) }],
  '/travel-plan': [{ name: '8 AM flight', description: 'Pickup time worked back from the deadline', data: await make().journey.travelConcierge({ origin: 'Amrita University', destination: 'Coimbatore Airport', arriveBy: '8 AM tomorrow' }, ctx) }],
  '/ride-map': [{ name: 'Reordered errands', description: 'A* reorders four stops to save time', data: await at(14, () => make().journey.multiStopTripPlanner({ stops: ['Amrita University', 'Coimbatore Airport', 'Ukkadam', 'Gandhipuram', 'Coimbatore Junction'], optimizeOrder: true }, ctx)) }],
  '/pooling-analysis': [{ name: 'Pooling to the airport', description: 'Simulated co-riders', data: await make().journey.carPoolingAssistant({ origin: 'Amrita University', destination: 'Coimbatore Airport' }, ctx) }],
  '/booking-status': [{ name: 'Dispatched through the marketplace', description: 'A driver who accepted the offer, and the learned weights', data: booked }],
  '/safety-alert': [{ name: 'SOS (simulated)', description: 'Alert sent to emergency contacts', data: await make().journey.sosEmergency({ currentLocation: 'Coimbatore Airport Road' }, ctx) }],
  '/agent-trace': [{ name: 'Airport ride with re-awards', description: 'Drivers refuse the cheapest bid; the rider agent re-awards', data: await make().market.simulateRideMarketplace({ origin: 'Amrita University', destination: 'Coimbatore Airport', time: '9 AM', seed: 'demo' }, ctx) }],
  '/search-comparison': [{ name: 'Amrita to the airport at 9 AM', description: 'Time-optimal routing in rush hour', data: await make().routing.compareSearchStrategies({ origin: 'Amrita University', destination: 'Coimbatore Airport', objective: 'time', time: '9 AM' }, ctx) }],
};

const path = 'src/widgets/widget-manifest.json';
const manifest = JSON.parse(readFileSync(path, 'utf8'));
for (const widget of manifest.widgets) {
  const fresh = examples[widget.uri];
  if (!fresh) throw new Error(`No examples generated for ${widget.uri}`);
  widget.examples = plain(fresh);
}
manifest.generatedAt = new Date().toISOString();
writeFileSync(path, JSON.stringify(manifest, null, 2));
console.log(`Updated ${manifest.widgets.length} widgets in ${path}`);
process.exit(0);
