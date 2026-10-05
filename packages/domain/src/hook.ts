import { InvariantViolation } from './errors';
import type { FrameworkLibrary } from './framework';
import { rulesFor, type Platform } from './platform';
import { codePointLength } from './text';

export interface HookProps {
  readonly text: string;
  readonly frameworkId: string;
  readonly platform: Platform;
}

/** One generated hook. Immutable; validated against the library and platform rules. */
export class Hook {
  public readonly text: string;
  public readonly frameworkId: string;
  public readonly platform: Platform;

  private constructor(props: HookProps) {
    this.text = props.text;
    this.frameworkId = props.frameworkId;
    this.platform = props.platform;
    Object.freeze(this);
  }

  public static create(props: HookProps, library: FrameworkLibrary): Hook {
    const text = props.text.trim();
    const length = codePointLength(text);
    if (length === 0 || length > rulesFor(props.platform).hookMaxLength) {
      throw new InvariantViolation(`Hook length ${String(length)} is outside the ${props.platform} limit`);
    }
    if (!library.has(props.frameworkId)) {
      throw new InvariantViolation(`Unknown framework: ${props.frameworkId}`);
    }
    return new Hook({ ...props, text });
  }

  public toJSON(): HookProps {
    return { text: this.text, frameworkId: this.frameworkId, platform: this.platform };
  }
}

export const HOOK_SET_SIZE = 10;

/** Exactly 10 hooks. */
export class HookSet {
  readonly #hooks: readonly Hook[];

  private constructor(hooks: readonly Hook[]) {
    this.#hooks = Object.freeze([...hooks]);
  }

  public static create(hooks: readonly Hook[]): HookSet {
    if (hooks.length !== HOOK_SET_SIZE) {
      throw new InvariantViolation(`A HookSet needs exactly ${String(HOOK_SET_SIZE)} hooks`);
    }
    return new HookSet(hooks);
  }

  public get hooks(): readonly Hook[] {
    return this.#hooks;
  }

  public distinctFrameworks(): number {
    return new Set(this.#hooks.map((h) => h.frameworkId)).size;
  }

  public toJSON(): { hooks: HookProps[] } {
    return { hooks: this.#hooks.map((h) => h.toJSON()) };
  }
}
