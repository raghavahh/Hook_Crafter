# ADR-0003: Decisions for gaps in the PRD

**Status:** accepted (2026-10-05). Owner said "build fully, no need to ask"; these follow SPEC-REVIEW.md recommendations while keeping the PRD as the authority.

| # | Gap | Decision |
| --- | --- | --- |
| D1 | Where the shared engine lives | Built in this repo (one engine, one Supabase, one Worker). Roaster can reuse it later |
| D2 | Pack vs plan pricing | PRD prices kept as-is in `catalog.data.ts` (they are config, change anytime). Risk recorded in SPEC-REVIEW |
| D3 | Number List vs honest hooks | PRD rule kept strictly: numbers must come from the input or be `[X]`-style placeholders |
| D4 | Body limit | 32 KB (PRD said 16 KB, but 5,000 Devanagari chars is ~15 KB raw, more when escaped). S-16 still returns 413 for 5 MB |
| D5 | Rewrite-post retention | Rewrite-post output is NOT stored (full posts carry personal data). Generate + Reels outputs are stored 30 days |
| D6 | Turnstile | Required only when a request falls back to the free daily quota |
| D7 | Scope | Full PRD (packs + monthly plans + Reels + Hindi + Voice Profiles + Collections + Batch) |
| D8 | Reels credit | Reels consumes 1 `generate` credit (PRD names no counter) |
| D9 | `reels_script` platform | Not accepted by `/v1/hooks/generate`; Reels uses its own route |
| D10 | Length unit | Code points everywhere (Zod, Postgres `char_length`, UI counters) |
| D11 | Swipe limit for pack buyers | Any non-refunded pack purchase keeps the 500 limit permanently |
| D12 | Plan changes | Any change clears `pending_plan_id`; upgrade difference from the current plan; upgrades blocked while `past_due`. Cancel cannot be undone (Razorpay has no API for it); the user can subscribe again after the period ends |
| D13 | Rate limits | Per-user hourly counters in Postgres (`check_and_increment_quota`), limit from the user's plan |
| D14 | Batch mode | UI convenience only (3 normal generates); not a security control |
