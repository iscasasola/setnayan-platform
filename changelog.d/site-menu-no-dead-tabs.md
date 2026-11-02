# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-08-03 · fix(guest-site): the browse menu offered two tabs that led nowhere

The first build item of the event-website work (owner, 2026-08-03: *"can we build the event website first?"*). A defect, not a redesign — and one that would have shipped to almost every new couple the moment open browse launched.

**What was wrong.** `Details` and `Story` anchor inside `normalBody()` in `site-body.tsx`, and `phasedBody` does not call it in every phase. The anonymous tree forced both tabs on regardless:

```ts
details: plan.openBrowse || plan.publicSafeWidgets.length > 0,
story:   plan.openBrowse || Boolean(event.love_story),
```

In the `save_the_date` phase `phasedBody` renders `<SaveTheDateView>` **instead of** the body, so those anchors were never emitted — two tabs rendered and tapping them did nothing. That breaks the rule the file states in its own comment three lines above: *"Present-flags gate each middle tab so it never anchors to a section that did not render (the council's no-dead-anchors rule)."* Open browse was the branch that broke it.

**Why it mattered more than it looks.** The phase is `save_the_date` whenever the event is more than `STD_THRESHOLD_DAYS` (90) out — i.e. **nearly every newly-created wedding**. So flipping the open-browse default would have handed the broken menu to almost every new couple, healing only as their date approached. It is also invisible to inspection: the single open-browse event in prod is 131 days out, so walking it shows the full-screen film, no menu at all, and reads as "never built".

**The fix.** A pure `browsableBodyRenders(plan)` in `_lib/site-menu.ts`, asked by both trees before either tab is offered. It encodes the two phases that actually reach `normalBody()` — `normal` always, `editorial` only under open browse (the archive keeps the site below the cover essay) — and `save_the_date` never. The guest tree had the same latent defect (its `Details`/`Story` anchors are sr-only spans in the same body) and gets the same guard.

**Verified by mutation, not assertion.** Reintroducing the bug — `save_the_date` returning `plan.openBrowse` instead of `false` — fails 2 of the 4 new tests. Watched failing before being trusted. 6,307/6,307 unit tests, `tsc --noEmit` clean.

No migration, no flag, no route change, no visual change in any phase that was already correct.

SPEC IMPACT: None — restores the no-dead-anchors rule the open-browse branch broke. The two-menu question (this five-tab browse menu vs the seven-panel day-of hub) is recorded in `DECISION_LOG.md` 2026-08-03 and is not addressed here.
