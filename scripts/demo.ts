/**
 * Narrated terminal demo of RIVA's agents — runs offline, no MCP client or
 * API keys needed, and every run prints the same thing.
 *
 *   npm run demo                 all scenarios
 *   npm run demo -- marketplace  one scenario (route | search | constraints | marketplace | learning | multistop | driver)
 */
import { createRiva } from './harness.js';
import { findRoute } from '../src/ai/road-network.js';
import { SEARCH_STRATEGIES } from '../src/ai/search.js';
import type { RideOption } from '../src/domain/types.js';

const riva = createRiva();
const c = (code: number) => (s: string | number) => `\x1b[${code}m${s}\x1b[0m`;
const bold = c(1);
const dim = c(2);
const green = c(32);
const red = c(31);
const yellow = c(33);
const cyan = c(36);
const magenta = c(35);

const heading = (n: number, title: string, subtitle: string) =>
  console.log(`\n${bold(cyan(`━━ ${n}. ${title} `.padEnd(78, '━')))}\n${dim(subtitle)}\n`);
const table = (rows: Array<Array<string | number>>) => {
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => String(r[i]).replace(/\x1b\[\d+m/g, '').length)));
  rows.forEach((r, ri) => {
    const line = r.map((cell, i) => String(cell) + ' '.repeat(widths[i] - String(cell).replace(/\x1b\[\d+m/g, '').length)).join('  ');
    console.log('  ' + (ri === 0 ? bold(line) : line));
  });
};

const scenarios: Record<string, () => Promise<void>> = {
  async route() {
    heading(1, 'Rider asks for a ride', 'Amrita University → Coimbatore Airport at 9 AM. Location is resolved, A* plans the route, three provider agents quote.');
    const { context, filteredOptions } = await riva.rideSearch.search('Amrita University', 'Coimbatore Airport', undefined, undefined, 9);
    const ranked = riva.ranking.rank(filteredOptions, 'best_value');
    console.log(`  Route  ${context.route.via!.join(dim(' → '))}`);
    console.log(`         ${bold(context.route.distanceKm + ' km')}, ${bold(context.route.durationMinutes + ' min')} at 9 AM  ${dim(`(A*, ${context.route.search!.nodesExpanded} nodes expanded)`)}\n`);
    table([
      ['#', 'Ride', 'Fare', 'Pickup', 'Rating', 'Pareto'],
      ...ranked.slice(0, 8).map((o) => [o.rank, `${o.providerName} ${o.vehicleType}`, `₹${o.fare}`, `${o.pickupEtaMinutes} min`, `${o.rating}★`, o.paretoOptimal ? green('optimal') : dim('dominated')]),
    ]);
    console.log(`\n  ${riva.ranking.explainMode('best_value')}`);
  },

  async search() {
    heading(2, 'How the route was found', 'Same trip, four search strategies over the 32-junction Coimbatore road graph (objective: travel time at 9 AM).');
    const runs = SEARCH_STRATEGIES.map((s) => findRoute('amrita', 'airport', { strategy: s, objective: 'time', hour: 9 }));
    const best = Math.min(...runs.map((r) => r.search.cost));
    table([
      ['Strategy', 'Time', 'Distance', 'Expanded', 'Optimal', 'Route'],
      ...runs.map((r) => [
        r.strategy.toUpperCase(),
        `${r.durationMinutes} min`,
        `${r.distanceKm} km`,
        r.search.nodesExpanded,
        Math.abs(r.search.cost - best) < 1e-9 ? green('yes') : red('no'),
        dim(r.via.slice(1, -1).join(' › ')),
      ]),
    ]);
    const shortest = findRoute('amrita', 'airport', { objective: 'distance', hour: 9 });
    const night = findRoute('amrita', 'airport', { objective: 'time', hour: 3 });
    console.log(`\n  Shortest-distance route: ${shortest.distanceKm} km but ${shortest.durationMinutes} min through the city — the fastest route is ${runs[3].distanceKm - shortest.distanceKm > 0 ? 'longer' : 'shorter'} but avoids rush hour.`);
    console.log(`  Same trip at 3 AM: ${night.durationMinutes} min. Congestion changes edge costs, so A* is re-run per departure hour.`);
  },

  async constraints() {
    heading(3, 'Preferences as constraints', 'Luggage + ₹350 budget from Amrita to the airport: no ride satisfies both. Soft constraints relax lowest-priority first.');
    const { rawOptions } = await riva.rideSearch.search('Amrita University', 'Coimbatore Airport', undefined, undefined, 9);
    const soft = riva.rideSearch.satisfyPreferences(rawOptions, { luggageRequired: true, budgetLimit: 350 });
    console.log(`  Relaxed: ${yellow(soft.relaxed.join(', ') || 'nothing')}   Kept: ${green(soft.satisfied.join(', '))}`);
    console.log(`  Cheapest luggage-friendly ride: ${soft.options.sort((a, b) => a.fare - b.fare).map((o) => `${o.providerName} ${o.vehicleType} ₹${o.fare}`)[0]}`);
    const hard = riva.rideSearch.satisfyPreferences(rawOptions.filter((o) => !o.hasFemaleDriverOption), { femaleDriverOnly: true });
    console.log(`  Female-driver-only with no such ride available → ${red(`${hard.options.length} rides`)}: the safety constraint is hard and is never relaxed.`);
  },

  async marketplace() {
    heading(4, 'Multi-agent marketplace', 'Nested FIPA Contract Nets: the rider agent negotiates with provider agents, each provider with its driver agents.');
    const r = await riva.marketplace.simulate('Amrita University', 'Coimbatore Airport', undefined, { hour: 9, seed: 'demo', weekend: false });
    const colour: Record<string, (s: string) => string> = {
      CFP: cyan, PROPOSE: green, REFUSE: red, ACCEPT_PROPOSAL: (s) => bold(green(s)), REJECT_PROPOSAL: dim, INFORM: magenta, FAILURE: (s) => bold(red(s)),
    };
    for (const m of r.messages) {
      const who = (id: string) => (id.startsWith('driver:') ? r.participants.find((p) => p.id === id)?.label.split(' ·')[0] ?? id : id.replace('provider:', '').replace('rider:you', 'Rider'));
      console.log(`  ${dim(m.t.toFixed(1).padStart(5) + 's')}  ${colour[m.performative](m.performative.padEnd(15))} ${who(m.from).padEnd(9)} → ${who(m.to).padEnd(9)} ${dim(m.summary.length > 90 ? m.summary.slice(0, 89) + '…' : m.summary)}`);
    }
    console.log(`\n  ${bold(r.outcome.status === 'MATCHED' ? green('MATCHED') : red('NO MATCH'))}  ${r.outcome.reason}`);
    console.log(dim(`  ${r.metrics.messageCount} messages · ${r.metrics.driverOffers} driver offers · ${Math.round(r.metrics.driverAcceptanceRate * 100)}% accepted · ${r.metrics.awards} awards · ${r.metrics.incentiveRounds} incentive rounds · ${r.metrics.timeToOutcomeSeconds}s simulated`));
  },

  async learning() {
    heading(5, 'The rider agent learns', 'Saravanampatti → Coimbatore Junction, 9 AM, no bikes. This rider cares about a quick pickup and a good rating far more than fare; RIVA only sees which ride they book.');
    riva.ranking.resetWeights();
    const { filteredOptions } = await riva.rideSearch.search('Saravanampatti', 'Coimbatore Junction', { excludeVehicleTypes: ['bike'] }, undefined, 9);
    const pool = filteredOptions.filter((o) => o.availability);
    const maxFare = Math.max(...pool.map((o) => o.fare));
    const maxEta = Math.max(...pool.map((o) => o.pickupEtaMinutes));
    const hidden = (o: RideOption) => 0.1 * (o.fare / maxFare) + 0.5 * (o.pickupEtaMinutes / maxEta) + 0.4 * (1 - o.rating / 5);
    const choice = pool.reduce((a, b) => (hidden(b) < hidden(a) ? b : a));
    const describe = (o: RideOption) => `${o.providerName} ${o.vehicleType} ₹${o.fare}, ${o.pickupEtaMinutes} min, ${o.rating}★`;
    console.log(`  The rider always books: ${bold(describe(choice))}
`);
    for (let booking = 0; booking <= 4; booking++) {
      const w = riva.ranking.getWeights();
      const top = riva.ranking.rank(pool, 'best_value')[0];
      const hit = top.optionId === choice.optionId;
      console.log(`  ${(booking === 0 ? 'Before' : `After booking ${booking}`).padEnd(16)} fare ${(w.fare * 100).toFixed(0).padStart(3)}%  pickup ${(w.pickupEta * 100).toFixed(0).padStart(3)}%  rating ${(w.rating * 100).toFixed(0).padStart(3)}%   RIVA's top pick: ${hit ? green(describe(top)) : describe(top)}`);
      if (hit) break;
      riva.ranking.learnFromChoice(choice, pool);
    }
    riva.ranking.resetWeights();
  },

  async multistop() {
    heading(6, 'Multi-stop trip ordering', 'Start and end fixed, 2 PM; A* searches (current stop, visited set) states for the fastest visiting order.');
    const stops = ['Amrita University', 'Coimbatore Airport', 'Ukkadam', 'Gandhipuram', 'Coimbatore Junction'];
    const plan = await riva.multiStop.planTrip(stops, true, undefined, 14);
    const o = plan.optimization!;
    console.log(`  Typed order:     ${o.originalOrder.join(dim(' → '))}  ${dim(`(${o.originalEstimateMinutes} min)`)}`);
    console.log(`  Optimised order: ${o.optimizedOrder.join(dim(' → '))}  ${green(`(${o.optimizedEstimateMinutes} min, saves ${o.savedMinutes})`)}`);
    console.log(dim(`  ${o.statesExpanded} search states expanded; legs priced at ₹${plan.estimatedFare} total.`));
  },

  async driver() {
    heading(7, 'Driver agent: one offer, then a whole shift', 'Should a sedan driver take ₹310 to the airport? Then: where should an auto driver spend 11 PM–3 AM?');
    const trip = { provider: 'uber' as const, offeredFare: 310, tripDistance: 14, pickupDistance: 2.3, vehicleType: 'sedan' as const, fuelType: 'petrol' as const, currentLocation: 'Gandhipuram', destination: 'Coimbatore Airport' };
    const b = riva.profitability.analyzeTrip(trip);
    const airport = await riva.maps.resolveLocation('Coimbatore Airport');
    const demand = riva.demand.getDemandForLocation(airport, 18, false, '6:00 PM');
    const rec = riva.recommendation.recommendTripAcceptance(trip, b, demand);
    console.log(`  ₹${b.grossEarning} − fuel ₹${b.fuelCost} − commission ₹${b.platformCommission} = ${bold('₹' + b.netEarning)} net (~₹${b.estimatedHourlyEarning}/hr), destination demand ${demand.demandLevel}`);
    console.log(`  → ${bold(rec.recommendation === 'ACCEPT' ? green(rec.recommendation) : yellow(rec.recommendation))}: ${dim(rec.reason)}\n`);

    const plan = riva.shiftPlanner.plan({ currentLocation: { lat: 11.0318, lng: 77.029 }, startHour: 23, hours: 4, vehicleType: 'auto', fuelType: 'cng', provider: 'uber', weekend: false });
    console.log(`  Start: ${plan.startZone}, ${plan.startTime}. MDP: ${plan.model.states} states, ${plan.model.actionsPerState} actions each, solved by backward induction.`);
    table([['Hour', 'Zone', 'Plan', 'Trips', '₹ expected'], ...plan.itinerary.map((s) => [s.time, s.zone, s.action, s.expectedTrips, s.expectedEarningThisHour])]);
    const e = plan.expectedEarnings;
    console.log(`\n  Expected 4-hour net: optimal ${bold(green('₹' + e.optimal))} · greedy ₹${e.greedy} · stay put ₹${e.stayPut}  (${green(`+${plan.upliftVsStayPutPercent}%`)} vs staying put)`);
  },
};

const only = process.argv[2];
console.log(bold('\nRIVA — Ride Intelligence & Virtual Assistance · multi-agent demo') + dim('  (offline, deterministic)'));
for (const [name, run] of Object.entries(scenarios)) {
  if (!only || only === name) await run();
}
console.log();
process.exit(0); // @nitrostack/core keeps a timer alive
