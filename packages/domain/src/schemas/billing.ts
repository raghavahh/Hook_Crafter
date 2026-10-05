import { z } from 'zod';
import { FeatureKeySchema, UnlockKeySchema } from '../features';
import { ProductIdSchema } from '../product';
import { SubscriptionStatusSchema } from '../subscription';
import { IsoDateTimeSchema } from './common';

const CatalogIdSchema = z.string().regex(/^[a-z][a-z0-9_]{1,39}$/u);
const RazorpayIdSchema = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9]{6,40}$`, 'u'));
const SignatureSchema = z.string().regex(/^[a-f0-9]{64}$/u);

export const CreditsSchema = z.strictObject({
  generate: z.number().int().min(0),
  post_rewrite: z.number().int().min(0),
});
export type CreditsView = z.infer<typeof CreditsSchema>;

export const CreateOrderRequestSchema = z.strictObject({ product: ProductIdSchema, packId: CatalogIdSchema });
export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;

export const OrderResponseSchema = z.strictObject({
  orderId: z.string(),
  amount: z.number().int().positive(),
  currency: z.literal('INR'),
  keyId: z.string(),
});
export type OrderResponse = z.infer<typeof OrderResponseSchema>;

export const VerifyPaymentRequestSchema = z.strictObject({
  orderId: RazorpayIdSchema('order'),
  paymentId: RazorpayIdSchema('pay'),
  signature: SignatureSchema,
});
export type VerifyPaymentRequest = z.infer<typeof VerifyPaymentRequestSchema>;

export const VerifyPaymentResponseSchema = z.strictObject({
  credits: CreditsSchema,
  unlocks: z.array(UnlockKeySchema),
});

export const CatalogQuerySchema = z.strictObject({ product: ProductIdSchema });

// partialRecord: a pack may grant only some features (z.record over an enum is exhaustive in Zod 4).
const AllowanceViewSchema = z.partialRecord(FeatureKeySchema, z.number().int().min(0));
export const CatalogResponseSchema = z.strictObject({
  packs: z.array(
    z.strictObject({ id: z.string(), name: z.string(), pricePaise: z.number().int(), credits: AllowanceViewSchema, unlocks: z.array(UnlockKeySchema) }),
  ),
  plans: z.array(
    z.strictObject({
      id: z.string(),
      name: z.string(),
      pricePaise: z.number().int(),
      allowances: AllowanceViewSchema,
      unlocks: z.array(UnlockKeySchema),
      swipeLimit: z.number().int(),
      voiceProfileLimit: z.number().int(),
      rateLimitPerHour: z.number().int(),
      priority: z.boolean(),
      available: z.boolean(),
    }),
  ),
  free: z.strictObject({ dailyGenerate: z.number().int(), swipeLimit: z.number().int() }),
});
export type CatalogResponse = z.infer<typeof CatalogResponseSchema>;

export const CreateSubscriptionRequestSchema = z.strictObject({ product: ProductIdSchema, planId: CatalogIdSchema });
export const CreateSubscriptionResponseSchema = z.strictObject({ subscriptionId: z.string(), keyId: z.string() });

export const VerifySubscriptionRequestSchema = z.strictObject({
  subscriptionId: RazorpayIdSchema('sub'),
  paymentId: RazorpayIdSchema('pay'),
  signature: SignatureSchema,
});
export const VerifySubscriptionResponseSchema = z.strictObject({ status: SubscriptionStatusSchema });

export const ChangePlanRequestSchema = z.strictObject({ product: ProductIdSchema, planId: CatalogIdSchema });
export const ChangePlanResponseSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('downgrade'), effectiveAt: IsoDateTimeSchema }),
  z.strictObject({
    kind: z.literal('upgrade'),
    orderId: z.string(),
    amount: z.number().int().positive(),
    currency: z.literal('INR'),
    keyId: z.string(),
  }),
]);
export type ChangePlanResponse = z.infer<typeof ChangePlanResponseSchema>;

export const ProductOnlyRequestSchema = z.strictObject({ product: ProductIdSchema });
export const CancelResponseSchema = z.strictObject({ accessUntil: IsoDateTimeSchema });

export const SubscriptionViewSchema = z.strictObject({
  id: z.string(),
  product: ProductIdSchema,
  planId: z.string(),
  pendingPlanId: z.string().nullable(),
  status: SubscriptionStatusSchema,
  currentPeriodEnd: IsoDateTimeSchema.nullable(),
  cancelAtPeriodEnd: z.boolean(),
});
export type SubscriptionView = z.infer<typeof SubscriptionViewSchema>;
