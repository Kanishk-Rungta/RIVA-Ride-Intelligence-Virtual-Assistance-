import { ToolDecorator as Tool, Widget, ExecutionContext, Injectable, z } from '@nitrostack/core';
import { MarketplaceService } from './marketplace.service.js';
import { preferencesSchema } from '../rides/rides.tools.js';
import { parseDateTimeLabel } from '../../services/time.util.js';
import type { RiderPreferences } from '../../domain/types.js';

@Injectable({ deps: [MarketplaceService] })
export class MarketplaceTools {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Tool({
    name: 'simulate_ride_marketplace',
    description:
      'Run the multi-agent ride marketplace for a trip and show how the agents negotiate: the rider agent calls for proposals, Uber/Ola/Rapido provider agents bid, the rider awards the best bid by its utility, and the winning provider runs its own call for proposals to nearby driver agents, who accept or decline based on their own earnings. Returns the full message trace (FIPA Contract Net) and the outcome.',
    inputSchema: z.object({
      origin: z.string().describe('Pickup location'),
      destination: z.string().describe('Drop-off location'),
      time: z.string().optional().describe('When the ride is requested, e.g. "9 AM", "11 PM" (default: now). Affects congestion, demand, and driver decisions.'),
      preferences: preferencesSchema.optional(),
      seed: z.string().optional().describe('Fix the random scene (fleet positions, latencies) for a reproducible run'),
    }),
    examples: {
      request: { origin: 'Amrita University Ettimadai', destination: 'Coimbatore Airport', time: '9 AM' },
    },
  })
  @Widget('agent-trace')
  async simulateRideMarketplace(
    input: { origin: string; destination: string; time?: string; preferences?: RiderPreferences; seed?: string },
    ctx: ExecutionContext
  ) {
    const hour = input.time ? parseDateTimeLabel(input.time).hour : undefined;
    ctx.logger.info('simulate_ride_marketplace', { origin: input.origin, destination: input.destination, hour });
    return this.marketplace.simulate(input.origin, input.destination, input.preferences, { hour, seed: input.seed, logger: ctx.logger });
  }
}
