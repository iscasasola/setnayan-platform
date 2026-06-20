## 2026-06-20 · feat(tour): public sample-wedding tour — foundation + access boundary (Phase 2, PR1)

The safety substrate for the public "walk through a real wedding" tour (Maria & Jose sample event). The access boundary IS the feature here — reviewed hardest.

- **`app/tour/_lib/sample-event.ts`** — THE single trust boundary. The tour reads prod via the service-role admin client (RLS-bypassed), so this resolver is all that stands between an anonymous visitor and real data. It accepts **NO client id**; resolves the one sample event by `is_sample=TRUE` (+ known slug + `event_type` belts), `cache()`'d, and `notFound()`s on any miss/mismatch. A real event (`is_sample=FALSE`) is structurally unreachable; every future fetcher re-pins `event_id`.
- **`app/tour/layout.tsx`** — chrome + a persistent "this is a sample wedding, nothing is saved" ribbon + a "start your own free" link.
- **`app/tour/page.tsx`** — public intro + 5-stop index. Stop 1 (Save-the-Date) deep-links to the already-public `/maria-and-jose`; stops 2–5 marked "soon" (no dead links).
- **`.eslintrc.json`** — write-suppression guardrail: `no-restricted-imports` scoped to `app/tour/**` forbids server actions (`**/actions`, `**/_actions/**`, `**/*-actions`, `@/lib/chat-actions`, `@/lib/guest-live-gallery`), so a tour component that accidentally wires a write fails CI. The tour is RSC-read + local-React-state only.

Next stops (own PRs): seating, budget, gallery, AI match + scripted chat, entry CTAs.

SPEC IMPACT: None (new public read-only surface; no SKU / schema / pricing / branding change).
