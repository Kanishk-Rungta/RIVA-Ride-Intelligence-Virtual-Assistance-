/**
 * Multi-stop ordering as state-space search.
 *
 * The rider fixes the start (index 0) and the final destination (index
 * n-1); the intermediate stops may be visited in any order. That is an
 * open travelling-salesman path problem. We solve it exactly with the same
 * A* engine used for routing, over states (current stop, set of stops
 * already visited):
 *
 *   successor  go to an unvisited intermediate stop, or — once all are
 *              visited — to the final destination
 *   cost       cost[from][to] (travel minutes)
 *   heuristic  max over unvisited stops u of cost[cur][u] + cost[u][end]
 *
 * The heuristic is admissible whenever the cost matrix obeys the triangle
 * inequality (true for shortest-path travel times): any completion must
 * pass through u and then reach the end, and no detour can be shorter than
 * going direct. The state space has n·2^(n-2) states, so this is exact and
 * instant for the ≤ 8 intermediate stops the tool accepts.
 */
import { search, type SearchProblem, type SearchStrategy } from './search.js';

interface TourState {
  at: number;
  visited: number; // bitmask over all stop indices
}

export interface TourResult {
  order: number[];
  cost: number;
  givenOrderCost: number;
  savedCost: number;
  statesExpanded: number;
  statesGenerated: number;
  strategy: SearchStrategy;
}

export function tourProblem(cost: number[][]): SearchProblem<TourState> {
  const n = cost.length;
  const end = n - 1;
  const intermediates = Array.from({ length: Math.max(0, n - 2) }, (_, i) => i + 1);
  const allIntermediates = intermediates.reduce((mask, i) => mask | (1 << i), 0);

  return {
    initial: { at: 0, visited: 1 },
    isGoal: (s) => s.at === end,
    key: (s) => `${s.at}|${s.visited}`,
    successors: (s) => {
      if ((s.visited & allIntermediates) === allIntermediates) {
        return [{ state: { at: end, visited: s.visited | (1 << end) }, cost: cost[s.at][end] }];
      }
      return intermediates
        .filter((i) => !(s.visited & (1 << i)))
        .map((i) => ({ state: { at: i, visited: s.visited | (1 << i) }, cost: cost[s.at][i] }));
    },
    heuristic: (s) => {
      if (s.at === end) return 0;
      let h = cost[s.at][end];
      for (const u of intermediates) {
        if (!(s.visited & (1 << u))) h = Math.max(h, cost[s.at][u] + cost[u][end]);
      }
      return h;
    },
  };
}

export function pathCost(cost: number[][], order: number[]): number {
  let total = 0;
  for (let i = 1; i < order.length; i++) total += cost[order[i - 1]][order[i]];
  return total;
}

export function optimizeStopOrder(cost: number[][], strategy: SearchStrategy = 'astar'): TourResult {
  const n = cost.length;
  const givenOrder = Array.from({ length: n }, (_, i) => i);
  const givenOrderCost = pathCost(cost, givenOrder);

  if (n <= 3) {
    return { order: givenOrder, cost: givenOrderCost, givenOrderCost, savedCost: 0, statesExpanded: 0, statesGenerated: 0, strategy };
  }

  const result = search(tourProblem(cost), strategy);
  const order = result.path.map((s) => s.at);
  return {
    order,
    cost: result.cost,
    givenOrderCost,
    savedCost: givenOrderCost - result.cost,
    statesExpanded: result.nodesExpanded,
    statesGenerated: result.nodesGenerated,
    strategy,
  };
}
