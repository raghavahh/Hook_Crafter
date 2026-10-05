import { Hono } from 'hono';
import {
  CatalogQuerySchema,
  ChangePlanRequestSchema,
  CreateOrderRequestSchema,
  CreateSubscriptionRequestSchema,
  ProductOnlyRequestSchema,
  THIS_PRODUCT,
  VerifyPaymentRequestSchema,
  VerifySubscriptionRequestSchema,
} from '@hook/domain';
import { catalogView } from '../../application/billing/catalog-view';
import type { AppEnv, AppServices, HttpConfig } from '../types';
import { parseBody, parseQuery } from '../validation';

export function payRoutes(services: AppServices): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const limit = services.rateLimiter;

  app.post('/order', async (c) => {
    const userId = c.get('user').id;
    await limit.hit(userId, THIS_PRODUCT, 'pay_order', 10);
    return c.json(await services.checkout.createOrder(userId, parseBody(c, CreateOrderRequestSchema)));
  });

  app.post('/verify', async (c) => {
    const userId = c.get('user').id;
    await limit.hit(userId, THIS_PRODUCT, 'pay_verify', 20);
    await services.payments.verify(userId, parseBody(c, VerifyPaymentRequestSchema));
    const { summary } = await services.resolver.access(userId, THIS_PRODUCT);
    return c.json({ credits: { generate: summary.credits.generate, post_rewrite: summary.credits.post_rewrite }, unlocks: [...summary.unlocks] });
  });

  return app;
}

export function catalogRoute(services: AppServices, config: HttpConfig): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.get('/catalog', (c) => c.json(catalogView(services.catalog, parseQuery(c, CatalogQuerySchema).product, config.providerEnv)));
  return app;
}

export function subscriptionRoutes(services: AppServices): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const limit = services.rateLimiter;

  app.post('/', async (c) => {
    const userId = c.get('user').id;
    await limit.hit(userId, THIS_PRODUCT, 'sub_create', 5);
    const req = parseBody(c, CreateSubscriptionRequestSchema);
    return c.json(await services.subscriptions.create(userId, req.product, req.planId));
  });

  app.post('/verify', async (c) => {
    const userId = c.get('user').id;
    await limit.hit(userId, THIS_PRODUCT, 'sub_verify', 20);
    const req = parseBody(c, VerifySubscriptionRequestSchema);
    return c.json(await services.subscriptions.verify(userId, req.subscriptionId, req.paymentId, req.signature));
  });

  app.post('/change-plan', async (c) => {
    const userId = c.get('user').id;
    await limit.hit(userId, THIS_PRODUCT, 'sub_change', 5);
    const req = parseBody(c, ChangePlanRequestSchema);
    return c.json(await services.planChanges.change(userId, req.product, req.planId));
  });

  app.post('/cancel', async (c) => {
    const userId = c.get('user').id;
    await limit.hit(userId, THIS_PRODUCT, 'sub_cancel', 5);
    return c.json(await services.subscriptions.cancel(userId, parseBody(c, ProductOnlyRequestSchema).product));
  });

  return app;
}
