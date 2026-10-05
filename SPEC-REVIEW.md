# Hook Crafter: full spec review

**Reviewed:** `PROJECT-2-HOOK-CRAFTER.md` (the authority), plus the shared-engine parts it references from `PROJECT-1-RESUME-ROASTER.md`. Those parts are now copied into [SHARED-ENGINE.md](SHARED-ENGINE.md).
**Date:** 2026-10-05. Ordered by impact.

## 0. Resolved by SHARED-ENGINE.md

- ~~"Shared engine" undefined~~ → middleware order, tables, SQL functions, payment flow, AI router, secrets, CSP and S-01 to S-27 are now written down in this repo.
- ~~CSP directives missing~~ → exact list in SHARED-ENGINE §11.
- S-14, S-15 and S-24 are Roaster-only and don't apply here. Hook's S-31 replaces S-24.

## 1. Blockers (decide before building)

### 1.1 The timeline assumes the shared engine already exists
Hook's 9 days assume Project 1 built login, credits, payments, the AI router and the DB lockdown. In the Roaster spec those take Phases 0–5 = **13 days**. Building them here makes Hook Crafter realistically **~16–18 days**, not 9.

### 1.2 Running both projects in parallel breaks free-tier limits
- **Supabase free plan allows only 2 active projects.** Each spec wants its own `dev` + `prod`, so two separate repos need 4 projects. The shared design (one DB, a `product` column) only works if **both products use the same 2 Supabase projects and the same migrations**.
- **Cloudflare Workers' 100k requests/day is per account,** shared by every Worker you deploy.
- **One Razorpay account:** one webhook secret, one place that processes payment events.

**Fix:** one engine, one DB, one Worker for all products, which is what both specs intend. Concretely: build the engine once (here or in Roaster), and the other repo uses it. Don't keep two copies of the billing code.

### 1.3 One-time packs undercut the monthly plans
| | Price | `generate` | `post_rewrite` | Unlocks | Expires |
| --- | --- | --- | --- | --- | --- |
| Pro Creator pack | ₹249 | 100 | 20 | reels + hindi **permanent** | never |
| Pro Monthly | ₹399/mo | 100 | 20 | reels + hindi while paying | end of month |

Same credits, permanent unlocks, ₹150 cheaper and no expiry. Studio has the same problem (₹599 vs ₹799). The "one-time → subscription ≥ 20%" target can't be met.
**Fix (pick one):** fewer credits per pack (e.g. Pro Creator → 50 generate), pack unlocks expire after 90 days, or cheaper monthly plans.

### 1.4 "Number List" framework vs the honest-hooks rule
"5 mistakes…" needs a number the user didn't give, so `NumberProvenanceCheck` rejects it. Combined with "≥ 6 distinct frameworks", sets will often fail validation and burn retries.
**Fix:** allow structural list counts 1–10. Keep blocking quantities, money, %, results and years. The check must handle number words (three / teen / तीन), Devanagari digits ०–९, lakh/crore/k/L/x and ordinals.

### 1.5 16 KB body limit rejects valid Hindi input
5,000 Devanagari characters ≈ 15 KB in UTF-8, or ≈ 30 KB if JSON-escaped. The shared engine (Roaster) uses **32 KB**.
**Fix:** 32 KB, same as the engine. Count length limits the same way (UTF-16 units or graphemes) in Zod, the DB `check` and the UI counter.

## 2. Gaps between the Hook PRD and the shared engine

1. **`EntitlementResolver` only covers consumption in the engine.** Hook also needs `limits(user, product)` for the swipe limit (50/500/2,000), the unlock set and the rate-limit tier. Add it to the resolver, never to routes.
2. **`grant_pack` and `grant_subscription_period` grant counters only in the engine.** Hook packs and plans also grant **unlocks** (`reels`, `hindi`, `all_languages`, `voice_profiles`, `collections`). Pack unlocks are permanent rows. Plan unlocks are tied to `period_end`.
3. **`/v1/me` must also return** `unlocks` and `swipeLimit` (added in SHARED-ENGINE §4).
4. **Rate limit depends on plan** (Studio Monthly gets 60/hour), but the `rateLimit` middleware runs before the route. It needs a cached entitlement lookup, or the limit check moves into the use case.
5. **The middleware order differs.** Hook B2 puts "schema → auth" and the engine puts "auth → … → route schema". Use the engine order (auth first), so S-01 always returns 401, not 400.
6. **Rate-limit storage isn't specified in either spec.** Pick one: DB counters (one Supabase call per request) or the Workers rate-limit binding (approximate, per location). Recommendation: the binding for bursts, DB counters for daily quotas.
7. **Turnstile:** in Hook's stack and S-10, but every Hook AI route needs login. Use it on login or the free generate, or drop S-10 for Hook.
8. **`ai_budget.tier`** must include `priority` (the engine only says free/paid).
9. **New error classes:** `LockedFeatureError` (403) and `ContentBlockedError` (no credit used) must slot into the engine's `AppError` hierarchy and the single error mapper.

## 3. Logic gaps (Hook PRD)

1. **Cancel, then change your mind:** the subscription is still "non-ended", so re-subscribing returns `SUBSCRIPTION_EXISTS`. Add "undo cancel".
2. **Downgrade, then upgrade in the same cycle:** undefined. Rule: any change clears `pending_plan_id`, and the difference is computed from the current `plan_id`.
3. **Upgrade while `past_due`:** undefined. Block it with `BILLING_PAST_DUE`.
4. **`reels_script` is a `Platform`**, but Reels has its own route, and E4 tests "5 platforms". Take it out of the `/generate` enum.
5. **`all_languages` vs `hindi`:** say outright that `all_languages` includes `hindi`.
6. **Swipe limit after a pack is used up:** is a spent ₹99 pack still a "valid source" (500 forever)? Decide.
7. **Batch mode "locked for non-subscribers" isn't enforceable.** The server sees 3 normal generates, so a free user can do the same thing by hand. That's fine, but treat it as UI convenience, not a paywall.
8. **Batch partial failure:** if 1 of 3 fails, release only that credit and show a retry.

## 4. Security / privacy

1. **Rewrite-post stores personal data.** C1 says "topics contain no personal data by design", but full posts carry names, employers and stories. They're kept 30 days and sent to free providers that may train on them. **Fix:** don't store rewrite-post output, add a "don't paste private info" note and mention it in the DPDP notice.
2. **Supabase free projects pause when inactive.** Add a health-ping cron and a checklist item.
3. **Account deletion:** say what happens to `subscriptions`, `webhook_events` and `audit_log` (unlink `user_id`, keep for tax).
4. **Voice Profile fields** can identify people. Show the same "don't paste private info" note there.

## 5. Product / quality

1. **Feed cut-offs are line-based,** not character-based (LinkedIn/Instagram ≈ 2–3 mobile lines, and line breaks count). Model `maxLines` + chars per line + `\n`, counted with `Intl.Segmenter`.
2. **E4 "beat the input score by 15 points":** the input is a topic, not a hook. Compare against a fixed set of hand-written baseline hooks instead.
3. **The Hinglish and Hindi scorers need their own word lists,** or good hooks will score low.

## 6. Decisions needed from you

| # | Decision | Recommendation |
| --- | --- | --- |
| D1 | Where the one shared engine lives (§1.2) | Build it once; both products use the same Supabase/Worker |
| D2 | Pack vs plan pricing (§1.3) | Fix before launch |
| D3 | Number List rule (§1.4) | Allow list counts 1–10 |
| D4 | Body limit (§1.5) | 32 KB, same as the engine |
| D5 | Rewrite-post storage (§4.1) | Don't store |
| D6 | Turnstile on Hook (§2.7) | Use it on the free generate only |
| D7 | v1 scope (§1.1) | Full PRD = ~16–18 days. Packs-only v1 ≈ 11–12 days |
