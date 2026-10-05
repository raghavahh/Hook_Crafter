import type { Clock, Logger, LogValue } from '../../ports';

export class SystemClock implements Clock {
  public now(): Date {
    return new Date();
  }
}

/**
 * Structured JSON logs (C3 Logging). Fields are primitives only, so whole request bodies,
 * topics or hook text can never be logged by accident (T18 / S-23).
 */
export class JsonLogger implements Logger {
  readonly #base: Readonly<Record<string, LogValue>>;

  public constructor(base: Readonly<Record<string, LogValue>> = {}) {
    this.#base = base;
  }

  public info(event: string, fields: Readonly<Record<string, LogValue>> = {}): void {
    this.#write('info', event, fields);
  }

  public warn(event: string, fields: Readonly<Record<string, LogValue>> = {}): void {
    this.#write('warn', event, fields);
  }

  public error(event: string, fields: Readonly<Record<string, LogValue>> = {}): void {
    this.#write('error', event, fields);
  }

  public child(fields: Readonly<Record<string, LogValue>>): JsonLogger {
    return new JsonLogger({ ...this.#base, ...fields });
  }

  #write(level: string, event: string, fields: Readonly<Record<string, LogValue>>): void {
    const safe: Record<string, LogValue> = {};
    for (const [key, value] of Object.entries({ ...this.#base, ...fields })) {
      safe[key] = typeof value === 'string' ? value.slice(0, 120) : value;
    }
    console.log(JSON.stringify({ level, event, at: new Date().toISOString(), ...safe }));
  }
}
