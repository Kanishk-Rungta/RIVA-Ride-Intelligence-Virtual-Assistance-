/**
 * Multi-agent marketplace: protocol invariants of the nested Contract Nets,
 * checked on a spread of trips, times, and seeds.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRiva } from '../scripts/harness.js';
import { MessageBus, type Agent, type AclMessage } from '../src/agents/acl.js';

const riva = createRiva();

const SCENARIOS = [
  ['Amrita University', 'Coimbatore Airport', 9],
  ['Amrita University', 'Coimbatore Airport', 23],
  ['Gandhipuram', 'RS Puram', 18],
  ['Peelamedu', 'Coimbatore Junction', 8],
  ['Saravanampatti', 'Ukkadam', 13],
  ['Singanallur', 'Tidel Park', 21],
] as const;

async function runAll() {
  const results = [];
  for (const [origin, destination, hour] of SCENARIOS) {
    for (const seed of ['s1', 's2', 's3']) {
      results.push(await riva.marketplace.simulate(origin, destination, undefined, { hour, seed, weekend: false }));
    }
  }
  return results;
}

describe('message bus', () => {
  it('delivers in timestamp order, not send order', async () => {
    const received: string[] = [];
    const sink: Agent = { id: 'sink', role: 'rider', receive: (m: AclMessage) => void received.push(m.summary) };
    const bus = new MessageBus();
    bus.register(sink);
    bus.send({ from: 'x', to: 'sink', performative: 'INFORM', conversationId: 'c', content: {}, summary: 'slow' }, 5);
    bus.send({ from: 'x', to: 'sink', performative: 'INFORM', conversationId: 'c', content: {}, summary: 'fast' }, 1);
    await bus.run();
    assert.deepEqual(received, ['fast', 'slow']);
  });

  it('rejects messages to unknown agents', async () => {
    const bus = new MessageBus();
    bus.send({ from: 'x', to: 'nobody', performative: 'INFORM', conversationId: 'c', content: {}, summary: '' });
    await assert.rejects(bus.run(), /No agent registered/);
  });
});

describe('Contract Net protocol', async () => {
  const results = await runAll();

  it('every call for proposals gets exactly one reply from its recipient', () => {
    for (const r of results) {
      for (const cfp of r.messages.filter((m) => m.performative === 'CFP')) {
        const replies = r.messages.filter(
          (m) => m.from === cfp.to && m.to === cfp.from && m.conversationId === cfp.conversationId && ['PROPOSE', 'REFUSE'].includes(m.performative)
        );
        assert.equal(replies.length, 1, `${cfp.to} replied ${replies.length}× to ${cfp.conversationId}`);
      }
    }
  });

  it('message timestamps never go backwards', () => {
    for (const r of results) {
      for (let i = 1; i < r.messages.length; i++) assert.ok(r.messages[i].t >= r.messages[i - 1].t);
    }
  });

  it('a matched ride goes to a driver who proposed, and every bid is closed', () => {
    for (const r of results) {
      if (r.outcome.status !== 'MATCHED') continue;
      const driverId = r.outcome.driver!.id;
      assert.ok(r.messages.some((m) => m.from === driverId && m.performative === 'PROPOSE'), 'assigned driver had accepted');
      assert.equal(r.messages.filter((m) => m.to === driverId && m.performative === 'ACCEPT_PROPOSAL').length, 1);
      assert.equal(r.messages.filter((m) => m.performative === 'INFORM').length, 1, 'rider informed once');
      assert.equal(r.outcome.driver!.provider, r.outcome.option!.provider, 'driver works for the winning provider');
      assert.equal(r.outcome.driver!.vehicleType, r.outcome.option!.vehicleType, 'driver has the vehicle the rider chose');

      const bidders = new Set(r.messages.filter((m) => m.performative === 'PROPOSE' && m.from.startsWith('provider:')).map((m) => m.from));
      const winner = r.messages.find((m) => m.performative === 'INFORM')!.from;
      for (const b of bidders) {
        if (b !== winner) assert.ok(r.messages.some((m) => m.to === b && m.performative === 'REJECT_PROPOSAL'), `${b} never heard back`);
      }
    }
  });

  it('at most one driver is assigned per award, and no refusing driver is assigned', () => {
    for (const r of results) {
      const assigned = r.messages.filter((m) => m.performative === 'ACCEPT_PROPOSAL' && m.to.startsWith('driver:'));
      for (const a of assigned) {
        const reply = r.messages.find((m) => m.from === a.to && m.conversationId === a.conversationId);
        assert.equal(reply?.performative, 'PROPOSE');
      }
      assert.ok(assigned.length <= r.metrics.awards);
    }
  });

  it('is reproducible for a fixed seed', async () => {
    const a = await riva.marketplace.simulate('Gandhipuram', 'Coimbatore Airport', undefined, { hour: 18, seed: 'fixed', weekend: false });
    const b = await riva.marketplace.simulate('Gandhipuram', 'Coimbatore Airport', undefined, { hour: 18, seed: 'fixed', weekend: false });
    assert.deepEqual(a.messages, b.messages);
  });

  it('re-awards to the next-best bid when the first provider fails', () => {
    const reawarded = results.filter((r) => r.messages.some((m) => m.performative === 'FAILURE'));
    assert.ok(reawarded.length > 0, 'scenario set should include at least one failed award');
    for (const r of reawarded) {
      const failures = r.messages.filter((m) => m.performative === 'FAILURE').length;
      assert.ok(r.metrics.awards >= failures);
    }
  });

  it('respects a hard safety constraint even when it means no ride', async () => {
    const r = await riva.marketplace.simulate('Gandhipuram', 'RS Puram', { femaleDriverOnly: true, excludeVehicleTypes: ['auto', 'mini', 'sedan', 'suv'] }, { hour: 12, seed: 'safety', weekend: false });
    if (r.outcome.status === 'MATCHED') assert.ok(r.outcome.option!.hasFemaleDriverOption);
  });

  it('a confirmed booking never switches the rider to another ride', async () => {
    const context = await riva.rideSearch.buildSearchContext('Amrita University', 'Coimbatore Airport', undefined, undefined, 9);
    const r = await riva.marketplace.run(context, { hour: 9, seed: 's1', weekend: false, preferredOptionId: 'uber-sedan-2', maxAwards: 1 });
    assert.ok(r.metrics.awards <= 1);
    if (r.outcome.status === 'MATCHED') assert.equal(r.outcome.option!.optionId, 'uber-sedan-2');
  });
});
