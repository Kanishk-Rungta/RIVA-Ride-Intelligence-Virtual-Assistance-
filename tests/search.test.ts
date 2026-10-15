/**
 * Search layer: optimality, efficiency, and heuristic properties, checked
 * exhaustively over every ordered pair of road-graph nodes rather than on a
 * hand-picked example.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { search, MinHeap, type SearchProblem } from '../src/ai/search.js';
import { ROAD_NODES, ROAD_EDGES, edgeMinutes, findRoute, routeProblem, findNodeByText, nearestNode } from '../src/ai/road-network.js';
import { optimizeStopOrder, pathCost } from '../src/ai/tour.js';
import { createSeededRandom, haversineDistanceKm } from '../src/services/sim.util.js';

const pairs = ROAD_NODES.flatMap((a) => ROAD_NODES.filter((b) => b.id !== a.id).map((b) => [a.id, b.id] as const));
const HOURS = [3, 9, 14, 19];

describe('MinHeap', () => {
  it('pops in priority order and breaks ties first-in-first-out', () => {
    const heap = new MinHeap<string>();
    [['c', 3], ['a', 1], ['b1', 2], ['b2', 2], ['d', 4]].forEach(([v, p]) => heap.push(v as string, p as number));
    assert.deepEqual([heap.pop(), heap.pop(), heap.pop(), heap.pop(), heap.pop(), heap.pop()], ['a', 'b1', 'b2', 'c', 'd', undefined]);
  });
});

describe('road graph', () => {
  it('is connected: BFS from any node reaches every other node', () => {
    for (const [from, to] of pairs) assert.ok(findRoute(from, to, { strategy: 'bfs' }).found, `${from} → ${to}`);
  });

  it('has positive edge lengths no shorter than the straight line', () => {
    const byId = new Map(ROAD_NODES.map((n) => [n.id, n]));
    for (const e of ROAD_EDGES) {
      assert.ok(e.lengthKm > 0);
      assert.ok(e.lengthKm + 1e-9 >= haversineDistanceKm(byId.get(e.from)!.coordinates, byId.get(e.to)!.coordinates) - 0.01);
    }
  });

  it('matches place names and snaps nearby coordinates', () => {
    assert.equal(findNodeByText('Amrita University Ettimadai')?.id, 'amrita');
    assert.equal(findNodeByText('flight from Coimbatore Airport')?.id, 'airport');
    assert.equal(findNodeByText('Mumbai'), null);
    assert.equal(nearestNode({ lat: 11.0185, lng: 76.968 })?.node.id, 'gandhipuram');
    assert.equal(nearestNode({ lat: 19.076, lng: 72.8777 }), null, 'Mumbai is far off the graph');
  });
});

describe('A* versus uninformed and greedy search', () => {
  for (const objective of ['time', 'distance'] as const) {
    it(`A* cost equals UCS cost on every pair (${objective}, ${HOURS.length} hours)`, () => {
      for (const hour of HOURS) {
        for (const [from, to] of pairs) {
          const a = findRoute(from, to, { strategy: 'astar', objective, hour });
          const u = findRoute(from, to, { strategy: 'ucs', objective, hour });
          assert.ok(Math.abs(a.search.cost - u.search.cost) < 1e-9, `${from} → ${to} @${hour}: A* ${a.search.cost} vs UCS ${u.search.cost}`);
        }
      }
    });

    it(`A* never expands more nodes than UCS (${objective})`, () => {
      let astarTotal = 0;
      let ucsTotal = 0;
      for (const [from, to] of pairs) {
        const a = findRoute(from, to, { strategy: 'astar', objective, hour: 9 }).search.nodesExpanded;
        const u = findRoute(from, to, { strategy: 'ucs', objective, hour: 9 }).search.nodesExpanded;
        assert.ok(a <= u, `${from} → ${to}: A* ${a} > UCS ${u}`);
        astarTotal += a;
        ucsTotal += u;
      }
      assert.ok(astarTotal < ucsTotal, 'the heuristic should prune something overall');
    });

    it(`heuristic is admissible and consistent (${objective})`, () => {
      for (const goal of ROAD_NODES) {
        for (const hour of HOURS) {
          const problem = routeProblem(ROAD_NODES[0].id, goal.id, objective, hour);
          for (const n of ROAD_NODES) {
            const trueCost = findRoute(n.id, goal.id, { strategy: 'ucs', objective, hour }).search.cost;
            assert.ok(problem.heuristic(n.id) <= trueCost + 1e-9, `h(${n.id}) > h*(${n.id}) towards ${goal.id}`);
            for (const s of problem.successors(n.id)) {
              assert.ok(problem.heuristic(n.id) <= s.cost + problem.heuristic(s.state) + 1e-9, `inconsistent on ${n.id} → ${s.state}`);
            }
          }
        }
      }
    });
  }

  it('greedy and BFS always find a path, never cheaper than the optimum', () => {
    for (const [from, to] of pairs) {
      const best = findRoute(from, to, { strategy: 'astar', hour: 9 }).search.cost;
      for (const strategy of ['greedy', 'bfs'] as const) {
        const r = findRoute(from, to, { strategy, hour: 9 });
        assert.ok(r.found);
        assert.ok(r.search.cost >= best - 1e-9);
      }
    }
  });

  it('BFS finds the path with the fewest road segments', () => {
    for (const [from, to] of pairs) {
      const bfsHops = findRoute(from, to, { strategy: 'bfs' }).nodeIds.length;
      const astarHops = findRoute(from, to, { strategy: 'astar', hour: 9 }).nodeIds.length;
      assert.ok(bfsHops <= astarHops);
    }
  });

  it('the fastest route can be longer than the shortest route (Amrita → Airport at 9 AM)', () => {
    const fastest = findRoute('amrita', 'airport', { objective: 'time', hour: 9 });
    const shortest = findRoute('amrita', 'airport', { objective: 'distance', hour: 9 });
    assert.ok(fastest.durationMinutes < shortest.durationMinutes);
    assert.ok(fastest.distanceKm > shortest.distanceKm);
    assert.ok(fastest.via.includes('Neelambur'), 'rush-hour fastest route takes the L&T bypass');
  });

  it('rush hour never makes a trip faster', () => {
    for (const [from, to] of pairs.slice(0, 200)) {
      const night = findRoute(from, to, { hour: 3 }).durationMinutes;
      const peak = findRoute(from, to, { hour: 9 }).durationMinutes;
      assert.ok(peak >= night);
    }
    for (const e of ROAD_EDGES) assert.ok(edgeMinutes(e, 9) >= edgeMinutes(e, 3));
  });

  it('reports failure on an unreachable goal instead of looping', () => {
    const island: SearchProblem<number> = {
      initial: 0,
      isGoal: (s) => s === 99,
      key: String,
      successors: (s) => (s < 5 ? [{ state: s + 1, cost: 1 }] : []),
      heuristic: () => 0,
    };
    const r = search(island, 'astar');
    assert.equal(r.found, false);
    assert.equal(r.nodesExpanded, 6);
  });
});

describe('multi-stop ordering (A* over visited-set states)', () => {
  const permutations = (items: number[]): number[][] =>
    items.length <= 1 ? [items] : items.flatMap((x, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((p) => [x, ...p]));

  it('matches brute force on random metric instances with 3–7 stops', () => {
    const rng = createSeededRandom(42);
    for (let trial = 0; trial < 60; trial++) {
      const n = 3 + (trial % 5);
      const points = Array.from({ length: n }, () => ({ lat: 10.9 + rng() * 0.2, lng: 76.9 + rng() * 0.2 }));
      const cost = points.map((a) => points.map((b) => haversineDistanceKm(a, b)));
      const result = optimizeStopOrder(cost);

      const middle = Array.from({ length: n - 2 }, (_, i) => i + 1);
      const bruteForce = Math.min(...permutations(middle).map((p) => pathCost(cost, [0, ...p, n - 1])));

      assert.ok(Math.abs(result.cost - bruteForce) < 1e-9, `trial ${trial}: A* ${result.cost} vs brute force ${bruteForce}`);
      assert.equal(result.order[0], 0);
      assert.equal(result.order.at(-1), n - 1);
      assert.equal(new Set(result.order).size, n, 'every stop exactly once');
      assert.ok(result.cost <= result.givenOrderCost + 1e-9);
    }
  });
});
