import { DAY_MS } from '../time';

export const REFUND_WINDOW_DAYS = 7;

export interface RefundDecision {
  readonly eligible: boolean;
  readonly reason: 'within_window_unused' | 'used' | 'window_passed' | 'unused_credits_only';
}

/**
 * PRD A6.7, deterministic (S-SUB-13). Refunds are issued by the owner from the Razorpay
 * dashboard; the refund webhook then revokes what is left. Technical failures are always made good.
 */
export class RefundPolicy {
  private constructor() {}

  /** Subscription charge: full refund only within 7 days AND if nothing from that period was used. */
  public static subscriptionCharge(chargedAt: Date, periodUsage: number, now: Date): RefundDecision {
    if (now.getTime() - chargedAt.getTime() > REFUND_WINDOW_DAYS * DAY_MS) return { eligible: false, reason: 'window_passed' };
    if (periodUsage > 0) return { eligible: false, reason: 'used' };
    return { eligible: true, reason: 'within_window_unused' };
  }

  /** One-time pack: unused credits only, within 7 days. */
  public static pack(paidAt: Date, now: Date): RefundDecision {
    if (now.getTime() - paidAt.getTime() > REFUND_WINDOW_DAYS * DAY_MS) return { eligible: false, reason: 'window_passed' };
    return { eligible: true, reason: 'unused_credits_only' };
  }
}
