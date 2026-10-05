import { ApiErrorSchema, type ErrorCode } from '@hook/domain';
import type { z } from 'zod';
import { ApiError } from './api-error';

export type HttpMethod = 'GET' | 'POST' | 'DELETE';

/** Per-call options the UI may pass (e.g. to cancel when a component unmounts). */
export interface RequestOptions {
  readonly signal?: AbortSignal | undefined;
}

export interface CallOptions extends RequestOptions {
  readonly body?: unknown;
  readonly timeoutMs?: number;
}

/** AI routes wait on a model; everything else should answer fast. */
export const STANDARD_TIMEOUT_MS = 15_000;
export const AI_TIMEOUT_MS = 30_000;

export interface HttpTransportOptions {
  readonly baseUrl: string;
  readonly getAccessToken: () => Promise<string | null>;
  readonly fetchImpl?: typeof fetch;
}

/** Status -> code, used only when the server's error body is missing or malformed. */
function codeForStatus(status: number): ErrorCode {
  const known: Readonly<Record<number, ErrorCode>> = {
    400: 'VALIDATION',
    401: 'UNAUTHENTICATED',
    402: 'NO_CREDITS',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'SUBSCRIPTION_EXISTS',
    413: 'PAYLOAD_TOO_LARGE',
    422: 'CONTENT_BLOCKED',
    429: 'RATE_LIMITED',
    502: 'UPSTREAM_FAILED',
    503: 'UNAVAILABLE',
  };
  return known[status] ?? (status >= 500 ? 'INTERNAL' : 'VALIDATION');
}

async function readJson(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    if (text === '') return undefined;
    const value: unknown = JSON.parse(text);
    return value;
  } catch {
    return undefined;
  }
}

function abortError(caller: AbortSignal | undefined): ApiError {
  return caller?.aborted === true
    ? new ApiError('UNAVAILABLE', 0, 'The request was cancelled.')
    : new ApiError('UNAVAILABLE', 0, 'The server took too long to respond. Please try again.');
}

/**
 * Low-level JSON-over-fetch. Never logs request or response bodies (they hold user text).
 * Every request has a deadline and `cache: 'no-store'`; every failure becomes an ApiError.
 */
export class HttpTransport {
  readonly #baseUrl: string;
  readonly #getAccessToken: () => Promise<string | null>;
  readonly #fetch: typeof fetch;

  public constructor(options: HttpTransportOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/+$/u, '');
    this.#getAccessToken = options.getAccessToken;
    this.#fetch = options.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  /** Sends a request and validates the 2xx JSON body with `schema`. */
  public async json<S extends z.ZodType>(method: HttpMethod, path: string, schema: S, call: CallOptions = {}): Promise<z.output<S>> {
    const init = await this.#init(method, call.body);
    return this.#withDeadline(call, async (signal) => {
      const response = await this.#exchange(path, { ...init, signal });
      const parsed = schema.safeParse(await readJson(response));
      if (!parsed.success) {
        throw new ApiError('INTERNAL', response.status, 'Unexpected response from the server.', this.#requestId(response));
      }
      return parsed.data;
    });
  }

  /** Sends a request whose 2xx body is ignored (e.g. 204 No Content). */
  public async send(method: HttpMethod, path: string, call: CallOptions = {}): Promise<void> {
    const init = await this.#init(method, call.body);
    await this.#withDeadline(call, (signal) => this.#exchange(path, { ...init, signal }));
  }

  /** Runs `run` with a signal that aborts on timeout or when the caller's signal aborts. */
  async #withDeadline<T>(call: CallOptions, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const caller = call.signal;
    if (caller?.aborted === true) throw abortError(caller);
    const controller = new AbortController();
    const onAbort = (): void => controller.abort();
    caller?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(onAbort, call.timeoutMs ?? STANDARD_TIMEOUT_MS);
    try {
      return await run(controller.signal);
    } catch (error) {
      throw controller.signal.aborted ? abortError(caller) : error;
    } finally {
      clearTimeout(timer);
      caller?.removeEventListener('abort', onAbort);
    }
  }

  async #exchange(path: string, init: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}${path}`, init);
    } catch {
      throw new ApiError('UNAVAILABLE', 0, 'Could not reach the server. Check your connection and try again.');
    }
    if (!response.ok) throw await this.#toError(response);
    return response;
  }

  async #init(method: HttpMethod, body: unknown): Promise<RequestInit> {
    const headers = new Headers({ accept: 'application/json' });
    const token = await this.#token();
    if (token !== null && token !== '') headers.set('authorization', `Bearer ${token}`);
    if (body === undefined) return { method, headers, cache: 'no-store' };
    headers.set('content-type', 'application/json');
    return { method, headers, cache: 'no-store', body: JSON.stringify(body) };
  }

  async #token(): Promise<string | null> {
    try {
      return await this.#getAccessToken();
    } catch {
      throw new ApiError('UNAUTHENTICATED', 0, 'Please log in again.');
    }
  }

  /** The server's error body wins (e.g. 402 BILLING_PAST_DUE vs NO_CREDITS); status is only a fallback. */
  async #toError(response: Response): Promise<ApiError> {
    const parsed = ApiErrorSchema.safeParse(await readJson(response));
    if (parsed.success) {
      const { code, message, requestId } = parsed.data.error;
      return new ApiError(code, response.status, message, requestId);
    }
    const message = `Request failed (${String(response.status)}).`;
    return new ApiError(codeForStatus(response.status), response.status, message, this.#requestId(response));
  }

  #requestId(response: Response): string {
    return response.headers.get('x-request-id') ?? '';
  }
}
