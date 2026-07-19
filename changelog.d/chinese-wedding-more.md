## 2026-06-28 · feat(weddings): Chinese deferred builds — day-of tea card · STD red/gold · lauriat budget · schedule beat · predicate hygiene · vendor outreach

The remaining held-back Chinese (Tsinoy) features, each sized to the cheapest meaningful
win. No migration; byte-identical for non-Chinese events; all gating via the shared
`isChineseWedding` / `isMuslimWedding` / `ceremonyMatches` predicates (both ceremony columns).

- **Day-of guest tea-ceremony card** — a static "Tea ceremony (敬茶)" card on the public
  `/[slug]` guest page (reuses the canonical tradition copy), gated on `isChineseWedding`.
  **Privacy-safe: static tradition copy only — no guest roster, no serving-order names**
  (those stay in the auth-gated dashboard tool). Widened the guest-page events select to
  include `secondary_ceremony_type` so the overlay case fires. Rendered once per guest path.
- **Save-the-Date red/gold** — for a Chinese event with no explicit accent + no palette
  accent, the STD accent defaults to auspicious red (#7A1F2B); a "Suggested for your Chinese
  ceremony" note + two red/gold plain-background presets. Pure suggestion/fallback — never
  writes the DB, the couple's choice always wins. Builder + published page match.
- **Lauriat budget estimate** — the existing Chinese budget card now shows an estimated
  lauriat **table count** (≈10 guests/table) from the event's guest count. No ₱ figure
  (prices stay admin-managed); table count is a model fact, not a price.
- **Schedule tea-ceremony beat** — `lib/schedule.ts` gains a `chinese` ceremony spine + an
  overlay-aware tea-beat injection (a Catholic+Chinese-secondary event keeps its Catholic
  spine and gets a tea beat added, no double-add). Also fixes the `SeedCeremonyType` drift
  (was missing `chinese`). ⚠ **Note: the schedule seed is currently dead code (no live
  caller — schedules are manual-entry today), so this is correct + ready but inert until a
  seed/suggestion path is wired.** The visible guest-facing tea beat is the day-of card above.
- **Faith-predicate hygiene** — new `isMuslimWedding` + generic `ceremonyMatches(event, faith)`
  in `lib/chinese-wedding.ts`; replaced inline `=== 'muslim'` two-column checks on the budget
  page + the dashboard `isNikahEvent`. `sponsors/page.tsx` deliberately left alone (its
  redirect is muslim-PRIMARY-only semantics, not the overlay-inclusive predicate).
- **Vendor outreach** — `/explore` now shows a "Know a great {Category}? Invite them — or list
  your own business here" CTA on an empty category drill-in, routing to a category-scoped
  vendor signup (`/signup?as=vendor&next=…prefill_service=<leaf>`, same-site-sanitized).
  Gated on a thin category (faith-agnostic — helps every empty category), so the Chinese
  specialist leaves fill with real vendors instead of the synthetic demos (which couples
  already don't see). Demo vendors left in place (owner cleanup decision).

Verification: `tsc --noEmit` clean; 20 unit tests pass (chinese-wedding 14 + schedule 6);
adversarial review — **no blockers, no PII leak**; one duplicate-render found and fixed.

SPEC IMPACT: None new — completes deferred Chinese surfacing. **Skipped (flagged):** the 囍
double-happiness *monogram artwork* (needs the vector/monogram pipeline) and **plan-group
Chinese hints** (that surface — `CEREMONY_HINTS`/`PlanningGroups` — was retired in an earlier
commit; no live surface to wire, so not resurrected). Known nits: the 2 red/gold STD swatches
are visible to all events (additive, tasteful); the schedule seed is inert pending a live caller.
