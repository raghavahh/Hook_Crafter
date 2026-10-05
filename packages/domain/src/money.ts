import { InvariantViolation } from './errors';

/** Integer paise, immutable, never negative. */
export class Money {
  readonly #paise: number;

  private constructor(paise: number) {
    this.#paise = paise;
  }

  public static ofPaise(paise: number): Money {
    if (!Number.isSafeInteger(paise) || paise < 0) {
      throw new InvariantViolation(`Invalid money amount: ${String(paise)}`);
    }
    return new Money(paise);
  }

  public static ofRupees(rupees: number): Money {
    if (!Number.isSafeInteger(rupees)) {
      throw new InvariantViolation(`Rupees must be whole: ${String(rupees)}`);
    }
    return Money.ofPaise(rupees * 100);
  }

  public static zero(): Money {
    return new Money(0);
  }

  public get paise(): number {
    return this.#paise;
  }

  public minus(other: Money): Money {
    return Money.ofPaise(this.#paise - other.#paise);
  }

  public plus(other: Money): Money {
    return Money.ofPaise(this.#paise + other.#paise);
  }

  public isGreaterThan(other: Money): boolean {
    return this.#paise > other.#paise;
  }

  public equals(other: Money): boolean {
    return this.#paise === other.#paise;
  }

  /** "₹99" or "₹99.50". */
  public format(): string {
    const rupees = Math.floor(this.#paise / 100);
    const rest = this.#paise % 100;
    const whole = rupees.toLocaleString('en-IN');
    return rest === 0 ? `₹${whole}` : `₹${whole}.${String(rest).padStart(2, '0')}`;
  }
}
