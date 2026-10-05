import { z } from 'zod';
import type { LlmRequest } from '../../ports';
import { BaseLlmProvider } from './base-llm-provider';

const GeminiResponse = z.object({
  candidates: z.array(z.object({ content: z.object({ parts: z.array(z.object({ text: z.string().optional() })) }) })).min(1),
});

/** Google AI Studio (Gemini). Key goes in a header, never in the URL. */
export class GeminiProvider extends BaseLlmProvider {
  public readonly id: string;
  readonly #apiKey: string;
  readonly #model: string;
  readonly #fetch: typeof fetch;

  public constructor(options: { apiKey: string; model: string; fetchImpl?: typeof fetch }) {
    super();
    this.id = `gemini:${options.model}`;
    this.#apiKey = options.apiKey;
    this.#model = options.model;
    this.#fetch = options.fetchImpl ?? fetch;
  }

  protected override async call(request: LlmRequest, signal: AbortSignal): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.#model)}:generateContent`;
    const json = await this.postJson(
      this.#fetch,
      url,
      { 'x-goog-api-key': this.#apiKey },
      {
        systemInstruction: { parts: [{ text: request.system }] },
        contents: [{ role: 'user', parts: [{ text: request.user }] }],
        generationConfig: { maxOutputTokens: request.maxTokens, temperature: request.temperature, responseMimeType: 'application/json' },
      },
      signal,
    );
    const parts = GeminiResponse.parse(json).candidates[0]?.content.parts ?? [];
    return parts.map((p) => p.text ?? '').join('');
  }
}
