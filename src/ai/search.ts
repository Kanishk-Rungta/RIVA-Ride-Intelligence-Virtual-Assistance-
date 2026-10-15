/**
 * Generic best-first graph search (Russell & Norvig, AIMA ch. 3).
 *
 * One engine serves every search problem in RIVA — road routing on the
 * Coimbatore graph and multi-stop tour ordering. The four strategies differ
 * only in the priority f(n) that orders the frontier:
 *
 *   bfs     f(n) = depth(n)          fewest edges; optimal only for unit costs
 *   ucs     f(n) = g(n)              Dijkstra; optimal for non-negative costs
 *   greedy  f(n) = h(n)              heads straight for the goal; not optimal
 *   astar   f(n) = g(n) + h(n)       optimal when h is admissible
 *
 * The goal test runs when a node is popped, not when it is generated, which
 * is what keeps UCS and A* optimal. Instead of a decrease-key operation the
 * frontier may hold duplicate entries for a state; stale ones (a cheaper
 * path was found later) are skipped on pop. For the cost-aware strategies a
 * state is re-opened whenever a cheaper path to it appears, so A* stays
 * optimal even with an admissible-but-inconsistent heuristic.
 */

export type SearchStrategy = 'bfs' | 'ucs' | 'greedy' | 'astar';

export const SEARCH_STRATEGIES: SearchStrategy[] = ['bfs', 'ucs', 'greedy', 'astar'];

export interface Successor<S> {
  state: S;
  cost: number;
}

export interface SearchProblem<S> {
  initial: S;
  isGoal(state: S): boolean;
  successors(state: S): Successor<S>[];
  /** Stable identity of a state, used for duplicate detection. */
  key(state: S): string;
  /** Estimated cost from state to the nearest goal. Must never overestimate for A* to be optimal. */
  heuristic(state: S): number;
}

export interface SearchResult<S> {
  strategy: SearchStrategy;
  found: boolean;
  path: S[];
  cost: number;
  nodesExpanded: number;
  nodesGenerated: number;
  maxFrontierSize: number;
  /** State keys in the order they were expanded — drives the "explored region" visualisation. */
  expandedOrder: string[];
}

/** Binary min-heap. Ties on priority are broken by insertion order, so BFS stays FIFO. */
export class MinHeap<T> {
  private items: Array<{ priority: number; seq: number; value: T }> = [];
  private seq = 0;

  get size(): number {
    return this.items.length;
  }

  push(value: T, priority: number): void {
    this.items.push({ priority, seq: this.seq++, value });
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(i, parent)) break;
      [this.items[i], this.items[parent]] = [this.items[parent], this.items[i]];
      i = parent;
    }
  }

  pop(): T | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (left < this.items.length && this.less(left, smallest)) smallest = left;
        if (right < this.items.length && this.less(right, smallest)) smallest = right;
        if (smallest === i) break;
        [this.items[i], this.items[smallest]] = [this.items[smallest], this.items[i]];
        i = smallest;
      }
    }
    return top.value;
  }

  private less(a: number, b: number): boolean {
    const x = this.items[a];
    const y = this.items[b];
    return x.priority < y.priority || (x.priority === y.priority && x.seq < y.seq);
  }
}

interface SearchNode<S> {
  state: S;
  g: number;
  depth: number;
  parent: SearchNode<S> | null;
}

/** Hard ceiling on expansions so a malformed problem can never hang a tool call. */
const MAX_EXPANSIONS = 250_000;

export function search<S>(problem: SearchProblem<S>, strategy: SearchStrategy): SearchResult<S> {
  const costAware = strategy === 'ucs' || strategy === 'astar';
  const priority = (node: SearchNode<S>): number => {
    switch (strategy) {
      case 'bfs':
        return node.depth;
      case 'ucs':
        return node.g;
      case 'greedy':
        return problem.heuristic(node.state);
      case 'astar':
        return node.g + problem.heuristic(node.state);
    }
  };

  const frontier = new MinHeap<SearchNode<S>>();
  const bestG = new Map<string, number>();
  const expandedOrder: string[] = [];
  let nodesGenerated = 1;
  let maxFrontierSize = 1;

  const root: SearchNode<S> = { state: problem.initial, g: 0, depth: 0, parent: null };
  frontier.push(root, priority(root));
  bestG.set(problem.key(root.state), 0);

  while (frontier.size > 0 && expandedOrder.length < MAX_EXPANSIONS) {
    const node = frontier.pop()!;
    const key = problem.key(node.state);
    if (node.g > (bestG.get(key) ?? Infinity)) continue; // stale duplicate

    if (problem.isGoal(node.state)) {
      return {
        strategy,
        found: true,
        path: reconstructPath(node),
        cost: node.g,
        nodesExpanded: expandedOrder.length,
        nodesGenerated,
        maxFrontierSize,
        expandedOrder,
      };
    }

    expandedOrder.push(key);
    for (const { state, cost } of problem.successors(node.state)) {
      const childKey = problem.key(state);
      const g = node.g + cost;
      const known = bestG.get(childKey);
      // BFS and greedy generate each state once; UCS and A* re-open on a cheaper path.
      if (known !== undefined && (!costAware || g >= known)) continue;
      bestG.set(childKey, g);
      const child: SearchNode<S> = { state, g, depth: node.depth + 1, parent: node };
      frontier.push(child, priority(child));
      nodesGenerated++;
    }
    maxFrontierSize = Math.max(maxFrontierSize, frontier.size);
  }

  return {
    strategy,
    found: false,
    path: [],
    cost: Infinity,
    nodesExpanded: expandedOrder.length,
    nodesGenerated,
    maxFrontierSize,
    expandedOrder,
  };
}

function reconstructPath<S>(node: SearchNode<S>): S[] {
  const path: S[] = [];
  for (let n: SearchNode<S> | null = node; n; n = n.parent) path.push(n.state);
  return path.reverse();
}
