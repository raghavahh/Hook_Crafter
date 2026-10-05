import { buildContainer, type Container } from './container';
import { createApp } from './http/app';
import type { WorkersAiBinding } from './infrastructure/llm/workers-ai-provider';

interface WorkerEnv extends Record<string, unknown> {
  readonly AI?: WorkersAiBinding;
}

interface Booted {
  readonly container: Container;
  readonly app: ReturnType<typeof createApp>;
}

let cached: Booted | null = null;

/** Built once per isolate; config errors fail closed (500) instead of running half-configured. */
function boot(env: WorkerEnv): Booted {
  if (cached === null) {
    const container = buildContainer(env, env.AI ?? null);
    cached = { container, app: createApp(container.services, container.http) };
  }
  return cached;
}

export default {
  fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Response | Promise<Response> {
    return boot(env).app.fetch(request, env, ctx);
  },
  /** Daily Cron Trigger: BillingReconciler (Flow 5 step 6). */
  scheduled(_controller: ScheduledController, env: WorkerEnv, ctx: ExecutionContext): void {
    ctx.waitUntil(boot(env).container.reconciler.run().then(() => undefined));
  },
};
