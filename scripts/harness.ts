/**
 * Offline harness: wires RIVA's services by hand, without starting the MCP
 * server, so the test suite, the CLI demo, and the benchmark can drive the
 * exact same code the tools use. API keys are removed first, which makes
 * every run deterministic (estimated geocoding + A* road-graph routing +
 * simulated providers).
 */
import 'reflect-metadata';
import { ConfigService } from '@nitrostack/core';
import { MapsService } from '../src/services/maps.service.js';
import { PreferenceService } from '../src/services/preference.service.js';
import { RankingService } from '../src/services/ranking.service.js';
import { ForecastService } from '../src/services/forecast.service.js';
import { NearbyDriversService } from '../src/services/nearby-drivers.service.js';
import { RideSearchService } from '../src/services/ride-search.service.js';
import { UberMockProvider } from '../src/providers/uber-mock.provider.js';
import { OlaMockProvider } from '../src/providers/ola-mock.provider.js';
import { RapidoHybridProvider } from '../src/providers/rapido-hybrid.provider.js';
import { DriverService } from '../src/modules/driver/driver.service.js';
import { ProfitabilityService } from '../src/modules/driver/profitability.service.js';
import { DemandService } from '../src/modules/driver/demand.service.js';
import { RecommendationService } from '../src/modules/driver/recommendation.service.js';
import { ShiftPlannerService } from '../src/modules/driver/shift-planner.service.js';
import { MarketplaceService } from '../src/modules/marketplace/marketplace.service.js';
import { MultiStopService } from '../src/modules/journey/multi-stop.service.js';

export function createRiva() {
  delete process.env.GEOAPIFY_API_KEY;
  delete process.env.APIFY_API_TOKEN;
  const config = new ConfigService({ ignoreEnvFile: true });

  const maps = new MapsService(config);
  const preferences = new PreferenceService();
  const ranking = new RankingService();
  const forecast = new ForecastService();
  const nearbyDrivers = new NearbyDriversService();
  const uber = new UberMockProvider();
  const ola = new OlaMockProvider();
  const rapido = new RapidoHybridProvider(config);
  const rideSearch = new RideSearchService(maps, preferences, uber, ola, rapido);

  const driver = new DriverService();
  const profitability = new ProfitabilityService(driver);
  const demand = new DemandService();
  const recommendation = new RecommendationService(demand);
  const shiftPlanner = new ShiftPlannerService(demand, driver);

  const marketplace = new MarketplaceService(rideSearch, ranking, nearbyDrivers, profitability, demand, recommendation, uber, ola, rapido);
  const multiStop = new MultiStopService(maps, rideSearch, ranking);

  return {
    maps,
    preferences,
    ranking,
    forecast,
    rideSearch,
    driver,
    profitability,
    demand,
    recommendation,
    shiftPlanner,
    marketplace,
    multiStop,
  };
}
