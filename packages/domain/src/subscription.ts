import { z } from 'zod';

export const SUBSCRIPTION_STATUSES = [
  'created',
  'authenticated',
  'active',
  'past_due',
  'halted',
  'paused',
  'cancelled',
  'completed',
  'expired',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export const SubscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUSES);

const ENDED: ReadonlySet<SubscriptionStatus> = new Set(['cancelled', 'completed', 'expired']);

/**
 * Allowed transitions only. Anything else is ignored (never applied backwards).
 * `active -> active` is a renewal (a new confirmed charge).
 */
const TRANSITIONS: Readonly<Record<SubscriptionStatus, readonly SubscriptionStatus[]>> = {
  created: ['authenticated', 'active', 'cancelled', 'expired'],
  authenticated: ['active', 'cancelled', 'expired'],
  active: ['active', 'past_due', 'halted', 'paused', 'cancelled', 'completed'],
  past_due: ['active', 'halted', 'paused', 'cancelled', 'completed'],
  halted: ['active', 'cancelled', 'completed', 'expired'],
  paused: ['active', 'halted', 'cancelled', 'completed'],
  cancelled: [],
  completed: [],
  expired: [],
};

export class SubscriptionStateMachine {
  private constructor() {}

  public static canTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
    return TRANSITIONS[from].includes(to);
  }

  /** Ended = no longer counts toward "one non-ended subscription per product". */
  public static isEnded(status: SubscriptionStatus): boolean {
    return ENDED.has(status);
  }

  /** Whether plan benefits may apply at all (period_end is checked separately). */
  public static grantsAccess(status: SubscriptionStatus): boolean {
    return status === 'active' || status === 'past_due' || status === 'cancelled';
  }
}
