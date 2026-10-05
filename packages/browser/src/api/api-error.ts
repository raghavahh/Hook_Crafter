import type { ErrorCode } from '@hook/domain';

/** Every failure the ApiClient reports: server errors, network failures and bad responses. */
export class ApiError extends Error {
  public readonly code: ErrorCode;
  /** HTTP status; 0 when the request never got a response (network, client-side validation). */
  public readonly status: number;
  /** Server request id for support; empty when there was no server response. */
  public readonly requestId: string;

  public constructor(code: ErrorCode, status: number, message: string, requestId = '') {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}
