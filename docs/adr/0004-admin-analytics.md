# ADR-0004: Owner-only analytics dashboard

**Status:** accepted (2026-10-05). Requested by the owner; not in the PRD.

- Separate Astro app `apps/admin`, deployed as its own Cloudflare Pages project. Never linked from the public site; `noindex`, not in any sitemap.
- API `GET /v1/admin/metrics` is mounted only for user ids in the `ADMIN_USER_IDS` Worker secret. Anyone else (logged in or not) gets the same generic 404 as an unknown route.
- Recommended extra lock (free): Cloudflare Access in front of the admin Pages project.
- Shows aggregates only: sales, revenue, refunds, MRR, subscriptions by status/plan, signups, daily active users, generations, AI calls by provider, conversion. Recent payments show amount/item/status and a short hashed user ref, never emails, topics or hook text.
- Activity is recorded as one row per user per day (`app.activity_daily`), upserted on `GET /v1/me`.
