import { z } from 'zod';
import { AiTierSchema, UnlockKeySchema } from '../features';
import { CreditsSchema, SubscriptionViewSchema } from './billing';
import { IsoDateTimeSchema, UuidSchema } from './common';

export const MeResponseSchema = z.strictObject({
  userId: UuidSchema,
  credits: CreditsSchema,
  freeGenerateLeftToday: z.number().int().min(0),
  unlocks: z.array(UnlockKeySchema),
  swipeLimit: z.number().int().min(0),
  swipeCount: z.number().int().min(0),
  rateLimitPerHour: z.number().int().min(0),
  voiceProfileLimit: z.number().int().min(0),
  aiTier: AiTierSchema,
  billingPastDue: z.boolean(),
  subscriptions: z.array(SubscriptionViewSchema),
  history: z.array(
    z.strictObject({ id: UuidSchema, feature: z.string(), createdAt: IsoDateTimeSchema, title: z.string() }),
  ),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

export const DeleteAccountRequestSchema = z.strictObject({ confirm: z.literal('DELETE') });

export const HealthResponseSchema = z.strictObject({ ok: z.literal(true) });
