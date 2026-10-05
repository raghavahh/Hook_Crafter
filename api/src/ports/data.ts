import type { AdminMetrics, Language, Platform, ProductId } from '@hook/domain';

export interface NewSwipeHook {
  readonly text: string;
  readonly frameworkId: string;
  readonly platform: Platform;
  readonly language: Language;
  readonly collection: string | null;
}

export interface SwipeHookRecord extends NewSwipeHook {
  readonly id: string;
  readonly createdAt: Date;
}

export interface SwipeFilter {
  readonly platform?: Platform;
  readonly frameworkId?: string;
  readonly collection?: string;
}

export interface SwipeCursor {
  readonly createdAt: Date;
  readonly id: string;
}

export interface SwipeHookRepository {
  /** Atomic count-then-insert under a per-user lock. Throws LimitReachedError when count >= limit. */
  save(userId: string, hook: NewSwipeHook, limit: number): Promise<string>;
  /** Newest first. Only the caller's rows. */
  list(userId: string, filter: SwipeFilter, cursor: SwipeCursor | null, pageSize: number): Promise<{ items: readonly SwipeHookRecord[]; next: SwipeCursor | null }>;
  count(userId: string): Promise<number>;
  /** delete where id = $id and user_id = $user. Returns true when a row was removed. */
  delete(userId: string, id: string): Promise<boolean>;
}

export type GenerationFeature = 'generate' | 'reels';

export interface GenerationRecord {
  readonly id: string;
  readonly feature: GenerationFeature;
  readonly title: string;
  readonly output: unknown;
  readonly createdAt: Date;
}

export interface GenerationRepository {
  save(input: { userId: string; product: ProductId; feature: GenerationFeature; title: string; output: unknown; expiresAt: Date }): Promise<string>;
  listSince(userId: string, product: ProductId, since: Date, limit: number): Promise<readonly GenerationRecord[]>;
}

export interface AccountRepository {
  /** Creates the profile row on first sight (signup). */
  ensureProfile(userId: string): Promise<void>;
  /** One row per user per day for DAU analytics. */
  touchActivity(userId: string, day: string): Promise<void>;
  exportData(userId: string): Promise<unknown>;
  /** True after deleteAccount(): old (still unexpired) JWTs must be rejected (S-25). */
  isDeleted(userId: string): Promise<boolean>;
  /** Removes profile, credits, swipe file, generations; unlinks payments/subscriptions/audit rows; writes a tombstone. */
  deleteAccount(userId: string): Promise<void>;
}

export interface AuditLog {
  record(entry: { actor: string; action: string; ref: string | null; details: Readonly<Record<string, string | number | boolean | null>> }): Promise<void>;
}

export interface AdminRepository {
  metrics(from: Date, to: Date, now: Date): Promise<AdminMetrics>;
}
