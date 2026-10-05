import { Hono } from 'hono';
import { AuthError, ValidationError } from '@hook/domain';
import { requireUser } from './middleware/auth';
import { cors, requestId, securityHeaders } from './middleware/basics';
import { bodyLimit } from './middleware/body';
import { notFound, onError } from './middleware/errors';
import { burstLimit, killSwitches, MemoryRateLimiter } from './middleware/limits';
import { accountRoutes } from './routes/account';
import { catalogRoute, payRoutes, subscriptionRoutes } from './routes/billing';
import { hookRoutes } from './routes/hooks';
import type { AppEnv, AppServices, HttpConfig } from './types';

/**
 * Middleware order (SHARED-ENGINE section 3): requestId -> securityHeaders -> CORS -> bodyLimit
 * -> contentType (inside bodyLimit) -> errorMapper (onError) -> auth -> rateLimit -> route.
 */
export function createApp(services: AppServices, config: HttpConfig): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const isDeleted = (userId: string): Promise<boolean> => services.accounts.isDeleted(userId);
  const auth = requireUser(services.tokens, isDeleted);

  app.use('*', requestId(), securityHeaders(), cors(config.allowedOrigins));
  app.use('*', burstLimit(new MemoryRateLimiter(config.burstPerMinute)));
  app.use('/v1/pay/webhook', bodyLimit(64 * 1024));
  app.use('*', async (c, next) => (c.req.path === '/v1/pay/webhook' ? next() : bodyLimit(config.bodyLimit)(c, next)));
  app.use('*', killSwitches(config.switches));
  app.onError(onError(services.logger));
  app.notFound(notFound);

  app.get('/v1/health', (c) => c.json({ ok: true }));
  app.route('/v1/billing', catalogRoute(services, config));

  app.post('/v1/pay/webhook', async (c) => {
    const result = await services.webhooks.receive(c.get('rawBody'), c.req.header('x-razorpay-signature') ?? null, c.req.header('x-razorpay-event-id') ?? null);
    return c.json({ ok: true, result });
  });

  app.use('/v1/hooks/*', auth);
  app.use('/v1/pay/order', auth);
  app.use('/v1/pay/verify', auth);
  app.use('/v1/billing/subscriptions', auth);
  app.use('/v1/billing/subscriptions/*', auth);
  app.use('/v1/me', auth);
  app.use('/v1/account/*', auth);
  app.use('/v1/admin/*', async (c, next) => {
    // Hide the admin surface: no token / bad token also gets the plain 404 (ADR-0004).
    try {
      await auth(c, async () => undefined);
    } catch (error: unknown) {
      if (error instanceof AuthError || error instanceof ValidationError) return notFound(c);
      throw error;
    }
    return next();
  });

  app.route('/v1/hooks', hookRoutes(services));
  app.route('/v1/pay', payRoutes(services));
  app.route('/v1/billing/subscriptions', subscriptionRoutes(services));
  app.route('/v1', accountRoutes(services));
  return app;
}
