import { ToolDecorator as Tool, Widget, ExecutionContext, Injectable, z } from '@nitrostack/core';
import { MapsService } from '../../services/maps.service.js';
import { ROAD_EDGES, ROAD_NODES, findNodeByText, findRoute, nearestNode, type RoadNode, type RouteObjective } from '../../ai/road-network.js';
import { SEARCH_STRATEGIES, type SearchStrategy } from '../../ai/search.js';
import { formatHourLabel, parseDateTimeLabel } from '../../services/time.util.js';

const STRATEGY_LABEL: Record<SearchStrategy, string> = {
  bfs: 'Breadth-first search',
  ucs: 'Uniform-cost search',
  greedy: 'Greedy best-first',
  astar: 'A* search',
};

@Injectable({ deps: [MapsService] })
export class RoutingTools {
  constructor(private readonly maps: MapsService) {}

  @Tool({
    name: 'compare_search_strategies',
    description:
      'Explain how RIVA plans a route: runs breadth-first, uniform-cost, greedy best-first, and A* search over the Coimbatore road graph between two places, and compares path cost, optimality, and nodes expanded. Use when the user asks how routing works or why a route was chosen.',
    inputSchema: z.object({
      origin: z.string().describe('Start, e.g. "Amrita University"'),
      destination: z.string().describe('End, e.g. "Coimbatore Airport"'),
      objective: z.enum(['time', 'distance']).optional().describe('Minimise travel time (default, congestion-aware) or distance'),
      time: z.string().optional().describe('Departure time for congestion, e.g. "9 AM" (default: now)'),
    }),
    examples: {
      request: { origin: 'Amrita University', destination: 'Coimbatore Airport', objective: 'time', time: '9 AM' },
    },
  })
  @Widget('search-comparison')
  async compareSearchStrategies(
    input: { origin: string; destination: string; objective?: RouteObjective; time?: string },
    ctx: ExecutionContext
  ) {
    const objective = input.objective ?? 'time';
    const hour = input.time ? parseDateTimeLabel(input.time).hour : new Date().getHours();
    const [from, to] = await Promise.all([this.snap(input.origin, ctx), this.snap(input.destination, ctx)]);
    if (from.node.id === to.node.id) {
      throw new Error(`"${input.origin}" and "${input.destination}" map to the same junction (${from.node.name}); pick places further apart.`);
    }

    const runs = SEARCH_STRATEGIES.map((strategy) => findRoute(from.node.id, to.node.id, { strategy, objective, hour }));
    const costOf = (r: (typeof runs)[number]) => (objective === 'time' ? r.durationMinutes : r.distanceKm);
    const optimalCost = Math.min(...runs.map((r) => r.search.cost));
    const ucs = runs.find((r) => r.strategy === 'ucs')!;
    const astar = runs.find((r) => r.strategy === 'astar')!;
    const greedy = runs.find((r) => r.strategy === 'greedy')!;
    const unit = objective === 'time' ? 'min' : 'km';

    const saved = ucs.search.nodesExpanded > 0 ? Math.round((1 - astar.search.nodesExpanded / ucs.search.nodesExpanded) * 100) : 0;
    const greedyGap = Math.round(((costOf(greedy) - costOf(astar)) / Math.max(costOf(astar), 1)) * 100);
    const insight =
      `A* found the optimal ${objective === 'time' ? 'fastest' : 'shortest'} route (${costOf(astar)} ${unit}) expanding ${astar.search.nodesExpanded} nodes, ` +
      `${saved}% fewer than uniform-cost search (${ucs.search.nodesExpanded}). ` +
      (greedyGap > 0
        ? `Greedy best-first expanded only ${greedy.search.nodesExpanded} but its route is ${greedyGap}% worse — it chases straight-line closeness and ignores congestion.`
        : `Greedy best-first happened to find an equally good route here, expanding ${greedy.search.nodesExpanded} nodes.`);

    // The other objective's optimum, to show that "shortest" and "fastest" are different questions.
    const alternative = findRoute(from.node.id, to.node.id, { strategy: 'astar', objective: objective === 'time' ? 'distance' : 'time', hour });

    return {
      origin: { query: input.origin, node: from.node.name, snappedKm: from.snappedKm },
      destination: { query: input.destination, node: to.node.name, snappedKm: to.snappedKm },
      objective,
      time: formatHourLabel(hour),
      results: runs.map((r) => ({
        strategy: r.strategy,
        label: STRATEGY_LABEL[r.strategy],
        found: r.found,
        via: r.via,
        nodeIds: r.nodeIds,
        distanceKm: r.distanceKm,
        durationMinutes: r.durationMinutes,
        cost: Math.round(r.search.cost * 10) / 10,
        optimal: Math.abs(r.search.cost - optimalCost) < 1e-9,
        nodesExpanded: r.search.nodesExpanded,
        nodesGenerated: r.search.nodesGenerated,
        maxFrontierSize: r.search.maxFrontierSize,
        expandedOrder: r.search.expandedOrder,
      })),
      alternativeObjective: {
        objective: alternative.objective,
        via: alternative.via,
        distanceKm: alternative.distanceKm,
        durationMinutes: alternative.durationMinutes,
      },
      insight,
      heuristic:
        objective === 'time'
          ? 'h(n) = straight-line km to goal ÷ 55 km/h (fastest free-flow speed) — never overestimates, so A* is optimal.'
          : 'h(n) = straight-line km to goal — never longer than any road, so A* is optimal.',
      graph: {
        nodes: ROAD_NODES.map((n) => ({ id: n.id, name: n.name, lat: n.coordinates.lat, lng: n.coordinates.lng })),
        edges: ROAD_EDGES.map((e) => ({ from: e.from, to: e.to, roadClass: e.roadClass })),
      },
    };
  }

  /** Matches a place to a graph node by name first, then by geocoded position. */
  private async snap(query: string, ctx: ExecutionContext): Promise<{ node: RoadNode; snappedKm: number }> {
    const byName = findNodeByText(query);
    if (byName) return { node: byName, snappedKm: 0 };
    const resolved = await this.maps.resolveLocation(query, ctx.logger);
    const near = nearestNode(resolved.coordinates, 3);
    if (!near) {
      throw new Error(
        `"${query}" is outside the Coimbatore road graph. Try one of: ${ROAD_NODES.slice(0, 12).map((n) => n.name).join(', ')}…`
      );
    }
    return { node: near.node, snappedKm: Math.round(near.distanceKm * 10) / 10 };
  }
}
