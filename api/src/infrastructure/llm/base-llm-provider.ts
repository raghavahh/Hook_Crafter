import { ProviderError, type LlmProvider, type LlmRequest } from '../../ports';

/** Template method: shared error mapping; subclasses only build the request and read the text. */
export abstract class BaseLlmProvider implements LlmProvider {
  public abstract readonly id: string;

  public async complete(request: LlmRequest, signal: AbortSignal): Promise<string> {
    try {
      const text = await this.call(request, signal);
      if (text.trim() === '') throw new ProviderError('failed', `${this.id}: empty response`);
      return text;
    } catch (error: unknown) {
      throw this.#map(error);
    }
  }

  protected abstract call(request: LlmRequest, signal: AbortSignal): Promise<string>;

  /** Shared HTTP helper: 429 -> rate_limited, other non-2xx -> failed. Never logs bodies. */
  protected async postJson(fetchImpl: typeof fetch, url: string, headers: Record<string, string>, body: unknown, signal: AbortSignal): Promise<unknown> {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal,
    });
    if (response.status === 429) throw new ProviderError('rate_limited', `${this.id}: 429`);
    if (!response.ok) throw new ProviderError('failed', `${this.id}: ${String(response.status)}`);
    return (await response.json()) as unknown;
  }

  #map(error: unknown): ProviderError {
    if (error instanceof ProviderError) return error;
    if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return new ProviderError('timeout', `${this.id}: timeout`);
    }
    return new ProviderError('failed', `${this.id}: request failed`);
  }
}
