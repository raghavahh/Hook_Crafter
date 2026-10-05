/**
 * Typed error hierarchy. Every error the API can return maps to exactly one
 * code + HTTP status here; the HTTP layer maps them in one place.
 */
export const ERROR_CODES = [
  'VALIDATION',
  'PAYLOAD_TOO_LARGE',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'LOCKED_FEATURE',
  'NOT_FOUND',
  'QUOTA_EXCEEDED',
  'SOLD_OUT',
  'NO_CREDITS',
  'LIMIT_REACHED',
  'PAYMENT_INVALID',
  'CONTENT_BLOCKED',
  'UPSTREAM_FAILED',
  'RATE_LIMITED',
  'SUBSCRIPTION_EXISTS',
  'BILLING_PAST_DUE',
  'UNAVAILABLE',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export abstract class AppError extends Error {
  public abstract readonly code: ErrorCode;
  public abstract readonly httpStatus: number;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  public override readonly code = 'VALIDATION';
  public override readonly httpStatus = 400;
  public constructor(message = 'The request is invalid.') {
    super(message);
  }
}

export class PayloadTooLargeError extends AppError {
  public override readonly code = 'PAYLOAD_TOO_LARGE';
  public override readonly httpStatus = 413;
  public constructor(message = 'The request is too large.') {
    super(message);
  }
}

export class AuthError extends AppError {
  public override readonly code = 'UNAUTHENTICATED';
  public override readonly httpStatus = 401;
  public constructor(message = 'Please log in again.') {
    super(message);
  }
}

export class ForbiddenError extends AppError {
  public override readonly code = 'FORBIDDEN';
  public override readonly httpStatus = 403;
  public constructor(message = 'You are not allowed to do that.') {
    super(message);
  }
}

export class LockedFeatureError extends AppError {
  public override readonly code = 'LOCKED_FEATURE';
  public override readonly httpStatus = 403;
  public constructor(message = 'This feature needs an upgrade.') {
    super(message);
  }
}

export class NotFoundError extends AppError {
  public override readonly code = 'NOT_FOUND';
  public override readonly httpStatus = 404;
  public constructor(message = 'Not found.') {
    super(message);
  }
}

export class QuotaExceededError extends AppError {
  public override readonly code = 'QUOTA_EXCEEDED';
  public override readonly httpStatus = 429;
  public constructor(message = "You've used today's free generation.") {
    super(message);
  }
}

export class SoldOutError extends AppError {
  public override readonly code = 'SOLD_OUT';
  public override readonly httpStatus = 503;
  public constructor(message = 'Sold out today. Free generations are back tomorrow.') {
    super(message);
  }
}

export class NoCreditsError extends AppError {
  public override readonly code = 'NO_CREDITS';
  public override readonly httpStatus = 402;
  public constructor(message = "You're out of credits.") {
    super(message);
  }
}

export class LimitReachedError extends AppError {
  public override readonly code = 'LIMIT_REACHED';
  public override readonly httpStatus = 403;
  public constructor(message = "You've reached your plan's limit.") {
    super(message);
  }
}

export class PaymentError extends AppError {
  public override readonly code = 'PAYMENT_INVALID';
  public override readonly httpStatus = 400;
  public constructor(message = 'We could not verify this payment.') {
    super(message);
  }
}

export class ContentBlockedError extends AppError {
  public override readonly code = 'CONTENT_BLOCKED';
  public override readonly httpStatus = 422;
  public constructor(message = "We can't write hooks for this topic. No credit was used.") {
    super(message);
  }
}

export class UpstreamError extends AppError {
  public override readonly code = 'UPSTREAM_FAILED';
  public override readonly httpStatus = 502;
  public constructor(message = 'Generation failed. Your credit was returned.') {
    super(message);
  }
}

export class RateLimitError extends AppError {
  public override readonly code = 'RATE_LIMITED';
  public override readonly httpStatus = 429;
  public constructor(message = 'Too many requests. Please slow down.') {
    super(message);
  }
}

export class SubscriptionExistsError extends AppError {
  public override readonly code = 'SUBSCRIPTION_EXISTS';
  public override readonly httpStatus = 409;
  public constructor(message = 'You already have a plan for this product.') {
    super(message);
  }
}

export class BillingPastDueError extends AppError {
  public override readonly code = 'BILLING_PAST_DUE';
  public override readonly httpStatus = 402;
  public constructor(message = 'Payment failed, update your payment method.') {
    super(message);
  }
}

export class UnavailableError extends AppError {
  public override readonly code = 'UNAVAILABLE';
  public override readonly httpStatus = 503;
  public constructor(message = 'This is temporarily unavailable. Please try again later.') {
    super(message);
  }
}

/** A broken invariant or misconfiguration: a bug, never the user's fault. */
export class InvariantViolation extends AppError {
  public override readonly code = 'INTERNAL';
  public override readonly httpStatus = 500;
  public constructor(message: string) {
    super(message);
  }
}
