import { z } from 'zod';
import { SUBSCRIPTION_STATUSES } from '../subscription';
import { IsoDateTimeSchema } from './common';

/** Owner-only analytics (ADR-0004). Aggregates only: no topics, no hook text, no emails. */
export const AdminMetricsQuerySchema = z.strictObject({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

const Count = z.number().int().min(0);
const Paise = z.number().int().min(0);

export const AdminMetricsSchema = z.strictObject({
  generatedAt: IsoDateTimeSchema,
  range: z.strictObject({ from: IsoDateTimeSchema, to: IsoDateTimeSchema, days: Count }),
  users: z.strictObject({
    total: Count,
    newInRange: Count,
    activeToday: Count,
    activeInRange: Count,
  }),
  sales: z.strictObject({
    revenueInRangePaise: Paise,
    revenueAllTimePaise: Paise,
    paymentsInRange: Count,
    refundsInRange: Count,
    refundedInRangePaise: Paise,
    byItem: z.array(z.strictObject({ purpose: z.string(), itemId: z.string(), count: Count, revenuePaise: Paise })),
  }),
  subscriptions: z.strictObject({
    byStatus: z.partialRecord(z.enum(SUBSCRIPTION_STATUSES), Count),
    activeByPlan: z.array(z.strictObject({ planId: z.string(), count: Count })),
    mrrPaise: Paise,
    newInRange: Count,
    cancelledInRange: Count,
    renewalsInRange: Count,
    failedChargesInRange: Count,
  }),
  usage: z.strictObject({
    generationsByFeature: z.array(z.strictObject({ feature: z.string(), count: Count })),
    freeGenerationsInRange: Count,
    swipeHooksTotal: Count,
    aiCallsByProvider: z.array(z.strictObject({ provider: z.string(), tier: z.string(), calls: Count })),
  }),
  conversion: z.strictObject({
    payingUsers: Count,
    firstPaymentRatePct: z.number().min(0).max(100),
    packToSubscriptionRatePct: z.number().min(0).max(100),
  }),
  daily: z.array(
    z.strictObject({
      day: z.string(),
      signups: Count,
      activeUsers: Count,
      revenuePaise: Paise,
      payments: Count,
      generations: Count,
    }),
  ),
  recentPayments: z.array(
    z.strictObject({
      at: IsoDateTimeSchema,
      amountPaise: Paise,
      purpose: z.string(),
      itemId: z.string(),
      status: z.string(),
      userRef: z.string(),
    }),
  ),
});
export type AdminMetrics = z.infer<typeof AdminMetricsSchema>;
