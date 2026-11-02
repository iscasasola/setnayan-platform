## 2026-08-21 · change(ui): a lone circle explains nothing — the (i) goes, and 61 sentences with it

**Owner, hours after the header row came off, pointing at what was left on Your year:** a single
circled (i) floating above the content, on its own line, with nothing beside it.

**Rung four of one complaint.** 07-21 deleted the eyebrow · 08-18 deleted the lede paragraph, then
78 of the 132 ledes · 08-21 morning deleted the back arrow and the page title · this deletes the
(i). The (i) only ever worked because it sat **beside a title that gave it a subject**. With the
title gone it is a stray dot: it does not tell anyone there is help behind it, and it was costing
a row on **58 pages**.

`PageMasthead` now renders **the actions and nothing else** (plus the `sr-only` h1). The `lede`
prop is deleted, and with it **61 sentences across 58 files**; 40 more dead `className`s went too.

**NOTHING WAS DELETED ON A HUNCH — all 61 were judged against the page, by 13 agents in two
passes.** Eight readers opened each page and asked one question: can a person use this page
without the sentence? Then a skeptic pass attacked every SURVIVES verdict, told to hunt for the
place the page already says it. **Six survived the first pass. Zero survived the second**, each
refuted with a quotation from the page itself — the discount form's own `required` helper text
already teaches the effective-until rule; the code field in edit mode already says codes cannot be
renamed; the data-privacy buttons already read *"Approve · activate"*; the social-queue sentence
was not merely redundant but **stale**, still naming only Facebook on a strip that now ships
Instagram and TikTok chips.

🚪 **TWO DOORS OUTLIVED THE SENTENCES THAT HAPPENED TO CONTAIN THEM.** The admin Real Stories and
Storytellers surfaces kept their only link to the public page — both lived inside the (i) text —
promoted to `actions`, where a doorway belongs.
🔑 **And the route-level control guard could not have caught the second one.** `/admin/studio`
still reached `/realstories` through a SIBLING surface, so the guard passed while the Storytellers
surface itself lost `#storytellers`. Found by diffing every `href` that lived inside a deleted
sentence against the file it came from. **A guard scoped to the route is blind to a loss inside
one of its surfaces.**

Result: `lint-port-no-lost-controls` passes **with no baseline regeneration at all** — 61 sentences
deleted, **zero destinations and zero actions lost**.

🛡 The guard is inverted again in the same file that asserted the opposite this morning: there is
now no `lede`, no `<details>`, no `Info`, and no `<p>`. Both new assertions mutation-checked with
the occurrence count printed before → after (lede/details/Info 2→3 RED; early return 1→0 RED).

Verified: typecheck clean · **9172 unit tests pass** · eslint clean · masthead, port-controls,
contrast, legibility, bottom-nav, nav-icon and radius lints green. **Not seen on a screen** — every
page is behind a login and the production build cannot run on this machine.

SPEC IMPACT: `DECISION_LOG.md` row 2026-08-21 (rung four; the (i) escape hatch from 2026-08-18 is
retired).
