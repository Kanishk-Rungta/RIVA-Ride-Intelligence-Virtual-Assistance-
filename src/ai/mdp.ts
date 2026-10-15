/**
 * Finite-horizon Markov decision process solver.
 *
 * Sequential decision-making under uncertainty: at each step t the agent is
 * in state s, picks action a, and lands in s' with probability p while
 * collecting reward r. Backward induction applies the Bellman optimality
 * equation from the last step to the first:
 *
 *   V_H(s) = 0
 *   Q_t(s, a) = Σ p · (r + V_{t+1}(s'))
 *   V_t(s) = max_a Q_t(s, a),   π_t(s) = argmax_a Q_t(s, a)
 *
 * This is exact for a finite horizon — no discounting, no convergence
 * threshold. evaluatePolicy() runs the same recursion with a fixed policy
 * instead of the max, which is how the optimal plan is compared against
 * myopic baselines.
 */

export interface Outcome<S> {
  p: number;
  next: S;
  reward: number;
}

export interface FiniteHorizonMdp<S extends string, A extends string> {
  states: S[];
  horizon: number;
  actions(state: S, t: number): A[];
  outcomes(state: S, action: A, t: number): Outcome<S>[];
}

export interface MdpSolution<S extends string, A extends string> {
  /** values[t].get(s) = optimal expected return from s with H - t steps to go; values[H] is all zeros. */
  values: Array<Map<S, number>>;
  policy: Array<Map<S, A>>;
}

export function qValue<S extends string, A extends string>(
  mdp: FiniteHorizonMdp<S, A>,
  next: Map<S, number>,
  state: S,
  action: A,
  t: number
): number {
  return mdp.outcomes(state, action, t).reduce((sum, o) => sum + o.p * (o.reward + (next.get(o.next) ?? 0)), 0);
}

export function solveByBackwardInduction<S extends string, A extends string>(mdp: FiniteHorizonMdp<S, A>): MdpSolution<S, A> {
  const values: Array<Map<S, number>> = Array.from({ length: mdp.horizon + 1 }, () => new Map());
  const policy: Array<Map<S, A>> = Array.from({ length: mdp.horizon }, () => new Map());
  for (const s of mdp.states) values[mdp.horizon].set(s, 0);

  for (let t = mdp.horizon - 1; t >= 0; t--) {
    for (const s of mdp.states) {
      let best = -Infinity;
      let bestAction: A | undefined;
      for (const a of mdp.actions(s, t)) {
        const q = qValue(mdp, values[t + 1], s, a, t);
        if (q > best) {
          best = q;
          bestAction = a;
        }
      }
      values[t].set(s, best);
      policy[t].set(s, bestAction!);
    }
  }
  return { values, policy };
}

export function evaluatePolicy<S extends string, A extends string>(
  mdp: FiniteHorizonMdp<S, A>,
  choose: (state: S, t: number) => A
): Array<Map<S, number>> {
  const values: Array<Map<S, number>> = Array.from({ length: mdp.horizon + 1 }, () => new Map());
  for (const s of mdp.states) values[mdp.horizon].set(s, 0);
  for (let t = mdp.horizon - 1; t >= 0; t--) {
    for (const s of mdp.states) values[t].set(s, qValue(mdp, values[t + 1], s, choose(s, t), t));
  }
  return values;
}
