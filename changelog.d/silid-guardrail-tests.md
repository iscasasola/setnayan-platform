## 2026-07-19 · test(silid): doorway guardrail tests for the services surface + add-ons catalog

New `apps/web/lib/silid-doorway-guardrails.test.ts` — the 7 doorway guardrails from the
2026-07-18 audit (Whats_Next_Suite_AI_Pricing §2), written against the SHIPPED Silid
surface (`/dashboard/[eventId]/silid`, flag `NEXT_PUBLIC_SILID`, constant `SILID_NAME`);
the Suite-vs-Silid rename stays owner-pending and nothing is renamed.

Statically covered (5 of 7, 13 assertions, pure imports + an app-router disk resolver
that mirrors Next matching — literal shadows dynamic, `(group)` transparent, catch-all):

1. **routes-helper** — every `FREE_TOOLS` href in `silid/page.tsx` is built from a
   `routes.*` builder (source scan), and every builder the page references resolves to
   a real app-router page.
2. **retired-prefix** — no add-on href (`addOnHref`/`appStoreDetailHref`) or silid
   source string starts with `/design` or `/vendors/compare`.
3. **addOnHref resolves** — both helpers resolve to a real page for every catalog key,
   including the seating `NEXT_PUBLIC_SEATING_3D=false` kill-switch branch; every
   non-opensDirect live entry has an `add-ons-detail.ts` entry so `/studio/about/<key>`
   can't 404.
4. **free ≠ paid surface** — the paid Custom-QR buy wall never enters the Silid free
   layer; `freeTrial` never coexists with `tier:'free'`; the free-layer key set is a
   reviewed snapshot (any change is a conscious diff).
5. **free ≠ paid SKU** — every live/web_v1 entry's doorway opens a working page. The
   two audit-known gaps are pinned in a `KNOWN_GAPS` allowlist with reality-checking
   assertions (tests stay green, gaps stay visible): **photo-delivery** (page real,
   Drive backend stubbed `TODO(0009)` — owner coming_soon decision pending) and
   **music-creator** (no browse surface of its own; routes to Pakanta — Pricing open
   question #7).

Skipped as runtime-only (need a running server): auth-guard-is-the-only-redirect and
the localhost dual-stack + warm-compile smoke. No product code touched.

SPEC IMPACT: Whats_Next_Suite_AI_Pricing §2 guardrail tests landed (against shipped Silid naming; Suite rename still owner-pending).
