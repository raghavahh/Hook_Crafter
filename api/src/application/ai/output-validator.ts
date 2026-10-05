/** Thrown when model output fails schema or policy checks. Never shown to users. */
export class OutputInvalidError extends Error {
  public readonly reason: string;
  public constructor(reason: string) {
    super(`Invalid model output: ${reason}`);
    this.reason = reason;
    this.name = 'OutputInvalidError';
  }
}

/** Template method: parse JSON -> schema -> product checks (PRD B6: OutputValidator). */
export abstract class OutputValidator<T> {
  public validate(raw: string): T {
    const json = this.#parseJson(raw);
    const parsed = this.parse(json);
    this.check(parsed);
    return parsed;
  }

  protected abstract parse(json: unknown): T;
  protected abstract check(value: T): void;

  protected fail(reason: string): never {
    throw new OutputInvalidError(reason);
  }

  #parseJson(raw: string): unknown {
    const trimmed = raw.trim().replace(/^```(?:json)?\s*/u, '').replace(/\s*```$/u, '');
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end <= start) this.fail('no_json');
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    } catch {
      return this.fail('bad_json');
    }
  }
}
