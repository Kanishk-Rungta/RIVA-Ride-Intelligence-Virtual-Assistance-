import { Module } from '@nitrostack/core';
import { MarketplaceTools } from './marketplace.tools.js';
import { MarketplaceService } from './marketplace.service.js';
import { RideSearchService } from '../../services/ride-search.service.js';
import { RankingService } from '../../services/ranking.service.js';
import { NearbyDriversService } from '../../services/nearby-drivers.service.js';
import { ProfitabilityService } from '../driver/profitability.service.js';
import { DemandService } from '../driver/demand.service.js';
import { RecommendationService } from '../driver/recommendation.service.js';
import { DriverService } from '../driver/driver.service.js';

/**
 * MarketplaceModule — the multi-agent layer that ties the rider side and
 * the driver side together. Rider, provider, and driver agents negotiate
 * every ride through nested Contract Nets; the JourneyModule's booking
 * simulation uses the same market to find a driver who actually accepts.
 *
 * Shared services are re-listed here for the same reason as in the other
 * modules: NitroStack's DI container is global, so this resolves to the
 * existing singletons rather than creating new instances.
 */
@Module({
  name: 'marketplace',
  description: 'Multi-agent ride marketplace: rider, provider, and driver agents negotiating via FIPA Contract Net',
  controllers: [MarketplaceTools],
  providers: [
    MarketplaceService,
    RideSearchService,
    RankingService,
    NearbyDriversService,
    ProfitabilityService,
    DemandService,
    RecommendationService,
    DriverService,
  ],
})
export class MarketplaceModule {}
