import { Hono } from 'hono';
import {
  GenerateRequestSchema,
  ReelsRequestSchema,
  RewritePostRequestSchema,
  SwipeListQuerySchema,
  SwipeSaveRequestSchema,
} from '@hook/domain';
import { MemoryRateLimiter } from '../middleware/limits';
import { RateLimitError } from '@hook/domain';
import type { AppEnv, AppServices } from '../types';
import { parseBody, parseQuery } from '../validation';

/** Product routes (B5). Handlers stay thin: parse -> service -> JSON. */
export function hookRoutes(services: AppServices): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const swipeReads = new MemoryRateLimiter(60);

  app.post('/generate', async (c) => {
    const req = parseBody(c, GenerateRequestSchema);
    return c.json(await services.hooks.generate(c.get('user').id, req, c.req.header('cf-connecting-ip') ?? null));
  });

  app.post('/rewrite-post', async (c) => {
    const req = parseBody(c, RewritePostRequestSchema);
    return c.json(await services.rewrite.rewrite(c.get('user').id, req));
  });

  app.post('/reels', async (c) => {
    const req = parseBody(c, ReelsRequestSchema);
    return c.json(await services.reels.create(c.get('user').id, req));
  });

  app.get('/swipe', async (c) => {
    const userId = c.get('user').id;
    if (!swipeReads.allow(`swipe:${userId}`)) throw new RateLimitError();
    return c.json(await services.swipe.list(userId, parseQuery(c, SwipeListQuerySchema)));
  });

  app.post('/swipe', async (c) => {
    const req = parseBody(c, SwipeSaveRequestSchema);
    return c.json(await services.swipe.save(c.get('user').id, req), 201);
  });

  app.delete('/swipe/:id', async (c) => {
    await services.swipe.remove(c.get('user').id, c.req.param('id'));
    return c.body(null, 204);
  });

  app.get('/history', async (c) => c.json({ items: await services.history.recent(c.get('user').id) }));

  return app;
}
