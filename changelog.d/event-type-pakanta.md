## 2026-06-24 · feat(event-type): frame the Pakanta song brief by event type — iteration 0053 Phase 4 (Unit 7, final)

Pakanta is SKU-gated (`eventSkuActive('PAKANTA')`), not type-gated, so any event can own it — but the brief composer that feeds the music team / Suno was hardcoded to "the couple". This frames the brief prose by the event-type profile's `organizerNoun` (`'couple'` for a wedding, `'host'` for a generic event). **Weddings byte-identical** (new regression test + 2-lens adversarial verify: ship).

- **`lib/pakanta-brief.ts`** (pure composer) — new optional `organizerNoun?: string`; `const organizer = clean(input.organizerNoun) || 'couple'`. The 6 prose sites interpolate it (names fallback, "from the {organizer}'s onboarding", "Music type the {organizer} asked for", "({organizer} left music blank)", "{ORGANIZER}'S EXTRA WISH", "the {organizer} has not completed"). The curly apostrophe (U+2019) at "couple's"/"COUPLE'S" is preserved.
- **`studio/pakanta/page.tsx`** (couple/host-facing) — `resolveProfileByEvent(eventId)` → passes `organizerNoun`.
- **`admin/pakanta/page.tsx`** (music-team brief view) — `event_type` added to both event selects + the `EventLite` type + the map literal; `resolveProfile(ev.event_type ?? 'wedding')` (reads only the public-read profile table, no event-ownership RLS dependency). Its `coupleNames` fallback changed `?? 'The couple'` → `?? ''` so the composer applies its organizer-aware default (byte-identical for weddings).
- **`lib/pakanta-brief.test.ts`** (new) — locks the wedding prose character-for-character (curly U+2019 included), proves `organizerNoun` omitted `===` `'couple'`, and checks the `'host'` reframe. Closes the only regression gap the adversarial review flagged.

The intake form was already generic ("Favourite singer (partner 1/2)"); only the brief prose needed reframing. No migration. RSC-safe (`organizerNoun` is a string).

**Verify:** `pnpm typecheck` clean · `pnpm lint` clean · **pakanta-brief 5/5** · full unit **401/401** · 2-lens adversarial review (wedding byte-identity · non-wedding correctness + RSC) → **ship**.

SPEC IMPACT: Iteration 0053 Phase 4 Unit 7 — the **final** unit; the Event-Type Engine's V1 surface coverage is complete. Logged in `DECISION_LOG.md`. [[project_setnayan_event_type_engine]]
