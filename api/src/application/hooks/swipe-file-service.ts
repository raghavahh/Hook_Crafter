import {
  LockedFeatureError,
  NotFoundError,
  THIS_PRODUCT,
  ValidationError,
  type SwipeHook,
  type SwipeListQuery,
  type SwipeListResponse,
  type SwipeSaveRequest,
} from '@hook/domain';
import type { SwipeCursor, SwipeHookRecord, SwipeHookRepository } from '../../ports';
import type { EntitlementResolver } from '../billing/entitlement-resolver';
import type { RateLimiter } from '../billing/rate-limiter';

const PAGE_SIZE = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/** Flow 3. The user id ALWAYS comes from the verified token (T2 / S-28). */
export class SwipeFileService {
  readonly #repo: SwipeHookRepository;
  readonly #resolver: EntitlementResolver;
  readonly #rateLimiter: RateLimiter;

  public constructor(deps: { repo: SwipeHookRepository; resolver: EntitlementResolver; rateLimiter: RateLimiter }) {
    this.#repo = deps.repo;
    this.#resolver = deps.resolver;
    this.#rateLimiter = deps.rateLimiter;
  }

  public async save(userId: string, req: SwipeSaveRequest): Promise<{ id: string }> {
    await this.#rateLimiter.hit(userId, THIS_PRODUCT, 'swipe_write', 60);
    const { profile } = await this.#resolver.access(userId, THIS_PRODUCT);
    if (req.collection !== undefined && !profile.has('collections')) throw new LockedFeatureError();
    const id = await this.#repo.save(
      userId,
      {
        text: req.text,
        frameworkId: req.frameworkId,
        platform: req.platform,
        language: req.language,
        collection: req.collection ?? null,
      },
      profile.swipeLimit,
    );
    return { id };
  }

  public async list(userId: string, query: SwipeListQuery): Promise<SwipeListResponse> {
    const cursor = query.cursor === undefined ? null : decodeCursor(query.cursor);
    const filter = {
      ...(query.platform === undefined ? {} : { platform: query.platform }),
      ...(query.frameworkId === undefined ? {} : { frameworkId: query.frameworkId }),
      ...(query.collection === undefined ? {} : { collection: query.collection }),
    };
    const [page, count, access] = await Promise.all([
      this.#repo.list(userId, filter, cursor, PAGE_SIZE),
      this.#repo.count(userId),
      this.#resolver.access(userId, THIS_PRODUCT),
    ]);
    return {
      items: page.items.map(toView),
      nextCursor: page.next === null ? null : encodeCursor(page.next),
      count,
      limit: access.profile.swipeLimit,
    };
  }

  public async remove(userId: string, id: string): Promise<void> {
    if (!UUID.test(id)) throw new ValidationError('Invalid id.');
    await this.#rateLimiter.hit(userId, THIS_PRODUCT, 'swipe_write', 60);
    const removed = await this.#repo.delete(userId, id);
    if (!removed) throw new NotFoundError();
  }
}

function toView(record: SwipeHookRecord): SwipeHook {
  return {
    id: record.id,
    text: record.text,
    frameworkId: record.frameworkId,
    platform: record.platform,
    language: record.language,
    collection: record.collection,
    createdAt: record.createdAt.toISOString(),
  };
}

export function encodeCursor(cursor: SwipeCursor): string {
  return btoa(`${cursor.createdAt.toISOString()}|${cursor.id}`).replace(/=+$/u, '').replace(/\+/gu, '-').replace(/\//gu, '_');
}

export function decodeCursor(raw: string): SwipeCursor {
  try {
    const [iso, id] = atob(raw.replace(/-/gu, '+').replace(/_/gu, '/')).split('|');
    const createdAt = new Date(iso ?? '');
    if (id === undefined || !UUID.test(id) || Number.isNaN(createdAt.getTime())) throw new Error('bad');
    return { createdAt, id };
  } catch {
    throw new ValidationError('Invalid cursor.');
  }
}
