## 2026-06-28 · feat(marketing): add /alaala — the living-memory doorway

Website master-plan Phase 1 (Website_Master_Plan_2026-06-28 §6). New public landing page at `/alaala` — the productized doorway for the Alaala / Living Memories pillar (the fuller manifesto stays at `/our-story`, deep-linked).

- `apps/web/app/alaala/page.tsx` — force-static Server Component cloned from the `/panood` doorway scaffold: static metadata, `SoftwareApplication` + `FAQPage` JSON-LD, line-reveal hero, and the **"five pieces, one living memory"** grid. Per owner (2026-06-28), **Alaala = the combination of the five Pa- services**: Papic, Panood, Pawebsite, Pa3D, PaLogo — each numbered 01–05, linking to its own live doorway (`/papic`, `/panood`, `/pawebsite`, `/pa3d`, `/palogo`). Then an "all of it, in one home" band, the paper→digital→living evolution rows, FAQ, and a Mulberry-accent CTA → `/onboarding/wedding?from=alaala`.
- Reuses the existing `AlaalaOrb` as the signature visual (cold-starts as a warm gradient sphere; no clips required).
- Registered `/alaala` in `NAV_ROUTES` (`site-chrome.tsx`) so the shared marketing nav renders, and added it to the footer services column (`_SiteFooter.tsx` `FEATURE_LINKS`) so the page has inbound links (no orphan).
- Event-agnostic "remember" copy (previews the all-events lead; weddings stay deepest). Sells feeling only — no model names, no prices (links `/pricing`) — and honors the "essence of the day is never ruined / presence over production" guardrail.

SPEC IMPACT: None in code terms; the direction is recorded in `03_Strategy/Website_Master_Plan_2026-06-28.md` (§6) + DECISION_LOG 2026-06-28. New marketing route only; no schema, no pricing.
