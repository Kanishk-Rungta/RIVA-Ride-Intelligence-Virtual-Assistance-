/**
 * Agent communication for the RIVA ride marketplace.
 *
 * Messages follow the FIPA Agent Communication Language: each one carries a
 * performative (the speech act — call for proposals, propose, refuse,
 * accept, reject, inform, failure), a sender, a receiver, and a
 * conversation id. Agents never call each other's methods; they only post
 * messages to the bus.
 *
 * The bus is a discrete-event simulator. Every message is stamped with a
 * simulated delivery time (sender's clock + latency) and delivered in
 * timestamp order, so a driver who decides in 3 s answers before one who
 * takes 8 s, exactly as it would on a real network. The full log is kept
 * for traces, tests, and the agent-trace widget.
 */
import { MinHeap } from '../ai/search.js';

export type Performative = 'CFP' | 'PROPOSE' | 'REFUSE' | 'ACCEPT_PROPOSAL' | 'REJECT_PROPOSAL' | 'INFORM' | 'FAILURE';

export type AgentRole = 'rider' | 'provider' | 'driver';

export interface AclMessage<C = unknown> {
  id: number;
  /** Simulated delivery time, seconds since the conversation opened. */
  t: number;
  from: string;
  to: string;
  performative: Performative;
  conversationId: string;
  content: C;
  /** One-line gist for humans reading the trace. */
  summary: string;
}

export type OutgoingMessage<C = unknown> = Omit<AclMessage<C>, 'id' | 't'>;

export interface Agent {
  readonly id: string;
  readonly role: AgentRole;
  receive(message: AclMessage, bus: MessageBus): void | Promise<void>;
}

/** Safety valve: a protocol bug can never loop forever inside a tool call. */
const MAX_MESSAGES = 2_000;

export class MessageBus {
  private agents = new Map<string, Agent>();
  private queue = new MinHeap<AclMessage>();
  private clock = 0;
  private nextId = 1;
  readonly log: AclMessage[] = [];

  register(...agents: Agent[]): void {
    for (const agent of agents) this.agents.set(agent.id, agent);
  }

  now(): number {
    return this.clock;
  }

  send<C>(message: OutgoingMessage<C>, latencySeconds = 0.2): void {
    const t = Math.round((this.clock + latencySeconds) * 100) / 100;
    const full: AclMessage<C> = { ...message, id: this.nextId++, t };
    this.queue.push(full as AclMessage, t);
  }

  /** Delivers messages in timestamp order until the system goes quiet. */
  async run(): Promise<AclMessage[]> {
    while (this.queue.size > 0) {
      if (this.log.length >= MAX_MESSAGES) throw new Error('Message limit exceeded — protocol did not terminate');
      const message = this.queue.pop()!;
      this.clock = message.t;
      this.log.push(message);
      const recipient = this.agents.get(message.to);
      if (!recipient) throw new Error(`No agent registered as "${message.to}"`);
      await recipient.receive(message, this);
    }
    return this.log;
  }
}
