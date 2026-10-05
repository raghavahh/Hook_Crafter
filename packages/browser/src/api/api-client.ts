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
import { HttpTransport, type HttpTransportOptions } from './http';

export type ApiClientOptions = HttpTransportOptions;

/** Validates a request client-side (sanitises text too) before it leaves the browser. */
function validated<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiError('VALIDATION', 0, 'Please check the form and try again.');
  return parsed.data;
}

const AnyJson = z.unknown();
const AdminDaysSchema = z.number().int().min(1).max(365);

/**
 * The only way the UI talks to the API (React components never call fetch).
 * Every response is validated with the shared Zod contract from @hook/domain.
 */
export class ApiClient {
  readonly #http: HttpTransport;

  public constructor(options: ApiClientOptions) {
    this.#http = new HttpTransport(options);
  }

  public health(): Promise<z.output<typeof HealthResponseSchema>> {
    return this.#http.json('GET', '/v1/health', HealthResponseSchema);
  }

  public me(): Promise<MeResponse> {
    return this.#http.json('GET', '/v1/me', MeResponseSchema);
  }

  public catalog(): Promise<CatalogResponse> {
    return this.#http.json('GET', `/v1/billing/catalog?product=${THIS_PRODUCT}`, CatalogResponseSchema);
  }

  public async generate(req: z.input<typeof GenerateRequestSchema>): Promise<GenerateResponse> {
    const body = validated(GenerateRequestSchema, req);
    return this.#http.json('POST', '/v1/hooks/generate', GenerateResponseSchema, body);
  }

  public async rewritePost(req: z.input<typeof RewritePostRequestSchema>): Promise<RewritePostResponse> {
    const body = validated(RewritePostRequestSchema, req);
    return this.#http.json('POST', '/v1/hooks/rewrite-post', RewritePostResponseSchema, body);
  }

  public async reels(req: z.input<typeof ReelsRequestSchema>): Promise<ReelsResponse> {
    const body = validated(ReelsRequestSchema, req);
    return this.#http.json('POST', '/v1/hooks/reels', ReelsResponseSchema, body);
  }

  public history(): Promise<z.output<typeof HistoryResponseSchema>> {
    return this.#http.json('GET', '/v1/hooks/history', HistoryResponseSchema);
  }

  public async createOrder(packId: string): Promise<OrderResponse> {
    const body = validated(CreateOrderRequestSchema, { product: THIS_PRODUCT, packId });
    return this.#http.json('POST', '/v1/pay/order', OrderResponseSchema, body);
  }

  public async verifyPayment(
    req: z.input<typeof VerifyPaymentRequestSchema>,
  ): Promise<z.output<typeof VerifyPaymentResponseSchema>> {
    const body = validated(VerifyPaymentRequestSchema, req);
    return this.#http.json('POST', '/v1/pay/verify', VerifyPaymentResponseSchema, body);
  }

  public async createSubscription(planId: string): Promise<z.output<typeof CreateSubscriptionResponseSchema>> {
    const body = validated(CreateSubscriptionRequestSchema, { product: THIS_PRODUCT, planId });
    return this.#http.json('POST', '/v1/billing/subscriptions', CreateSubscriptionResponseSchema, body);
  }

  public async verifySubscription(
    req: z.input<typeof VerifySubscriptionRequestSchema>,
  ): Promise<z.output<typeof VerifySubscriptionResponseSchema>> {
    const body = validated(VerifySubscriptionRequestSchema, req);
    return this.#http.json('POST', '/v1/billing/subscriptions/verify', VerifySubscriptionResponseSchema, body);
  }

  public async changePlan(planId: string): Promise<ChangePlanResponse> {
    const body = validated(ChangePlanRequestSchema, { product: THIS_PRODUCT, planId });
    return this.#http.json('POST', '/v1/billing/subscriptions/change-plan', ChangePlanResponseSchema, body);
  }

  public async cancelSubscription(): Promise<z.output<typeof CancelResponseSchema>> {
    const body = validated(ProductOnlyRequestSchema, { product: THIS_PRODUCT });
    return this.#http.json('POST', '/v1/billing/subscriptions/cancel', CancelResponseSchema, body);
  }

  public exportAccount(): Promise<unknown> {
    return this.#http.json('GET', '/v1/account/export', AnyJson);
  }

  public async deleteAccount(): Promise<void> {
    const body = validated(DeleteAccountRequestSchema, { confirm: 'DELETE' });
    await this.#http.send('POST', '/v1/account/delete', body);
  }

  public async adminMetrics(days: number): Promise<AdminMetrics> {
    const valid = validated(AdminDaysSchema, days);
    return this.#http.json('GET', `/v1/admin/metrics?days=${String(valid)}`, AdminMetricsSchema);
  }

  public async swipeList(query: z.input<typeof SwipeListQuerySchema> = {}): Promise<SwipeListResponse> {
    const valid = validated(SwipeListQuerySchema, query);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(valid)) {
      if (typeof value === 'string') params.set(key, value);
    }
    const search = params.toString();
    return this.#http.json('GET', `/v1/hooks/swipe${search === '' ? '' : `?${search}`}`, SwipeListResponseSchema);
  }

  public async swipeSave(req: z.input<typeof SwipeSaveRequestSchema>): Promise<z.output<typeof SwipeSaveResponseSchema>> {
    const body = validated(SwipeSaveRequestSchema, req);
    return this.#http.json('POST', '/v1/hooks/swipe', SwipeSaveResponseSchema, body);
  }

  public async swipeDelete(id: string): Promise<void> {
    const valid = validated(UuidSchema, id);
    await this.#http.send('DELETE', `/v1/hooks/swipe/${encodeURIComponent(valid)}`);
  }
}
