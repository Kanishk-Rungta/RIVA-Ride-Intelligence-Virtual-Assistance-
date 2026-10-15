import { Module } from '@nitrostack/core';
import { RoutingTools } from './routing.tools.js';
import { MapsService } from '../../services/maps.service.js';

/**
 * RoutingModule — makes the search layer visible. The same A* engine
 * already routes every offline ride (MapsService); this module exposes a
 * side-by-side comparison of BFS, UCS, greedy best-first, and A* so the
 * assistant can explain how and why a route was chosen.
 */
@Module({
  name: 'routing',
  description: 'Search-strategy comparison over the Coimbatore road graph (BFS, UCS, greedy, A*)',
  controllers: [RoutingTools],
  providers: [MapsService],
})
export class RoutingModule {}
