import { z } from 'zod';
import type { LlmRequest } from '../../ports';
import { BaseLlmProvider } from './base-llm-provider';

const ChatResponse = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
});

/** Groq and OpenRouter both speak the OpenAI chat-completions format. */
abstract class OpenAiCompatibleProvider extends BaseLlmProvider {
  readonly #apiKey: string;
  readonly #model: string;
  readonly #fetch: typeof fetch;

  protected constructor(options: { apiKey: string; model: string; fetchImpl?: typeof fetch }) {
    super();
    this.#apiKey = options.apiKey;
    this.#model = options.model;
    this.#fetch = options.fetchImpl ?? fetch;
  }

  protected abstract endpoint(): string;

  protected override async call(request: LlmRequest, signal: AbortSignal): Promise<string> {
    const json = await this.postJson(
      this.#fetch,
      this.endpoint(),
      { authorization: `Bearer ${this.#apiKey}` },
      {
        model: this.#model,
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.user },
        ],
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        response_format: { type: 'json_object' },
      },
      signal,
    );
    return ChatResponse.parse(json).choices[0]?.message.content ?? '';
  }
}

export class GroqProvider extends OpenAiCompatibleProvider {
  public readonly id: string;
  public constructor(options: { apiKey: string; model: string; fetchImpl?: typeof fetch }) {
    super(options);
    this.id = `groq:${options.model}`;
  }
  protected override endpoint(): string {
    return 'https://api.groq.com/openai/v1/chat/completions';
  }
}

export class OpenRouterProvider extends OpenAiCompatibleProvider {
  public readonly id: string;
  public constructor(options: { apiKey: string; model: string; fetchImpl?: typeof fetch }) {
    super(options);
    this.id = `openrouter:${options.model}`;
  }
  protected override endpoint(): string {
    return 'https://openrouter.ai/api/v1/chat/completions';
  }
}
