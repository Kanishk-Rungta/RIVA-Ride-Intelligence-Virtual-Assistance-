/**
 * Rider agent: constraint satisfaction, Pareto dominance, and the learning
 * utility function.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRiva } from '../scripts/harness.js';
import { RankingService } from '../src/services/ranking.service.js';
import type { RideOption } from '../src/domain/types.js';

const option = (id: string, fare: number, eta: number, rating: number, extra: Partial<RideOption> = {}): RideOption => ({
  optionId: id,
  provider: 'uber',
  providerName: 'Uber',
  vehicleType: 'mini',
  fare,
  currency: 'INR',
  pickupEtaMinutes: eta,
  tripDurationMinutes: 20,
  distanceKm: 10,
  availability: true,
  isSimulated: true,
  rating,
  hasFemaleDriverOption: false,
  luggageFriendly: false,
  surgeMultiplier: 1,
  dataSource: 'simulation',
  ...extra,
});

describe('preference constraints', () => {
  const { rideSearch } = createRiva();
  const pool = [
    option('cheap-bike', 60, 3, 4.2, { vehicleType: 'bike' }),
    option('auto', 110, 5, 4.4, { vehicleType: 'auto', hasFemaleDriverOption: true }),
    option('sedan', 260, 6, 4.7, { vehicleType: 'sedan', luggageFriendly: true, hasFemaleDriverOption: true }),
  ];

  it('applies every constraint when they can all be met', () => {
    const r = rideSearch.satisfyPreferences(pool, { budgetLimit: 150, excludeVehicleTypes: ['bike'] });
    assert.deepEqual(r.options.map((o) => o.optionId), ['auto']);
    assert.deepEqual(r.relaxed, []);
  });

  it('relaxes the lowest-priority soft constraint first', () => {
    // Luggage + budget ₹150 is impossible; budget is relaxed, luggage (higher priority) is kept.
    const r = rideSearch.satisfyPreferences(pool, { luggageRequired: true, budgetLimit: 150 });
    assert.deepEqual(r.options.map((o) => o.optionId), ['sedan']);
    assert.deepEqual(r.relaxed, ['budgetLimit']);
  });

  it('never relaxes the female-driver safety constraint', () => {
    const r = rideSearch.satisfyPreferences([pool[0]], { femaleDriverOnly: true });
    assert.equal(r.options.length, 0);
    assert.equal(r.unsatisfiableHard, 'femaleDriverOnly');
  });
});

describe('Pareto dominance', () => {
  it('flags an option that is worse on every criterion', () => {
    const ranking = new RankingService();
    const ranked = ranking.rank([option('good', 100, 3, 4.8), option('dominated', 120, 5, 4.5), option('fast', 150, 1, 4.6)], 'best_value');
    const flag = Object.fromEntries(ranked.map((o) => [o.optionId, o.paretoOptimal]));
    assert.deepEqual(flag, { good: true, dominated: false, fast: true });
  });
});

describe('utility learning', () => {
  // Under the default 45/35/20 weights "mid" ranks first and "pricey-fast" last.
  const pool = [option('cheap-slow', 90, 9, 4.5), option('pricey-fast', 200, 3, 4.5), option('mid', 120, 6, 4.5)];

  it('a rider who keeps paying for speed shifts weight from fare to pickup ETA', () => {
    const ranking = new RankingService();
    assert.equal(ranking.rank(pool, 'best_value').at(-1)!.optionId, 'pricey-fast');
    const before = ranking.getWeights();
    for (let i = 0; i < 3; i++) ranking.learnFromChoice(pool[1], pool);
    const after = ranking.getWeights();
    assert.ok(after.pickupEta > before.pickupEta);
    assert.ok(after.fare < before.fare);
    assert.ok(Math.abs(after.fare + after.pickupEta + after.rating - 1) < 1e-9, 'weights stay a convex combination');
    assert.equal(ranking.rank(pool, 'best_value')[0].optionId, 'pricey-fast', 'the learned utility now ranks the revealed choice first');
  });

  it('does not move when the rider picks what was already ranked first', () => {
    const ranking = new RankingService();
    const top = ranking.rank(pool, 'best_value')[0];
    const { before, after, violations } = ranking.learnFromChoice(top, pool);
    assert.equal(violations, 0);
    assert.deepEqual(after, before);
  });
});

describe('end-to-end ride search (offline)', () => {
  it('routes Coimbatore trips over the road graph with A*', async () => {
    const { rideSearch } = createRiva();
    const { context, filteredOptions } = await rideSearch.search('Amrita University', 'Coimbatore Airport', undefined, undefined, 9);
    assert.equal(context.route.source, 'road_graph');
    assert.equal(context.route.search?.strategy, 'astar');
    assert.ok(context.route.via!.length > 2);
    assert.ok(filteredOptions.length >= 8, 'three providers bid');
  });

  it('falls back to a straight-line estimate off the graph', async () => {
    const { rideSearch } = createRiva();
    const { context } = await rideSearch.search('Marine Drive', 'Juhu Beach', undefined);
    assert.equal(context.route.source, 'estimated');
  });

  it('multi-stop planner reorders stops to save time', async () => {
    const { multiStop } = createRiva();
    const plan = await multiStop.planTrip(['Amrita University', 'Coimbatore Airport', 'Ukkadam', 'Gandhipuram', 'Coimbatore Junction'], true);
    assert.ok(plan.optimization);
    assert.ok(plan.optimization!.optimizedEstimateMinutes <= plan.optimization!.originalEstimateMinutes);
    assert.equal(plan.stops[0].formattedAddress, plan.optimization!.originalOrder[0]);
    assert.equal(plan.stops.at(-1)!.formattedAddress, plan.optimization!.originalOrder.at(-1));
  });
});
