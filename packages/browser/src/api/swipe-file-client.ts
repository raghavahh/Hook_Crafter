import type { SwipeListQuerySchema, SwipeListResponse, SwipeSaveRequestSchema, SwipeSaveResponseSchema } from '@hook/domain';
import type { z } from 'zod';
import type { ApiClient } from './api-client';

/** Swipe file (PRD B4 Flow 3). The server owns limits and the user id; this only calls the API. */
export class SwipeFileClient {
  readonly #api: ApiClient;

  public constructor(api: ApiClient) {
    this.#api = api;
  }

  public list(query: z.input<typeof SwipeListQuerySchema> = {}): Promise<SwipeListResponse> {
    return this.#api.swipeList(query);
  }

  public save(req: z.input<typeof SwipeSaveRequestSchema>): Promise<z.output<typeof SwipeSaveResponseSchema>> {
    return this.#api.swipeSave(req);
  }

  /** Rejects with ApiError('VALIDATION') before sending when `id` is not a UUID. */
  public remove(id: string): Promise<void> {
    return this.#api.swipeDelete(id);
  }
}
