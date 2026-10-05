# Hook Crafter: rules for every Claude session

Spec: `PROJECT-2-HOOK-CRAFTER.md` (authority) + `SHARED-ENGINE.md` (shared parts) + `docs/adr/`.
Work only inside this repo. Commit + push to `origin main` after every meaningful change.

## Security (non-negotiable)
- Never trust the browser: prices, user ids, credits, unlocks, limits, subscription status come from the server only.
- User id ONLY from the verified JWT. Every swipe/generation query filters by it.
- Zod `strictObject` on every route; UUID path params validated.
- Render user/AI text as text only. No `innerHTML`, `dangerouslySetInnerHTML`, `set:html`.
- No secrets in code, chat or commits. Secrets: `wrangler secret put` only; local `.dev.vars` is git-ignored.
- Logs never contain topic, post, hook or voice-profile text.
- Content policy on input AND output; a blocked topic uses no credit.
- Honest hooks: every number in output must appear in the input, or be a placeholder like `[X]`.
- Unicode: `TextSanitizer.clean` strips bidi/zero-width, keeps ZWJ/ZWNJ.
- DB: schema `app` hidden, RLS deny-all, functions `SECURITY DEFINER SET search_path = ''`, execute only for `service_role`.
- Admin routes return 404 to anyone not in `ADMIN_USER_IDS`.

## OOP / structure
- Methods <= 30 lines, files <= 300 lines. `#private` / `private readonly`; no public mutable state.
- Value objects immutable and self-validating. Constructor injection of interfaces; only `api/src/container.ts` wires adapters.
- Layers: domain -> nothing; application -> domain + ports; SDK/fetch only in infrastructure.
- No `any`, no `!`, no unchecked casts. Typed errors mapped to HTTP in one place.
- React components are functions; they never call `fetch` (use `ApiClient`).

## Commands
- `npm run check` = typecheck + lint + depcruise + tests
- `npx vitest run --project <domain|browser|api|db>`
