## 2026-08-12 · fix(led): five things the backdrop removal missed — found by adversarially auditing my own change

PR #4356 removed the LED wall backdrop. An adversarial verification pass over that
removal (5 independent lenses, every candidate finding then attacked by a skeptic told to
refute it) produced **27 candidates → 9 confirmed → 5 distinct defects**. Three were
caused by the removal; two were older and **verified live on setnayan.com**.

### 1 · A couple saw a lowercase button reading "led" that went nowhere · HIGH

`app/dashboard/[eventId]/alaala/page.tsx` listed a chip per feature and resolved its
label as `chip.label ?? entry?.label ?? chip.key`. Dropping the LED add-on from the
catalog did not error — it **fell through to the raw slug**, so on the memories page,
between "Pakanta" and "Playlist", sat a lowercase button reading `led` linking to a 404.
On the one screen whose whole job is to feel finished.

🔑 **Same silent-absence family as the phantom column / enum / RPC argument** — the
lookup misses and the only symptom is wrong-looking output, never an error.

Fixed, plus a **module-level throw** (fails `next build`) and `lib/alaala-chip-keys.test.ts`,
which reads the page source and fails if any chip key is not in `ADD_ONS`.

### 2 · The removal silently switched off an existing CI guard · MEDIUM, self-inflicted

`lint-entitlement-gates.mjs` guard 2 checks that three mirrors of "what this bundle
includes" agree. Its token extractor matched quoted `UPPER_SNAKE` anywhere in the array
literal — **including comments**. PR #4356 replaced the `'LIVE_BACKGROUND',` entry with a
comment that quoted the name, so the guard counted the comment as membership and printed
a tick while **two genuine drifts sat behind it** (`onboarding-pricing.ts` and the SQL
seed still listed it).

🔑 **A guard switched off by the very change it exists to inspect is worse than no guard,
because it prints a tick.**

Fixed at the parser (comments stripped before tokenizing — so the *next* removal comment
cannot re-blind it), the comment reworded, and the real drift resolved: removed from
`onboarding-pricing.ts`, and migration `20271133692067` re-seeds `bundle_components` so
mirror 3 states the truth. **Complete is now 15, honestly, not 16 by accident.**

Then the *seed parser* turned out to have the same disease twice over, both hit by that
one new migration: its header comment **quotes the needle string** it searches for, and an
ordinary **semicolon inside prose** ("…removed on 2026-08-11; it…") terminated the
statement early — 8 of 22 tuples parsed, reported as "did the seed shape change?". SQL
comments are now stripped before locating anything.

### 3 · The public "How it works" page still sold it — in both languages · HIGH

`/how-it-works` and `/tl/how-it-works` listed `Add-ons (LED, photo delivery, …)`.
**Verified live on www.setnayan.com**, and older than this removal. The `/features` page
was cleaned in both languages; its sibling — the page that answers "what do I actually
get?" — was not.

### 4 · The privacy notice named an artifact we do not make · HIGH

`/privacy` — a legal document, verified live — told people Setnayan may feature "an
animated monogram, save-the-date, event website, personal reel, or **LED design**". The
matching caption *"The LED wall at …'s celebration — designed on Setnayan, glowing all
night"* was still drafted and still wired to the posting queue, so the claim could have
reached the public feed. `led_design` removed from the consent type, the label, the
caption and the allowed list. **0 rows of that type in prod, checked before narrowing** —
the DB CHECK is deliberately left permissive rather than run a live-data migration.

### 5 · The demo-capture tool would abort mid-run · MEDIUM

`capture-demo-videos.mjs` kept a **hand-typed mirror** of `RICH_DEMO_SLUGS` still
containing `led` (8th of 14). An unknown slug never sets `data-reel-ready`, so the run
blocks 30s and the unguarded loop kills the process — **the six slugs after it silently
never re-recorded, with the first seven already overwritten**. Now derived from the real
list, with a refuse-to-run check if it parses zero.

### 🪤 Two traps worth recording

**A sabotage run proves nothing unless the baseline was green.** Testing the Alaala guard
by importing the page gave `✅ GUARD FIRED` — but the baseline threw the *same*
`Cannot find module 'next/link'`. A false green. The test was rewritten to read source.

**And the migration I wrote to fix guard-blindness named a column that does not exist**
(`bundle_service_code`; it is `bundle_sku_code`). It failed the PGlite replay, which
surfaced as 9 unrelated-looking Papic test failures. I first reported those as
pre-existing; stashing proved they were mine. **Clean main passed 9/9 — the check that
turned an assumption into a fact.**

### Checks

`tsc` clean · **7624/7624** unit · all 22 lint scripts · migration-timestamp guard.
Both new mechanisms and the repaired guard were **sabotaged on purpose and confirmed to
fire** — including the exact comment-masking bug that shipped — with each sabotage
verified as applied first, and green again on restore.

SPEC IMPACT: None — no product decision changes. The LED wall backdrop removal
(`DECISION_LOG.md` 2026-08-11) is unchanged; this completes it.
