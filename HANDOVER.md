# HANDOVER — rd/no-gallery-word (copy PR: no "gallery" in the UI)

Written 2026-10-23 by the local builder when the controller moved this build to a cloud session
(the Mac's heavy lane was a ~1 h queue). Branch base: `015289abfa` (origin/main at the time).

## Goal + owner ruling (verbatim, 2026-10-23)

> "check the rest of the words in the app. remove gallery and use memories"

Asked how to split the concepts, he chose:
- **this event's photos/videos = "Memories"** (e.g. Home's Papic row "1,284 in your gallery · latest
  first" → "1,284 in your Memories · latest first"; See all, Papic pages, guest/public event pages,
  post-event, help answers, ⓘ texts, spotlight tours, /features + feature pages, emails/notifications
  text, empty states, aria-labels, alt text);
- **a supplier's own photos = "Portfolio"**;
- **the Mood Board library = "Inspiration"**.
No user-visible "gallery"/"Gallery"/"galleries" may remain in the app UI.

Controller brief (copied, since the cloud has no access to ~/Documents/Claude/Projects):
- SCOPE: user-visible strings only (JSX text, rendered string literals, metadata, aria/alt,
  help/tour/feature copy, notification + email copy, public marketing incl. blog under lib). Do NOT
  rename code identifiers, file names, routes, DB columns, CSS classes, analytics names. Routes that
  contain "gallery" stay; list them in the report. Generated files are regenerated, never hand-edited.
- Grammar: "Memories" is plural ("your Memories are…", "in your Memories"); keep sentences short; house
  rule = visible copy is title + one short line, details in ⓘ — don't add words. Say "event", never
  "celebration".
- COORDINATION: `rd/event-bar-memories` (adds the event bar's Memories tab, restructures
  Home/Papic/gallery components; it will merge this PR after it lands) and `rd/iap-five-more-products`
  (lib/iap + studio routes). Keep the diff to string changes.
- GUARDS: tests asserting the old phrasing are updated (guard a property, not a phrasing); ONE new
  narrow guard + a sabotage run. Run every CI guard from `apps/web` (`pnpm lint` does NOT run them;
  `pnpm preflight` reads `.github/workflows/ci.yml` and runs them), tsc, unit tests.
- PR: DRAFT, base main, then `gh pr edit <N> --add-label do-not-auto-merge` and
  `gh pr merge <N> --disable-auto`; verify `gh pr view <N> --json autoMergeRequest` is null. NEVER mark
  ready / merge / deploy. Body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`;
  commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- CI: GitHub Actions is capped at 20 concurrent jobs and congested — push only when a round of fixes is
  complete (ONE push per CI round); run guards/tests locally first.

## Done (3 commits on this branch)

1. **Copy** — ~330 user-visible strings across 150 files under `apps/web/app`, `apps/web/lib`,
   `apps/web/scripts/seed-demo-vendors.ts`. Rough split: Memories ≈ 280 · Portfolio 9 · Inspiration 9 ·
   other ≈ 35 (see "Calls made" below). Found with a TypeScript-AST scan of every string literal /
   JSX text / template part matching `\bgaller(y|ies)\b`, not a line grep.
2. **Guard** — `apps/web/lib/no-gallery-word.test.ts`: parses every non-test .ts/.tsx under app/,
   components/, lib/ (minus `lib/ugat/`), fails on any copy containing the word. Tokens are not copy
   (no whitespace AND all-lowercase or code punctuation: `'gallery'`, `'/tour/gallery'`,
   `'#site-gallery'`, `'TYPE-GALLERY'`); a lone capitalised `'Gallery'` IS copy. `console.*` args skipped.
   One INTERNAL exemption (`lib/moodboard-gallery-screen.server.ts` timeout reason), self-checking.
   **Sabotage done:** re-inserted `label: 'Gallery'` in `app/[slug]/_components/hub/hub-shell.tsx` and
   "the gallery fills up" in `app/papic/pool/_components/pool-grid.tsx` → test 2 went RED naming both
   lines; restored → 3/3 green.
3. **Tests updated** to the new words (and naming-lock tests now also assert never "Gallery"):
   each-tab-is-its-own-page, site-menu, site-nav, each-stage-does-one-job,
   every-stages-tab-has-its-own-page, our-services, the-post-event-bar,
   the-post-event-toolbar-is-the-prototypes, event-type-website-surface-guard,
   the-post-event-panel-wears-the-templates, papic-page-says-only-what-is-true,
   papic-reads-are-honest, couple-dashboard-reads-are-honest, event-hub-pro, the-pro-list-names-only-real-gates,
   hub-pro-offer-renders. `lib/every-stage-is-todays-page.golden.json` regenerated with `UPDATE_GOLDEN=1`
   (6 guest cases −3 bytes: "profile picture in the gallery." → "profile picture in Memories.").
4. **Changelog fragment** `changelog.d/no-gallery-word.md` (SPEC IMPACT names the DECISION_LOG row).
5. **Corpus** — DECISION_LOG row "23 Oct: no 'gallery' in the UI — Memories / Portfolio / Inspiration"
   appended and PUSHED to `github.com/iscasasola/Setnayan-specs` main as commit `d74d2ac`.
6. **Unit suite** (full `pnpm test:unit` on commit 1): 27423 tests, 21 failures → all fixed in commit 3
   except `lib/avatar-initials-read.test.ts` #3 (`app/dev/memories-lab/page.tsx` gold-500 chip) —
   NOT this branch's file; it fails on origin/main too (pre-existing, from #6824's guard).
7. **Screenshots** (375 px, light, lab no-database env) — saved LOCALLY on the Mac at
   `~/Documents/Claude/Projects/shots-2026-10-23/no-gallery-word/` (cloud cannot see them):
   papic-marketing, pawebsite-faq, features-why, help-find-photos, home-lab-before-day (guest bar tab
   "Gallery" → "Memories" fits), post-event-open-up ("OPEN MEMORIES · 5 PHOTOS") — each `-before/-after`.

## Left, in order

1. `cd apps/web` is where unit tests and guards run. Run the preflight from the repo root:
   `pnpm preflight` (reads ci.yml; runs every cheap CI guard, eslint on changed files, tsc on changed
   files + importers, the touching unit tests, whole-tree guards). It was NOT run locally (queue).
   Also: `cd apps/web && node scripts/check-ugat-screens.mjs` (screens.generated.json holds only ids —
   expected unchanged) and `npx tsx --test lib/no-gallery-word.test.ts`.
2. Fix anything red, then ONE push, then open the DRAFT PR (see brief above), label
   `do-not-auto-merge`, `--disable-auto`, verify autoMergeRequest null. Watch CI with one loop
   (sleep 120 between `gh pr checks`).
3. Report (≤12 lines): PR + SHA, counts per concept, routes left with "gallery", unsure calls, guard +
   sabotage, checks, screenshot paths.

## Routes left containing "gallery" (paths unchanged, display changed)
`/dashboard/[eventId]/galleries` (page title now "Memories"), `/tour/gallery`,
`/dashboard/[eventId]/studio/papic/gallery-zip`, `?gallery=open` (papic), `?open=gallery` (editor),
anchors `#site-gallery`, `#gallery-media`, `#gallery-zip`.

## Calls made without an owner word (flag them in the PR + report)
- Photographer's delivered external link (handover kind `gallery_link`, chat files, admin disputes,
  vendor clients page, on-the-day) → **"Album link"** / "Share an album link" / "online album"; package
  inclusions "online gallery" → "online album"; blog deliverables → "online album".
- Phone camera roll (payment QR "scan from gallery", pay panel, blog receipts) → **"your photos"**.
- Event Hub Pro item `'Photo gallery'` (WEBSITE_PRO_ITEMS, HUB_PRO_GATES, event-hub-pro lead/pitch) →
  **"Photos you add"** — the name the `our_photos` widget already carries (the-four-photo-names.test.ts);
  the prototype's DRAWN list in the-pro-list-names-only-real-gates.test.ts was updated to match.
- Couple-uploaded "our photos" screens: "Save gallery" → "Save photos", "this gallery" → "these photos".
- Mood-board slot pick ("No supplier gallery for that slot") → "supplier Inspiration"; stylist library
  ("Add to gallery", "gallery allowance", "Couples' inspiration gallery") → Inspiration.
- Supplier shop "Gallery & media" → "Portfolio & media"; supplier captures → "your Portfolio"; blog
  "their gallery" (photographer's work) → Portfolio / "full weddings".
- Art-gallery sense in theme copy: "Modern gallery walls" → "Modern museum walls", "a gallery that
  breathes" → "a room that breathes", font note "Slim, gallery modern" → "Slim, museum modern",
  generated theme name "Gallery Vow" → "Atelier Vow".
- Legal pages (/privacy, /acceptable-use) got the gallery→Memories edits only. The acceptable-use
  "celebration" line was LEFT: `the-app-says-event-in-plain-words.test.ts` allow-lists that folder as
  "legal text — changes go through the owner".

## Not touched (report as follow-ups)
- `lib/ugat/**` (admin engineering map: notes name schema objects like `supplier_gallery`) — allow-listed.
- DB-seeded copy needs a migration, out of scope for a string PR: e.g.
  `vendor_service_recommendations` reason "Feeds their own DSLR into the gallery", privacy-control
  title 'Papic Shared Pool Gallery' seeded in `20270919527984_seed_guest_content_privacy_controls.sql`
  (code copy in lib/data-privacy-controls.ts IS changed), old SKU names in phase_a.
- ⚠ NAME COLLISION to surface: `/dashboard/[eventId]/alaala` (Photo Notes) and the account library
  (`/dashboard/library`) are ALSO titled "Memories"; the `/galleries` page now titled "Memories" has a
  door row named "Memories" (→ /alaala). rd/event-bar-memories is restructuring this area.

## Learned (traps)
- `origin/main` in a shared clone moves when peers fetch: `git diff origin/main HEAD` then includes
  THEIR files. Use the merge-base (`git merge-base HEAD origin/main`). A `git checkout <rev> -- <list>`
  restore aborts entirely if one path is missing — restore with `git reset --hard HEAD` (all work was
  committed first).
- zsh does not word-split `$FILES`; use `xargs -0` under bash.
- Test globs with `[slug]`/`[eventId]` need `[[]slug]` escaping when passed to `tsx --test`.
