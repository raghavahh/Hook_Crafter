import type { Catalog, Plan } from './catalog';
import type { AiTier, UnlockKey } from './features';
import type { ProductId } from './product';

/** What a user's currently valid sources give them. Computed on the server only. */
export interface AccessSources {
  /** Unlock keys from all currently valid entitlement rows (packs, plan periods, upgrades). */
  readonly unlocks: ReadonlySet<UnlockKey>;
  /** Plan id with a current (non-ended, non-revoked) paid period, if any. */
  readonly activePlanId: string | null;
  /** True if the user has a completed, non-refunded one-time pack purchase. */
  readonly hasPaidPack: boolean;
}

interface AccessProfileProps {
  readonly unlocks: ReadonlySet<UnlockKey>;
  readonly plan: Plan | null;
  readonly swipeLimit: number;
  readonly rateLimitPerHour: number;
  readonly aiTier: AiTier;
  readonly voiceProfileLimit: number;
}

/** Limits from several sources: an unlock if ANY source has it, the highest limit wins (PRD A6.5). */
export class AccessProfile {
  public readonly unlocks: ReadonlySet<UnlockKey>;
  public readonly plan: Plan | null;
  public readonly swipeLimit: number;
  public readonly rateLimitPerHour: number;
  public readonly aiTier: AiTier;
  public readonly voiceProfileLimit: number;

  private constructor(props: AccessProfileProps) {
    this.unlocks = new Set(props.unlocks);
    this.plan = props.plan;
    this.swipeLimit = props.swipeLimit;
    this.rateLimitPerHour = props.rateLimitPerHour;
    this.aiTier = props.aiTier;
    this.voiceProfileLimit = props.voiceProfileLimit;
    Object.freeze(this);
  }

  public static compute(catalog: Catalog, product: ProductId, sources: AccessSources): AccessProfile {
    const plan = sources.activePlanId === null ? null : (catalog.plan(product, sources.activePlanId) ?? null);
    const paid = plan !== null || sources.hasPaidPack;
    return new AccessProfile({
      unlocks: sources.unlocks,
      plan,
      swipeLimit: Math.max(catalog.free.swipeLimit, paid ? catalog.paid.swipeLimit : 0, plan?.swipeLimit ?? 0),
      rateLimitPerHour: Math.max(catalog.free.rateLimitPerHour, plan?.rateLimitPerHour ?? 0),
      aiTier: plan?.aiTier ?? (paid ? 'paid' : 'free'),
      voiceProfileLimit: plan?.voiceProfileLimit ?? 0,
    });
  }

  public has(unlock: UnlockKey): boolean {
    return this.unlocks.has(unlock);
  }

  public unlockList(): UnlockKey[] {
    return [...this.unlocks].sort();
  }
}
