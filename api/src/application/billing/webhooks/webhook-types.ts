import { z } from 'zod';

/** Only the fields we use; everything else in Razorpay's payload is ignored. */
export const WebhookEnvelopeSchema = z.object({
  event: z.string().min(1).max(100),
  created_at: z.number().int().positive(),
  payload: z.object({
    payment: z.object({ entity: z.object({ id: z.string(), order_id: z.string().nullable().optional() }) }).optional(),
    refund: z.object({ entity: z.object({ id: z.string(), payment_id: z.string() }) }).optional(),
    subscription: z.object({ entity: z.object({ id: z.string() }) }).optional(),
  }),
});
export type WebhookEnvelope = z.infer<typeof WebhookEnvelopeSchema>;

export interface WebhookHandler {
  /** Event names this handler owns (open/closed: a new event = a new handler class). */
  readonly events: readonly string[];
  /** Returns a short result label stored on the webhook_events row. */
  handle(envelope: WebhookEnvelope): Promise<string>;
}
