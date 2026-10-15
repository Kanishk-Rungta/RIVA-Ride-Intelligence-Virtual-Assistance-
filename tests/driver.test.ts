/**
 * Driver agent: profitability arithmetic, accept/reject decisions, and the
 * MDP shift planner.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRiva } from '../scripts/harness.js';
import { evaluatePolicy, solveByBackwardInduction, type FiniteHorizonMdp } from '../src/ai/mdp.js';
import { parseHourFromLabel, parseDateTimeLabel } from '../src/services/time.util.js';
import type { DriverTripInput } from '../src/domain/types.js';

const riva = createRiva();

const trip: DriverTripInput = {
  provider: 'uber',
  offeredFare: 310,
  tripDistance: 14,
  pickupDistance: 2.3,
  vehicleType: 'sedan',
  fuelType: 'petrol',
  currentLocation: 'Gandhipuram',
  destination: 'Coimbatore Airport',
};

describe('trip profitability', () => {
  it('net = gross − fuel − commission, and fuel covers the unpaid pickup leg', () => {
    const b = riva.profitability.analyzeTrip(trip);
    assert.equal(b.netEarning, b.grossEarning - b.fuelCost - b.platformCommission);
    assert.equal(b.platformCommission, Math.round(310 * 0.25));
    assert.equal(b.fuelCost, riva.driver.getFuelCost('sedan', 'petrol', 16.3).cost);
  });

  it('rejects a trip that loses money', () => {
    const lossy = { ...trip, offeredFare: 40, pickupDistance: 6 };
    const b = riva.profitability.analyzeTrip(lossy);
    const demand = riva.demand.getDemandForLocation(
      { query: 'x', formattedAddress: 'Coimbatore Airport', coordinates: { lat: 11.03, lng: 77.0434 }, source: 'estimated' },
      9,
      false,
      '9:00 AM'
    );
    assert.ok(b.netEarning <= 0);
    assert.equal(riva.recommendation.recommendTripAcceptance(lossy, b, demand).recommendation, 'REJECT');
  });
});

describe('finite-horizon MDP solver', () => {
  // Two states. "work" pays 10 but moves you to "tired"; in "tired", "rest"
  // pays 0 and returns you to "fresh". Over 3 steps from fresh:
  // work, rest, work = 20 beats work, work(tired pays 2), work = 14.
  const mdp: FiniteHorizonMdp<'fresh' | 'tired', 'work' | 'rest'> = {
    states: ['fresh', 'tired'],
    horizon: 3,
    actions: () => ['work', 'rest'],
    outcomes: (s, a) =>
      a === 'rest' ? [{ p: 1, next: 'fresh', reward: 0 }] : [{ p: 1, next: 'tired', reward: s === 'fresh' ? 10 : 2 }],
  };

  it('backward induction finds the known optimum', () => {
    const { values, policy } = solveByBackwardInduction(mdp);
    assert.equal(values[0].get('fresh'), 20);
    assert.equal(policy[0].get('fresh'), 'work');
    assert.equal(policy[1].get('tired'), 'rest');
  });

  it('the optimal value bounds any fixed policy', () => {
    const optimal = solveByBackwardInduction(mdp).values[0].get('fresh')!;
    assert.equal(evaluatePolicy(mdp, () => 'work')[0].get('fresh'), 14);
    assert.ok(optimal >= evaluatePolicy(mdp, () => 'rest')[0].get('fresh')!);
  });
});

describe('driver shift planner', () => {
  const zones = riva.demand.listZones();

  it('the optimal plan is never worse than greedy or stay-put, from any zone at any hour', () => {
    for (const startHour of [0, 6, 9, 13, 17, 21]) {
      for (const zone of zones) {
        const plan = riva.shiftPlanner.plan({ currentLocation: zone.coordinates, startHour, hours: 4, vehicleType: 'auto', fuelType: 'cng', provider: 'uber', weekend: false });
        assert.ok(plan.expectedEarnings.optimal >= plan.expectedEarnings.greedy - 1, `${zone.zoneKey}@${startHour}`);
        assert.ok(plan.expectedEarnings.optimal >= plan.expectedEarnings.stayPut - 1, `${zone.zoneKey}@${startHour}`);
        assert.equal(plan.itinerary.length, 4);
      }
    }
  });

  it('repositioning out of a dead zone pays at night', () => {
    const plan = riva.shiftPlanner.plan({ currentLocation: zones.find((z) => z.category === 'it_park')!.coordinates, startHour: 23, hours: 4, vehicleType: 'auto', fuelType: 'cng', provider: 'uber', weekend: false });
    assert.ok(plan.expectedEarnings.optimal > plan.expectedEarnings.stayPut);
  });
});

describe('time parsing', () => {
  it('reads common time phrases', () => {
    assert.equal(parseHourFromLabel('9 PM'), 21);
    assert.equal(parseHourFromLabel('9:30 am'), 9);
    assert.equal(parseHourFromLabel('21:00'), 21);
    assert.equal(parseHourFromLabel('12 AM'), 0);
    assert.equal(parseHourFromLabel('12 PM'), 12);
    assert.equal(parseDateTimeLabel('8 AM tomorrow').dayOffset, 1);
  });
});
