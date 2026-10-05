import type { SwipeListQuerySchema, SwipeListResponse, SwipeSaveRequestSchema, SwipeSaveResponseSchema } from '@hook/domain';
import type { z } from 'zod';
import type { ApiClient } from './api-client';
import type { RequestOptions } from './http';

/** Swipe file (PRD B4 Flow 3). The server owns limits and the user id; this only calls the API. */
export class SwipeFileClient {
  readonly #api: ApiClient;

  public constructor(api: ApiClient) {
    this.#api = api;
  }

  public list(query: z.input<typeof SwipeListQuerySchema> = {}, options: RequestOptions = {}): Promise<SwipeListResponse> {
    return this.#api.swipeList(query, options);
  }

  public save(
    req: z.input<typeof SwipeSaveRequestSchema>,
    options: RequestOptions = {},
  ): Promise<z.output<typeof SwipeSaveResponseSchema>> {
    return this.#api.swipeSave(req, options);
  }

  /** Rejects with ApiError('VALIDATION') before sending when `id` is not a UUID. */
  public remove(id: string, options: RequestOptions = {}): Promise<void> {
    return this.#api.swipeDelete(id, options);
  }
}
