import { InvariantViolation } from './errors';
import type { AiTier, FeatureKey, UnlockKey } from './features';
import type { Money } from './money';
import type { ProductId } from './product';

/** Working name: change it here only (PRD header). */
export const BRAND = Object.freeze({
  name: 'Hook Crafter',
  tagline: 'Write first lines that stop the scroll.',
  supportEmail: 'support@hookcrafter.example',
  grievanceEmail: 'grievance@hookcrafter.example',
});

export type Credits = Readonly<Partial<Record<FeatureKey, number>>>;

export interface PackProps {
  readonly id: string;
  readonly product: ProductId;
  readonly name: string;
  readonly price: Money;
  readonly credits: Credits;
  readonly unlocks: readonly UnlockKey[];
}

/** One-time pack: `one_time_credit` (never expires) + permanent unlocks. */
export class Pack {
  public readonly id: string;
  public readonly product: ProductId;
  public readonly name: string;
  public readonly price: Money;
  public readonly credits: Credits;
  public readonly unlocks: readonly UnlockKey[];

  private constructor(props: PackProps) {
    this.id = props.id;
    this.product = props.product;
    this.name = props.name;
    this.price = props.price;
    this.credits = Object.freeze({ ...props.credits });
    this.unlocks = Object.freeze([...props.unlocks]);
    Object.freeze(this);
  }

  public static create(props: PackProps): Pack {
    assertCredits(props.id, props.credits);
    if (props.price.paise <= 0) throw new InvariantViolation(`Pack ${props.id} needs a price`);
    return new Pack(props);
  }
}

export interface ProviderPlanIds {
  readonly test: string | null;
  readonly live: string | null;
}

export interface PlanProps {
  readonly id: string;
  readonly product: ProductId;
  readonly name: string;
  readonly price: Money;
  readonly allowances: Credits;
  readonly unlocks: readonly UnlockKey[];
  readonly aiTier: AiTier;
  readonly rateLimitPerHour: number;
  readonly swipeLimit: number;
  readonly voiceProfileLimit: number;
  /** Higher rank = pricier plan; decides upgrade vs downgrade. */
  readonly rank: number;
  readonly providerPlanIds: ProviderPlanIds;
}

/** Monthly plan: `monthly_allowance` per confirmed charge + unlocks while the period is valid. */
export class Plan {
  public readonly id: string;
  public readonly product: ProductId;
  public readonly name: string;
  public readonly price: Money;
  public readonly allowances: Credits;
  public readonly unlocks: readonly UnlockKey[];
  public readonly aiTier: AiTier;
  public readonly rateLimitPerHour: number;
  public readonly swipeLimit: number;
  public readonly voiceProfileLimit: number;
  public readonly rank: number;
  public readonly providerPlanIds: ProviderPlanIds;

  private constructor(props: PlanProps) {
    this.id = props.id;
    this.product = props.product;
    this.name = props.name;
    this.price = props.price;
    this.allowances = Object.freeze({ ...props.allowances });
    this.unlocks = Object.freeze([...props.unlocks]);
    this.aiTier = props.aiTier;
    this.rateLimitPerHour = props.rateLimitPerHour;
    this.swipeLimit = props.swipeLimit;
    this.voiceProfileLimit = props.voiceProfileLimit;
    this.rank = props.rank;
    this.providerPlanIds = Object.freeze({ ...props.providerPlanIds });
    Object.freeze(this);
  }

  public static create(props: PlanProps): Plan {
    assertCredits(props.id, props.allowances);
    if (props.price.paise <= 0 || props.aiTier === 'free') {
      throw new InvariantViolation(`Plan ${props.id} needs a price and a paid tier`);
    }
    return new Plan(props);
  }
}

function assertCredits(id: string, credits: Credits): void {
  for (const value of Object.values(credits)) {
    if (!Number.isInteger(value) || value < 0) {
      throw new InvariantViolation(`Bad credit count in ${id}`);
    }
  }
}

export interface FreeTier {
  readonly dailyGenerate: number;
  readonly swipeLimit: number;
  readonly rateLimitPerHour: number;
}

export interface PaidDefaults {
  readonly swipeLimit: number;
  readonly rateLimitPerHour: number;
}

/** The ONLY source of prices, packs, plans and limits (PRD A6). */
export class Catalog {
  readonly #packs: ReadonlyMap<string, Pack>;
  readonly #plans: ReadonlyMap<string, Plan>;
  public readonly free: FreeTier;
  public readonly paid: PaidDefaults;

  public constructor(packs: readonly Pack[], plans: readonly Plan[], free: FreeTier, paid: PaidDefaults) {
    this.#packs = new Map(packs.map((p) => [p.id, p]));
    this.#plans = new Map(plans.map((p) => [p.id, p]));
    this.free = Object.freeze({ ...free });
    this.paid = Object.freeze({ ...paid });
  }

  public pack(product: ProductId, id: string): Pack | undefined {
    const pack = this.#packs.get(id);
    return pack?.product === product ? pack : undefined;
  }

  public plan(product: ProductId, id: string): Plan | undefined {
    const plan = this.#plans.get(id);
    return plan?.product === product ? plan : undefined;
  }

  public packs(product: ProductId): readonly Pack[] {
    return [...this.#packs.values()].filter((p) => p.product === product);
  }

  public plans(product: ProductId): readonly Plan[] {
    return [...this.#plans.values()].filter((p) => p.product === product).sort((a, b) => a.rank - b.rank);
  }

  /** Finds the plan whose provider (Razorpay) plan id matches, in the given environment. */
  public planByProviderId(providerPlanId: string, env: 'test' | 'live'): Plan | undefined {
    return [...this.#plans.values()].find((p) => p.providerPlanIds[env] === providerPlanId);
  }

  /** Returns a copy with provider plan ids filled in (from environment config). */
  public withProviderPlanIds(ids: Readonly<Record<string, ProviderPlanIds>>): Catalog {
    const plans = [...this.#plans.values()].map((p) => {
      const provider = ids[p.id];
      return provider === undefined ? p : Plan.create({ ...p, providerPlanIds: provider });
    });
    return new Catalog([...this.#packs.values()], plans, this.free, this.paid);
  }
}
