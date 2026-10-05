# ADR-0002: Stack

**Status:** accepted (2026-10-05)

Astro + React islands + Tailwind on Cloudflare Pages; Hono API on a Cloudflare Worker; Supabase Auth (Google only) + Postgres; Razorpay; free AI pool (Groq, Gemini, Workers AI, OpenRouter). TypeScript 6 (typescript-eslint does not support 7 yet), Vitest 4.

Worker integration tests run the Hono app in Node (`app.request`) with Web Crypto, not `@cloudflare/vitest-pool-workers` (it pins an older wrangler + alpha miniflare). SQL is tested in-process with PGlite (no Docker on the dev machine); pgTAP files are kept for `supabase test db` in CI.
