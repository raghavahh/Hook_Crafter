import { Hono } from 'hono';
import { AdminMetricsQuerySchema, DeleteAccountRequestSchema, RateLimitError, THIS_PRODUCT } from '@hook/domain';
import { MemoryRateLimiter } from '../middleware/limits';
import { notFound } from '../middleware/errors';
import type { AppEnv, AppServices } from '../types';
import { parseBody, parseQuery } from '../validation';

export function accountRoutes(services: AppServices): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const meReads = new MemoryRateLimiter(60);

  app.get('/me', async (c) => {
    const userId = c.get('user').id;
    if (!meReads.allow(`me:${userId}`)) throw new RateLimitError();
    return c.json(await services.accounts.me(userId));
  });

  app.get('/account/export', async (c) => {
    const userId = c.get('user').id;
    await services.rateLimiter.hit(userId, THIS_PRODUCT, 'export', 5, 'day');
    c.header('content-disposition', 'attachment; filename="hook-crafter-export.json"');
    return c.json(await services.accounts.exportData(userId));
  });

  app.post('/account/delete', async (c) => {
    const userId = c.get('user').id;
    await services.rateLimiter.hit(userId, THIS_PRODUCT, 'delete', 3, 'day');
    parseBody(c, DeleteAccountRequestSchema);
    await services.accounts.delete(userId);
    return c.body(null, 204);
  });

  /** ADR-0004: anyone who is not the owner gets the exact generic 404 of an unknown route. */
  app.get('/admin/metrics', async (c) => {
    if (!services.admin.isAdmin(c.get('user').id)) return notFound(c);
    return c.json(await services.admin.metrics(parseQuery(c, AdminMetricsQuerySchema).days));
  });

  return app;
}
