# ADR-0001: Hook Score runs in the browser; AI only for generation

**Status:** accepted (2026-10-05)

Hook Score, tips, feed preview and share cards run in the browser (`packages/browser`). They are deterministic, free and unlimited, and cost ₹0. The server is used only for AI generation, payments, the swipe file and account data. Client scores are never used for server decisions.
