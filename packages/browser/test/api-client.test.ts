import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError, SwipeFileClient } from '../src';

interface Call {
  readonly url: string;
  readonly method: string;
  readonly headers: Headers;
  readonly body: unknown;
  readonly cache: RequestCache | undefined;
  readonly signal: AbortSignal | undefined;
}

const UUID = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e';

function fakeFetch(respond: (call: Call) => Response | Promise<Response>): { fetchImpl: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    const call: Call = {
      url: String(input),
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
      body,
      cache: init?.cache,
      signal: init?.signal ?? undefined,
    };
    calls.push(call);
    return respond(call);
  };
  return { fetchImpl, calls };
}

const json = (data: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } });

function client(respond: (call: Call) => Response | Promise<Response>, token: string | null = 'tok-123') {
  const fake = fakeFetch(respond);
  const api = new ApiClient({ baseUrl: 'https://api.example.test/', getAccessToken: async () => token, fetchImpl: fake.fetchImpl });
  return { api, calls: fake.calls };
}

const ME = {
  userId: UUID,
  credits: { generate: 3, post_rewrite: 0 },
  freeGenerateLeftToday: 1,
  unlocks: [],
  swipeLimit: 50,
  swipeCount: 2,
  rateLimitPerHour: 10,
  voiceProfileLimit: 0,
  aiTier: 'free',
  billingPastDue: false,
  subscriptions: [],
  history: [],
};

async function caught(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected an ApiError');
}

describe('ApiClient', () => {
  it('sends the bearer token and parses the response', async () => {
    const { api, calls } = client(() => json(ME));
    await expect(api.me()).resolves.toEqual(ME);
    expect(calls[0]?.url).toBe('https://api.example.test/v1/me');
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer tok-123');
    expect(calls[0]?.headers.get('content-type')).toBeNull();
  });

  it('omits the auth header when there is no token', async () => {
    const { api, calls } = client(() => json({ ok: true }), null);
    await expect(api.health()).resolves.toEqual({ ok: true });
    expect(calls[0]?.headers.has('authorization')).toBe(false);
  });

  it('maps the server error body to ApiError', async () => {
    const body = { error: { code: 'NO_CREDITS', message: "You're out of credits.", requestId: 'req-9' } };
    const { api } = client(() => json(body, 402));
    const error = await caught(api.me());
    expect(error).toMatchObject({ code: 'NO_CREDITS', status: 402, requestId: 'req-9', message: "You're out of credits." });
    expect(error.name).toBe('ApiError');
  });

  it('maps malformed error bodies by status', async () => {
    const cases: [number, string][] = [[503, 'UNAVAILABLE'], [500, 'INTERNAL'], [418, 'VALIDATION'], [401, 'UNAUTHENTICATED']];
    for (const [status, code] of cases) {
      const { api } = client(() => new Response('<html>oops</html>', { status, headers: { 'x-request-id': 'r1' } }));
      expect(await caught(api.me())).toMatchObject({ code, status, requestId: 'r1' });
    }
  });

  it('turns a network failure into UNAVAILABLE with status 0', async () => {
    const { api } = client(() => Promise.reject(new TypeError('Failed to fetch')));
    expect(await caught(api.me())).toMatchObject({ code: 'UNAVAILABLE', status: 0, requestId: '' });
  });

  it('rejects a response that does not match the schema', async () => {
    const { api } = client(() => json({ userId: 'not-a-uuid' }));
    expect(await caught(api.me())).toMatchObject({ code: 'INTERNAL', status: 200 });
    const empty = client(() => new Response(null, { status: 200 }));
    expect(await caught(empty.api.health())).toMatchObject({ code: 'INTERNAL' });
  });

  it('reports a failing token provider as UNAUTHENTICATED', async () => {
    const api = new ApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: () => Promise.reject(new Error('expired')),
      fetchImpl: fakeFetch(() => json({ ok: true })).fetchImpl,
    });
    expect(await caught(api.health())).toMatchObject({ code: 'UNAUTHENTICATED', status: 0 });
  });

  it('sanitises and validates generate requests before sending JSON', async () => {
    const hooks = Array.from({ length: 10 }, () => ({ text: 'A hook', frameworkId: 'contrarian', platform: 'linkedin' }));
    const { api, calls } = client(() => json({ hooks }));
    const req = { topic: '  \u202Ehiring mistakes ', platform: 'linkedin', language: 'en', tone: 'bold' } as const;
    await expect(api.generate(req)).resolves.toEqual({ hooks });
    expect(calls[0]).toMatchObject({ method: 'POST', url: 'https://api.example.test/v1/hooks/generate' });
    expect(calls[0]?.headers.get('content-type')).toBe('application/json');
    expect(calls[0]?.body).toEqual({ topic: 'hiring mistakes', platform: 'linkedin', language: 'en', tone: 'bold' });
    const bad = await caught(api.generate({ ...req, topic: '   ' }));
    expect(bad).toMatchObject({ code: 'VALIDATION', status: 0 });
    expect(calls).toHaveLength(1);
  });

  it('builds billing and account requests for the hooks product', async () => {
    const { api, calls } = client((call) => {
      if (call.url.endsWith('/v1/pay/order')) return json({ orderId: 'order_1', amount: 9900, currency: 'INR', keyId: 'k' });
      if (call.url.endsWith('/change-plan')) return json({ kind: 'downgrade', effectiveAt: '2026-11-01T00:00:00Z' });
      if (call.url.endsWith('/cancel')) return json({ accessUntil: '2026-11-01T00:00:00Z' });
      if (call.url.endsWith('/v1/account/delete')) return new Response(null, { status: 204 });
      return json({ anything: [1, 2] });
    });
    await api.createOrder('creator');
    await api.changePlan('creator_monthly');
    await api.cancelSubscription();
    await expect(api.deleteAccount()).resolves.toBeUndefined();
    await expect(api.exportAccount()).resolves.toEqual({ anything: [1, 2] });
    expect(calls.map((c) => c.body)).toEqual([
      { product: 'hooks', packId: 'creator' },
      { product: 'hooks', planId: 'creator_monthly' },
      { product: 'hooks' },
      { confirm: 'DELETE' },
      undefined,
    ]);
  });

  it('routes the remaining endpoints to their paths and schemas', async () => {
    const sig = 'a'.repeat(64);
    const responses: Record<string, unknown> = {
      '/v1/hooks/rewrite-post': { post: 'Better post', hookFrameworkId: 'contrarian' },
      '/v1/hooks/reels': { spokenLine: 'Stop.', onScreenText: 'Stop', visualIdea: 'Close-up', beats: [{ atSec: 0, action: 'a' }, { atSec: 3, action: 'b' }] },
      '/v1/hooks/history': { items: [] },
      '/v1/pay/verify': { credits: { generate: 25, post_rewrite: 5 }, unlocks: [] },
      '/v1/billing/subscriptions': { subscriptionId: 'sub_1', keyId: 'k' },
      '/v1/billing/subscriptions/verify': { status: 'active' },
    };
    const { api, calls } = client((call) => json(responses[new URL(call.url).pathname]));
    await api.rewritePost({ post: 'My post', platform: 'linkedin', language: 'hinglish' });
    await api.reels({ topic: 'Morning routine', language: 'en', durationSec: 15 });
    await api.history();
    await api.verifyPayment({ orderId: 'order_ABC123', paymentId: 'pay_ABC123', signature: sig });
    await api.createSubscription('pro_monthly');
    await expect(api.verifySubscription({ subscriptionId: 'sub_ABC123', paymentId: 'pay_ABC123', signature: sig })).resolves.toEqual({
      status: 'active',
    });
    expect(calls.map((c) => `${c.method} ${new URL(c.url).pathname}`)).toEqual([
      'POST /v1/hooks/rewrite-post',
      'POST /v1/hooks/reels',
      'GET /v1/hooks/history',
      'POST /v1/pay/verify',
      'POST /v1/billing/subscriptions',
      'POST /v1/billing/subscriptions/verify',
    ]);
    expect(calls[4]?.body).toEqual({ product: 'hooks', planId: 'pro_monthly' });
    expect(await caught(api.verifyPayment({ orderId: 'x', paymentId: 'y', signature: 'z' }))).toMatchObject({ code: 'VALIDATION' });
  });

  it('puts the product and days in query strings and validates days', async () => {
    const { api, calls } = client(() => json({}));
    await caught(api.catalog());
    await caught(api.adminMetrics(7));
    expect(calls.map((c) => c.url)).toEqual([
      'https://api.example.test/v1/billing/catalog?product=hooks',
      'https://api.example.test/v1/admin/metrics?days=7',
    ]);
    expect(await caught(api.adminMetrics(0))).toMatchObject({ code: 'VALIDATION', status: 0 });
    expect(calls).toHaveLength(2);
  });
});

/** A fetch that never answers until its signal aborts. */
function hangingFetch(call: Call): Promise<Response> {
  return new Promise((_, reject) => {
    call.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  });
}

describe('ApiClient deadlines and caching', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sets cache: no-store and a signal on every request', async () => {
    const { api, calls } = client(() => json({ ok: true }));
    await api.health();
    expect(calls[0]?.cache).toBe('no-store');
    expect(calls[0]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('times out standard routes after 15 s as UNAVAILABLE with status 0', async () => {
    vi.useFakeTimers();
    const { api } = client(hangingFetch);
    const pending = caught(api.me());
    await vi.advanceTimersByTimeAsync(14_999);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({ code: 'UNAVAILABLE', status: 0, message: expect.stringContaining('too long') });
  });

  it('gives AI routes 30 s', async () => {
    vi.useFakeTimers();
    const { api } = client(hangingFetch);
    let settled = false;
    const pending = caught(api.generate({ topic: 'hiring', platform: 'x', language: 'en', tone: 'bold' })).finally(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(20_000);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toMatchObject({ code: 'UNAVAILABLE', status: 0 });
  });

  it('honours a caller signal, before and during the request', async () => {
    const { api, calls } = client(hangingFetch);
    const controller = new AbortController();
    const pending = caught(api.history({ signal: controller.signal }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls).toHaveLength(1);
    controller.abort();
    expect(await pending).toMatchObject({ code: 'UNAVAILABLE', status: 0, message: 'The request was cancelled.' });
    expect(await caught(api.me({ signal: controller.signal }))).toMatchObject({ message: 'The request was cancelled.' });
    expect(calls).toHaveLength(1);
  });

  it('honours the body code over the status fallback (402 BILLING_PAST_DUE)', async () => {
    const body = { error: { code: 'BILLING_PAST_DUE', message: 'Payment failed.', requestId: 'req-2' } };
    const { api } = client(() => json(body, 402));
    expect(await caught(api.createOrder('creator'))).toMatchObject({ code: 'BILLING_PAST_DUE', status: 402, requestId: 'req-2' });
    const bare = client(() => new Response('', { status: 402 }));
    expect(await caught(bare.api.me())).toMatchObject({ code: 'NO_CREDITS', status: 402 });
  });
});

describe('SwipeFileClient', () => {
  it('lists with a query string, saves and deletes by UUID', async () => {
    const { api, calls } = client((call) => {
      if (call.method === 'GET') return json({ items: [], nextCursor: null, count: 0, limit: 50 });
      if (call.method === 'POST') return json({ id: UUID });
      return new Response(null, { status: 204 });
    });
    const swipe = new SwipeFileClient(api);
    await swipe.list();
    await swipe.list({ platform: 'x', collection: 'Launch posts' });
    await expect(
      swipe.save({ text: 'My hook', frameworkId: 'contrarian', platform: 'x', language: 'en' }),
    ).resolves.toEqual({ id: UUID });
    await swipe.remove(UUID);
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'GET https://api.example.test/v1/hooks/swipe',
      'GET https://api.example.test/v1/hooks/swipe?platform=x&collection=Launch+posts',
      'POST https://api.example.test/v1/hooks/swipe',
      `DELETE https://api.example.test/v1/hooks/swipe/${UUID}`,
    ]);
  });

  it('refuses a non-UUID id without calling the server', async () => {
    const { api, calls } = client(() => new Response(null, { status: 204 }));
    expect(await caught(new SwipeFileClient(api).remove('../admin'))).toMatchObject({ code: 'VALIDATION' });
    expect(calls).toHaveLength(0);
  });
});
