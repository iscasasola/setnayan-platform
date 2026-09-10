## 2026-09-11 · feat(story): an A4 one-page-per-minute booklet, and the print keepsake goes quiet at a wake

The print keepsake (`/[slug]/print`) gains a second format alongside the A3
broadsheet: `?format=a4` renders a booklet with one page per written minute of
the story timeline (`buildA4Pages`/`defaultA4PageResolver` in
`keepsake-layout.ts`), ending on the same locked close + QR colophon the A3
sheet uses. A toolbar link switches between the two.

**Taken-back inheritance confirmed, not extended.** S14's withdrawal mechanism
(`lib/a-withdrawal-reaches-every-copy.ts`, PR #5371, already shipped) lists
`/${slug}/print` as a ROUTE, not an A3-specific surface, and `page.tsx` gates
`data` once (`storyAudienceAdmits` + `redactStoryLayers`) before branching on
`format`. The A4 booklet reads the SAME gated `data` object — it needed zero
changes to `a-withdrawal-reaches-every-copy.ts`'s destination list.
`a4-inherits-the-withdrawal.test.ts` source-pins that the format branch sits
after both gates and that both sheets are wired to the identical `data`
binding, with a sabotage-and-revert pass proving the pin actually fires.

**Solemn-quiet print suppression (new — judgment call, flagged for owner
review).** Both stylesheets now suppress festive CHROME — the champagne-gold
/ mulberry accent colour, not content — when `words.solemn` is true (the same
signal `event-words.ts` / `the-wake-never-celebrates.test.ts` already use
on-screen): `.keepsake-root.k-solemn` overrides both the derived
`--k-accent`/`--k-mulberry` tokens and the raw `--color-terracotta`/
`--color-mulberry` channels a couple of rules read directly. Every headline,
photo, quote and credit still prints unchanged. Pinned by
`the-keepsake-stays-quiet-at-a-wake.test.ts`.

**Extension seam, not the feature itself.** `A4PageResolver`
(`keepsake-layout.ts`) is a documented interface a future
"hand-arrange one sheet for several minutes" step plugs into; only the default
one-minute-per-page resolver ships today. `a4-pagination.test.ts` pins the
pagination invariant (every minute exactly one page, in order) with a
sabotage-and-revert pass for both failure modes (merge, split).

SPEC IMPACT: yes — `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md` gets
a row recording (a) the solemn-quiet interpretation as a flagged judgment call
needing owner sign-off, and (b) that S14/taken-back was found already shipped
under PR #5371 during this session, so a future session does not rebuild it a
third time. `Design_Editorial_By_The_Minute_2026-09-07/` gets the A4 format
noted against the by-the-minute design it implements.
