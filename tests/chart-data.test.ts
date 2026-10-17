/**
 * Data the widgets chart: the 24-hour fare curve and the per-hour demand scores.
 * The charts are only as honest as these numbers, so they must agree with the
 * single-hour values the same services report.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRiva } from '../scripts/harness.js';
import { formatHourLabel } from '../src/services/time.util.js';

const riva = createRiva();

describe('fare curve', () => {
  const curve = riva.forecast.dayCurve();

  it('covers every hour once, in order', () => {
    assert.deepEqual(curve.map((c) => c.hour), Array.from({ length: 24 }, (_, h) => h));
  });

  it('agrees with the single-hour forecast at every hour', () => {
    for (const { hour, multiplier } of curve) {
      assert.equal(multiplier, riva.forecast.forecast(formatHourLabel(hour)).forecastMultiplier, `hour ${hour}`);
    }
  });

  it('peaks in the evening rush and is cheapest in the daytime', () => {
    const best = curve.reduce((a, b) => (b.multiplier < a.multiplier ? b : a));
    const worst = curve.reduce((a, b) => (b.multiplier > a.multiplier ? b : a));
    assert.ok(best.hour >= 10 && best.hour < 18, `cheapest hour ${best.hour}`);
    assert.ok(worst.hour >= 18 && worst.hour < 21, `dearest hour ${worst.hour}`);
  });
});

describe('demand curve', () => {
  it('reports 24 scores, and the requested hour matches the headline score', async () => {
    const airport = await riva.maps.resolveLocation('Coimbatore Airport');
    for (const hour of [0, 6, 9, 13, 18, 23]) {
      const d = riva.demand.getDemandForLocation(airport, hour, false, formatHourLabel(hour));
      assert.equal(d.hourlyScores.length, 24);
      assert.equal(d.hourlyScores[hour], d.demandScore, `hour ${hour}`);
      assert.equal(d.hour, hour);
      assert.ok(d.hourlyScores.every((s) => s >= 0 && s <= 100));
    }
  });

  it('waiting time falls as demand rises', () => {
    const waits = [0, 25, 50, 75, 100].map((s) => riva.demand.expectedWaitMinutes(s));
    for (let i = 1; i < waits.length; i++) assert.ok(waits[i] < waits[i - 1]);
  });
});
