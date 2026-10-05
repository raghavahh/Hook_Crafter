import { ApiErrorSchema, type ErrorCode } from '@hook/domain';
import type { z } from 'zod';
import { ApiError } from './api-error';

export type HttpMethod = 'GET' | 'POST' | 'DELETE';

export interface HttpTransportOptions {
  readonly baseUrl: string;
  readonly getAccessToken: () => Promise<string | null>;
  readonly fetchImpl?: typeof fetch;
}

/** Status -> code when the server's error body is missing or malformed. */
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

/**
 * Low-level JSON-over-fetch. Never logs request or response bodies (they hold user text).
 * Every failure becomes an ApiError.
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
  public async json<S extends z.ZodType>(method: HttpMethod, path: string, schema: S, body?: unknown): Promise<z.output<S>> {
    const response = await this.send(method, path, body);
    const parsed = schema.safeParse(await readJson(response));
    if (!parsed.success) {
      throw new ApiError('INTERNAL', response.status, 'Unexpected response from the server.', this.#requestId(response));
    }
    return parsed.data;
  }

  /** Sends a request; resolves with the 2xx response, throws ApiError otherwise. */
  public async send(method: HttpMethod, path: string, body?: unknown): Promise<Response> {
    const init = await this.#init(method, body);
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
    if (body === undefined) return { method, headers };
    headers.set('content-type', 'application/json');
    return { method, headers, body: JSON.stringify(body) };
  }

  async #token(): Promise<string | null> {
    try {
      return await this.#getAccessToken();
    } catch {
      throw new ApiError('UNAUTHENTICATED', 0, 'Please log in again.');
    }
  }

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
