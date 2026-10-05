import { InvariantViolation } from './errors';

/** start < end, immutable. */
export class BillingPeriod {
  readonly #start: Date;
  readonly #end: Date;

  private constructor(start: Date, end: Date) {
    this.#start = new Date(start.getTime());
    this.#end = new Date(end.getTime());
  }

  public static create(start: Date, end: Date): BillingPeriod {
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      throw new InvariantViolation('A billing period needs start < end');
    }
    return new BillingPeriod(start, end);
  }

  public get start(): Date {
    return new Date(this.#start.getTime());
  }

  public get end(): Date {
    return new Date(this.#end.getTime());
  }

  public contains(now: Date): boolean {
    return now >= this.#start && now < this.#end;
  }

  public hasEnded(now: Date): boolean {
    return now >= this.#end;
  }
}
