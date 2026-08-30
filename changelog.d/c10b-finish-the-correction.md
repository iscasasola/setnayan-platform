## 2026-08-30 · docs(c10b): finish the correction C10 started and left 90% undone

Session C10b. Docs-only, no code. PR #5015 ("c10-docs-stop-being-wrong") merged 2026-08-29
scoped to eleven claims (`build-sessions/C10.md`) but its diff touched only `STATUS.md` and
its own changelog fragment — delivering one of eleven, and missing the highest-traffic site:
`CLAUDE.md` line 51, tracked in this repo and auto-loaded into every Claude Code session here,
which still read `0 packages · 0 ORDERS EVER` a full day after six orders (four paid and
receipted) existed in prod.

Every one of the eleven items was re-measured against `origin/main` and the corpus, not
against any prior document, before editing.

- **Corpus side was already complete before this session started.** Commit `86a2a92` in
  `Setnayan-specs` (pushed to `origin/main` there before this repo-side gap was found) covers
  all eleven corpus sites plus a twelfth found on its own re-verification pass, with a matching
  `DECISION_LOG.md` row. This session added one addendum row to that corpus `DECISION_LOG.md`
  (commit `a5d78ec`) recording the repo-side gap and pointing at this PR — no other corpus edits
  were needed.
- **`CLAUDE.md` line 51** — the missed claim. Corrected to the strike-through-plus-note form
  `STATUS.md` already used for the same fact, so the two auto-loaded/refreshed docs finally
  agree: `0 packages` · ~~`0 ORDERS EVER`~~ ⚠ CORRECTED 2026-08-30, 6 orders as of 2026-08-29.
- **`WHAT_IS_LEFT.md`** — three more stale "0 orders" sites found and corrected: the "Armed to
  go wrong the first time a real customer arrives" section's opening premise, one item's
  evidence line inside that section, the livestreaming item's evidence line, and the closing
  note of the readiness audit. The Live-Photo-Wall-on-the-website item (a *different* claim —
  the static editorial recap section, not the live venue wall) was RE-VERIFIED, not edited:
  `grep -rn photo_wall_photos apps/web` still shows zero writers, so that claim stands as
  written and was left alone.
- **`DECISION_LOG.md`** — one row added recording the C10/C10b split and pointing to the
  corpus addendum.
- **Item 11, the rule itself, added.** `CLAUDE.md` RULE 0 gained item 7: an anchor is a string,
  never a number. Its own "FALSE BELIEF ABOUT MIGRATION PREFIXES" section was caught mid-fix
  citing line numbers (`:184`/`:203`) that had already rotted to `:201`/`:220` — live proof of
  the exact failure mode the new rule names — and was rewritten to point at a grep command
  instead.
- **Items 2/3/4/6/7/8/9/10 — re-checked, not currently asserted false anywhere in this repo's
  tracked docs.** Each was either never asserted here, already fixed by an earlier PR whose own
  changelog fragment records it (`changelog.d/eight-small-fixes-0817.md` for item 3), or — item
  9, `captured_by_person_id`/camera-holder visibility — confirmed still shipped by grepping the
  live migrations (`20271170468759`, `20271171474426`) and `crew/page.tsx`'s `holderName`
  render.
- **Deliberately left untouched, named rather than silent:** `CHANGELOG.md:9844` and the
  `changelog.d/*.md` fragments that mention "0 orders, ever" or "R2 (PH region)" as fact-at-the-
  time — those are generated/frozen historical records, not live claims, and rewriting them
  would falsify history. `BUILD_SESSIONS.md` and `build-sessions/C10.md`/`C10b.md` quote the old
  wording as the defect being described, not as a current claim — also left alone.

SPEC IMPACT: None beyond the corpus `DECISION_LOG.md` addendum already committed directly to
the corpus repo per the 2026-06-04 standing Cowork authorization (not part of this PR).
