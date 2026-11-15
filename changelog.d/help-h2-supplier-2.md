## 2026-11-14 · feat(help): H2 — 39 supplier answers for Clients, inquiries, quotes, bookings, getting paid, files, portfolio, QR, reviews and the team

Fills `apps/web/lib/help/supplier-2.ts` (areas S10–S21 of the help coverage map) with 39 public Help answers in 8 topics. Each answer names its source in code in the comment above it. No size, day count, price, seat count or plan limit is typed; the house words hold (supplier · Clients · payment).

Left out on purpose — each sits behind a switch whose production value cannot be read from a session: the client's own pages (`NEXT_PUBLIC_RELATIONSHIP_WORKSPACE_ENABLED`), the ask-then-agree booking (`NEXT_PUBLIC_LOCK_HANDSHAKE_ENABLED`), Deal cards and meetings (`NEXT_PUBLIC_CHAT_NEGOTIATION_V1`), the Auto-Reply Assistant (`NEXT_PUBLIC_VENDOR_AUTOREPLY_V1`), the chat contact filter, and per-plan lines under `VENDOR_TIER_FEATURE_GATE`. Manpower gigs are left out (no way in from the app).

SPEC IMPACT: None.
