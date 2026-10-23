# HANDOVER — Post Event story speed (branch `rd/post-event-reads-together`)

## Goal
Make the Post Event guest page fast. It is the page guests open after the day, and the page the Maker's
preview shows for any event whose date has passed.

## The owner's words (this session, 2026-10-23)
- "Build cut 1 first: find and cut what makes the Post Event guest page take ~3.8 s on the server. Draft PR, measure before and after on production."
- Earlier in the same session: "measure and shorten … Draft PR, measure before and after"; "Mark #… ready, merge when every check passes, deploy, then measure the Maker on production on a phone and walk it." (that applied to #6850 / #6853, both done)
- Standing: ask before shipping (draft PRs; auto-merge workflow skips drafts).

## What's done
**Measured on production (before):** `/tala-migo?phase=editorial&editor=1&tabs=1` (signed in as the couple)
3.69–3.88 s; RSVP 0.52–0.77 s, Save the Date 0.71–0.76 s, The Day 0.74–1.32 s. Signed out, tala-migo ~2.3 s on
every phase (a finished event shows the story). The page's own Vercel log line `[server-timing] slug/invitation-body:editorial`
said only 0.13–0.36 s — the rest is the story component, which reads while it renders, outside that timer.

**Cause (found):** `EditorialContent` (`app/[slug]/_components/editorial/editorial-content.tsx`) →
`loadEditorialData` (`…/editorial/data.ts`) → `loadStorySpineFacts` (`…/story/spine-data.ts`): **57 database reads, 51
one after another.**

**Built (commit `258f21ae1a`, pushed, NO PR yet):**
- `data.ts`: 18 reads that need only the event id (story row, 3 guest counts, suppliers, consent veto, photo/clip
  counts, gallery photos, wall mirror, supplier media, orders, recommendations, challenge answers, messages, guest
  columns, Live Watch SKU, films) are started at the top (`ahead`), each query **moved by script, not rewritten**, and
  awaited at its original line inside its original try/catch.
- `editorial-content.tsx`: words + role names + story start together; past the one gate, the 8 optional reads
  (monogram, watermark, back cover, previous edition, spine facts, story pages, entourage, your own day) start
  together, awaited where they were. Adds a `ServerTimer('slug/editorial-content[:host]')` log line (marks `story`, `past-the-gate`).
- `spine-data.ts`: 10 reads that need only the event + its day window start together (`ahead`), dial bucket from the same pure `dialBucketMinutes(window.days)`.
- New harness `…/editorial/editorial-reads.harness.ts` (host / guest / stranger views) and guard
  `…/editorial/the-story-reads-start-together.test.ts` (depth ≤ 11; a stranger starts no past-the-gate read).
- Changelog fragment `changelog.d/rd-post-event-reads-together.md`.

**Harness result (150 ms/trip):** 51 → **10** deep, 7.7 s → **1.5 s**, the SAME 57 reads (multiset compared, host and guest).

## What's left, in order
1. **Run the new guard** — it has NOT run green yet. From `apps/web`:
   `../../node_modules/.bin/tsx --test 'app/\[slug\]/_components/editorial/the-story-reads-start-together.test.ts'`
   (escape the brackets or it matches nothing; check `# pass` lines, not the exit code). Fix the test's `WEB` path if it errors.
2. **Typecheck**: `pnpm typecheck` from `apps/web`, through `~/Documents/Claude/Projects/heavy-lock.sh acquire/release` (one command). Confirm real tsc output (an OOM run looks like a pass).
3. **Sabotage check**: make `loadEditorialData` await one hoisted read before starting the rest → the guard's test 1 must fail; restore.
4. Run the editorial/story/[slug] tests + every `apps/web/scripts/*.mjs` CI guard from `apps/web`.
5. Open a **draft** PR, changelog fragment already in.
6. On the owner's go: merge on green, deploy (`gh workflow run deploy-prod.yml --ref main`, wait for `/api/health` version), then **measure after on production**: same URLs as above (3 runs each, signed in in the browser pane as testnayan1 — couple of tala-migo), and read the new `slug/editorial-content` log lines with Vercel `get_runtime_logs` (query `server-timing`).

## How to check it
- Harness: `STORY_READS_DELAY_MS=150 tsx 'app/[slug]/_components/editorial/editorial-reads.harness.ts'` from `apps/web` → host/guest depth ~10, calls 57.
- Production: time `https://www.setnayan.com/tala-migo?phase=editorial&editor=1&tabs=1` signed in (before 3.7–3.9 s), signed out `/tala-migo` (before ~2.3 s).
- Privacy: a viewer the story's gate refuses must start no past-the-gate read (guard test 2).

## Open PRs from this session
- None open. #6850 (Maker tools arrive behind it) and #6853 (editor reads together) are **merged and deployed**
  (#6853 measured: no production change — the preview starts when the Maker document ends; noted in memory
  `the-maker-preview-starts-when-the-document-ends.md`).

## Still proposed, not started (from the investigation)
- Cut 2: load only the stage the tab will show (an extra hidden Post Event frame loads when the tab remembers a different stage).
- Cut 3: the Maker preview waits for the editor (~3.0 s; editor ~1.1 s of its own render).
