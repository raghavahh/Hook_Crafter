import { AuthError, ValidationError } from '@hook/domain';
import type { Logger, PaymentGateway, WebhookEventRepository } from '../../../ports';
import { WebhookEnvelopeSchema, type WebhookHandler } from './webhook-types';

/**
 * POST /v1/pay/webhook (Flow 4 step 4, Flow 5 step 4): HMAC over the RAW body, unique event id
 * (duplicates and replays are no-ops, S-08 / S-SUB-04), then one handler per event type.
 */
export class WebhookService {
  readonly #gateway: PaymentGateway;
  readonly #events: WebhookEventRepository;
  readonly #handlers: ReadonlyMap<string, WebhookHandler>;
  readonly #logger: Logger;

  public constructor(deps: { gateway: PaymentGateway; events: WebhookEventRepository; handlers: readonly WebhookHandler[]; logger: Logger }) {
    this.#gateway = deps.gateway;
    this.#events = deps.events;
    this.#logger = deps.logger;
    const map = new Map<string, WebhookHandler>();
    for (const handler of deps.handlers) for (const name of handler.events) map.set(name, handler);
    this.#handlers = map;
  }

  public async receive(rawBody: string, signature: string | null, eventId: string | null): Promise<string> {
    if (signature === null || !(await this.#gateway.verifyWebhookSignature(rawBody, signature))) throw new AuthError('Invalid signature.');
    if (eventId === null || !/^[A-Za-z0-9_-]{6,64}$/u.test(eventId)) throw new ValidationError('Missing event id.');
    const envelope = WebhookEnvelopeSchema.safeParse(safeJson(rawBody));
    if (!envelope.success) throw new ValidationError('Unreadable webhook.');
    const ref = envelope.data.payload.subscription?.entity.id ?? envelope.data.payload.payment?.entity.id ?? null;
    if (!(await this.#events.record(eventId, envelope.data.event, ref))) return 'duplicate';
    const handler = this.#handlers.get(envelope.data.event);
    const result = handler === undefined ? 'ignored_event' : await handler.handle(envelope.data);
    await this.#events.finish(eventId, result);
    this.#logger.info('webhook', { event: envelope.data.event, result });
    return result;
  }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
