import { z } from 'zod';
import { ProviderError, type LlmRequest } from '../../ports';
import type { ModerationCheck } from '../../application/hooks/content-policy';
import { BaseLlmProvider } from './base-llm-provider';

/** Minimal shape of the Workers AI binding (env.AI). */
export interface WorkersAiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

const TextResponse = z.object({ response: z.union([z.string(), z.record(z.string(), z.unknown())]) });

function textOf(raw: unknown): string | null {
  const parsed = TextResponse.safeParse(raw);
  if (!parsed.success) return null;
  const value = parsed.data.response;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export class WorkersAiProvider extends BaseLlmProvider {
  public readonly id: string;
  readonly #ai: WorkersAiBinding;
  readonly #model: string;

  public constructor(options: { ai: WorkersAiBinding; model: string }) {
    super();
    this.id = `workers-ai:${options.model}`;
    this.#ai = options.ai;
    this.#model = options.model;
  }

  protected override async call(request: LlmRequest, signal: AbortSignal): Promise<string> {
    const run = this.#ai.run(this.#model, {
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.user },
      ],
      max_tokens: request.maxTokens,
      temperature: request.temperature,
    });
    const aborted = new Promise<never>((_, reject) => {
      signal.addEventListener('abort', () => reject(new ProviderError('timeout', `${this.id}: timeout`)), { once: true });
    });
    const text = textOf(await Promise.race([run, aborted]));
    if (text === null) throw new ProviderError('failed', `${this.id}: bad shape`);
    return text;
  }
}

/** Llama Guard on Workers AI (free): the optional second-opinion moderation (PRD B8). */
export class WorkersAiModeration implements ModerationCheck {
  readonly #ai: WorkersAiBinding;
  readonly #model: string;

  public constructor(ai: WorkersAiBinding, model = '@cf/meta/llama-guard-3-8b') {
    this.#ai = ai;
    this.#model = model;
  }

  public async isUnsafe(text: string): Promise<boolean> {
    const verdict = textOf(await this.#ai.run(this.#model, { messages: [{ role: 'user', content: text.slice(0, 4000) }] }));
    return verdict !== null && /\bunsafe\b/iu.test(verdict);
  }
}
