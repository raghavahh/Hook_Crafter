import {
  AdminMetricsSchema,
  CancelResponseSchema,
  CatalogResponseSchema,
  ChangePlanRequestSchema,
  ChangePlanResponseSchema,
  CreateOrderRequestSchema,
  CreateSubscriptionRequestSchema,
  CreateSubscriptionResponseSchema,
  DeleteAccountRequestSchema,
  GenerateRequestSchema,
  GenerateResponseSchema,
  HealthResponseSchema,
  HistoryResponseSchema,
  MeResponseSchema,
  OrderResponseSchema,
  ProductOnlyRequestSchema,
  ReelsRequestSchema,
  ReelsResponseSchema,
  RewritePostRequestSchema,
  RewritePostResponseSchema,
  SwipeListQuerySchema,
  SwipeListResponseSchema,
  SwipeSaveRequestSchema,
  SwipeSaveResponseSchema,
  THIS_PRODUCT,
  UuidSchema,
  VerifyPaymentRequestSchema,
  VerifyPaymentResponseSchema,
  VerifySubscriptionRequestSchema,
  VerifySubscriptionResponseSchema,
  type AdminMetrics,
  type CatalogResponse,
  type ChangePlanResponse,
  type GenerateResponse,
  type MeResponse,
  type OrderResponse,
  type ReelsResponse,
  type RewritePostResponse,
  type SwipeListResponse,
} from '@hook/domain';
import { z } from 'zod';
import { ApiError } from './api-error';
import { AI_TIMEOUT_MS, HttpTransport, type HttpTransportOptions, type RequestOptions } from './http';

export type ApiClientOptions = HttpTransportOptions;

/** Validates a request client-side (sanitises text too) before it leaves the browser. */
function validated<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiError('VALIDATION', 0, 'Please check the form and try again.');
  return parsed.data;
}

const AnyJson = z.unknown();
const AdminDaysSchema = z.number().int().min(1).max(365);
const NO_OPTIONS: RequestOptions = {};

/**
 * The only way the UI talks to the API (React components never call fetch).
 * Every response is validated with the shared Zod contract from @hook/domain.
 * Every method takes an optional `{ signal }` to cancel; AI routes get a longer deadline.
 */
export class ApiClient {
  readonly #http: HttpTransport;

  public constructor(options: ApiClientOptions) {
    this.#http = new HttpTransport(options);
  }

  public health(options = NO_OPTIONS): Promise<z.output<typeof HealthResponseSchema>> {
    return this.#http.json('GET', '/v1/health', HealthResponseSchema, { signal: options.signal });
  }

  public me(options = NO_OPTIONS): Promise<MeResponse> {
    return this.#http.json('GET', '/v1/me', MeResponseSchema, { signal: options.signal });
  }

  public catalog(options = NO_OPTIONS): Promise<CatalogResponse> {
    return this.#http.json('GET', `/v1/billing/catalog?product=${THIS_PRODUCT}`, CatalogResponseSchema, { signal: options.signal });
  }

  public async generate(req: z.input<typeof GenerateRequestSchema>, options = NO_OPTIONS): Promise<GenerateResponse> {
    const body = validated(GenerateRequestSchema, req);
    return this.#http.json('POST', '/v1/hooks/generate', GenerateResponseSchema, this.#ai(body, options));
  }

  public async rewritePost(req: z.input<typeof RewritePostRequestSchema>, options = NO_OPTIONS): Promise<RewritePostResponse> {
    const body = validated(RewritePostRequestSchema, req);
    return this.#http.json('POST', '/v1/hooks/rewrite-post', RewritePostResponseSchema, this.#ai(body, options));
  }

  public async reels(req: z.input<typeof ReelsRequestSchema>, options = NO_OPTIONS): Promise<ReelsResponse> {
    const body = validated(ReelsRequestSchema, req);
    return this.#http.json('POST', '/v1/hooks/reels', ReelsResponseSchema, this.#ai(body, options));
  }

  public history(options = NO_OPTIONS): Promise<z.output<typeof HistoryResponseSchema>> {
    return this.#http.json('GET', '/v1/hooks/history', HistoryResponseSchema, { signal: options.signal });
  }

  public async createOrder(packId: string, options = NO_OPTIONS): Promise<OrderResponse> {
    const body = validated(CreateOrderRequestSchema, { product: THIS_PRODUCT, packId });
    return this.#http.json('POST', '/v1/pay/order', OrderResponseSchema, { body, signal: options.signal });
  }

  public async verifyPayment(
    req: z.input<typeof VerifyPaymentRequestSchema>,
    options = NO_OPTIONS,
  ): Promise<z.output<typeof VerifyPaymentResponseSchema>> {
    const body = validated(VerifyPaymentRequestSchema, req);
    return this.#http.json('POST', '/v1/pay/verify', VerifyPaymentResponseSchema, { body, signal: options.signal });
  }

  public async createSubscription(planId: string, options = NO_OPTIONS): Promise<z.output<typeof CreateSubscriptionResponseSchema>> {
    const body = validated(CreateSubscriptionRequestSchema, { product: THIS_PRODUCT, planId });
    return this.#http.json('POST', '/v1/billing/subscriptions', CreateSubscriptionResponseSchema, { body, signal: options.signal });
  }

  public async verifySubscription(
    req: z.input<typeof VerifySubscriptionRequestSchema>,
    options = NO_OPTIONS,
  ): Promise<z.output<typeof VerifySubscriptionResponseSchema>> {
    const body = validated(VerifySubscriptionRequestSchema, req);
    const path = '/v1/billing/subscriptions/verify';
    return this.#http.json('POST', path, VerifySubscriptionResponseSchema, { body, signal: options.signal });
  }

  public async changePlan(planId: string, options = NO_OPTIONS): Promise<ChangePlanResponse> {
    const body = validated(ChangePlanRequestSchema, { product: THIS_PRODUCT, planId });
    const path = '/v1/billing/subscriptions/change-plan';
    return this.#http.json('POST', path, ChangePlanResponseSchema, { body, signal: options.signal });
  }

  public async cancelSubscription(options = NO_OPTIONS): Promise<z.output<typeof CancelResponseSchema>> {
    const body = validated(ProductOnlyRequestSchema, { product: THIS_PRODUCT });
    return this.#http.json('POST', '/v1/billing/subscriptions/cancel', CancelResponseSchema, { body, signal: options.signal });
  }

  public exportAccount(options = NO_OPTIONS): Promise<unknown> {
    return this.#http.json('GET', '/v1/account/export', AnyJson, { signal: options.signal });
  }

  public async deleteAccount(options = NO_OPTIONS): Promise<void> {
    const body = validated(DeleteAccountRequestSchema, { confirm: 'DELETE' });
    await this.#http.send('POST', '/v1/account/delete', { body, signal: options.signal });
  }

  public async adminMetrics(days: number, options = NO_OPTIONS): Promise<AdminMetrics> {
    const valid = validated(AdminDaysSchema, days);
    return this.#http.json('GET', `/v1/admin/metrics?days=${String(valid)}`, AdminMetricsSchema, { signal: options.signal });
  }

  public async swipeList(query: z.input<typeof SwipeListQuerySchema> = {}, options = NO_OPTIONS): Promise<SwipeListResponse> {
    const valid = validated(SwipeListQuerySchema, query);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(valid)) {
      if (typeof value === 'string') params.set(key, value);
    }
    const search = params.toString();
    const path = `/v1/hooks/swipe${search === '' ? '' : `?${search}`}`;
    return this.#http.json('GET', path, SwipeListResponseSchema, { signal: options.signal });
  }

  public async swipeSave(
    req: z.input<typeof SwipeSaveRequestSchema>,
    options = NO_OPTIONS,
  ): Promise<z.output<typeof SwipeSaveResponseSchema>> {
    const body = validated(SwipeSaveRequestSchema, req);
    return this.#http.json('POST', '/v1/hooks/swipe', SwipeSaveResponseSchema, { body, signal: options.signal });
  }

  public async swipeDelete(id: string, options = NO_OPTIONS): Promise<void> {
    const valid = validated(UuidSchema, id);
    await this.#http.send('DELETE', `/v1/hooks/swipe/${encodeURIComponent(valid)}`, { signal: options.signal });
  }

  #ai(body: unknown, options: RequestOptions): { body: unknown; signal: AbortSignal | undefined; timeoutMs: number } {
    return { body, signal: options.signal, timeoutMs: AI_TIMEOUT_MS };
  }
}
