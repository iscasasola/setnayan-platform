## /for-coordinators — the For Coordinators page, ported from the 4 Nov prototype

**⛔ Draft, `do-not-auto-merge`. Stacked on #7263 — merge after it.** Waiting for the owner to OK the screenshots.

Binding prototype: `prototypes/for_coordinators_2026-11-04.html` (Setnayan-specs), with the owner's photos from `prototypes/marketing_photos_2026-11-04/`.

### ✅ Owner answers, 2026-11-04 — all four applied

1. **Shop address reserved by migration** — `20271308786674_for_coordinators_is_our_page_not_a_shops.sql` adds `for-coordinators` to `business_slug_is_reserved`. Its body is the last replacement's (`20271302376604`) word for word plus the one word, and the diff shows exactly that. The temporary `KNOWN_DB_MINT_GAP` entry is removed, so the set is empty again and `vendor-business-slug-mint.db.test.ts` is byte-identical to before this PR. The word is also in `DB_MIRRORED_RESERVED_SLUGS`, the same as `for-suppliers`. Without the migration that test fails naming `for-coordinators`; with it, 15/15. ⚠ If another migration replaces the function before this merges, re-diff first. **Title tag:** this PR now carries a migration.
2. **Every copy correction accepted** — they are listed in "Differences" below.
3. **The four switch-dependent lines show only while their switch is ON**, read live on every request through the features' own gates (`_claims.server.ts`):
   - each supplier sees only their rows: `isDataPrivacyControlActive('coordinator_run_of_show')`. Hides the kit item, the free-line item and problem 02.
   - announcements: `isCoordinatorP3Enabled()` (`coordinator_day_of_broadcast`). Hides problem 09.
   - prepare-then-release: `isCoordinatorPrepReleaseEnabled()`. Hides problem 11.
   - private notes: `isCoordinatorVendorNotesEnabled()` (`NEXT_PUBLIC_COORDINATOR_VENDOR_NOTES_ENABLED`). Drops that one sentence from problem 12.

   An unreadable switch reads OFF, so the page says less rather than promising something that is switched off. The headings count what is shown: "Nine tools" / "Twelve problems" with every switch on, down to "Eight tools" / "Nine problems" with all four off.
4. **Real links instead of demo buttons accepted** — and per the board, no demo/sample buttons anywhere.

**And the board's 5 Nov "TRUE-CLAIMS CHECK": the day-of desk is "Free" only while the app says so.** `lib/vendor-specialization-gate.ts` still keeps the coordinator's floor-command kit (cue the show · requests inbox · seat scanner) behind the Solo plan while `NEXT_PUBLIC_VENDOR_DAYOF_FREE_UNTIL` is unset — against the owner's 4 Nov "keep it free"; that fix is pending his OK. The page asks the gate's own `specializationFreeWindowActive` (a fifth switch, `dayOfFree`). While it says no:
- the day-of desk leaves the free kit and the free line;
- cue-the-show and the requests inbox are tagged `TIER_LABEL[SPECIALIZATION_MIN_TIER]` + " plan and up" (today "Solo plan and up"; never typed);
- the seat-scanner sentence drops;
- the hero says "Your shop and your dashboard cost you nothing." instead of naming the day's tools;
- the "Not free, said plainly" line names the day-of desk and its plan.

When the gate fix lands, all of it reads "Free" again with no edit to this page. A test pins each piece, and each was sabotage-checked red.

The footer "For coordinators" link stays. This PR owns the shared hero and problem-scene pieces (`PhotoHeroSlides`, `ProblemScenes`, `photo-page.css`) for the front page and For Suppliers to reuse.

### Screenshots: 390 and 1280, light and dark

Local dev server, dummy env (every database read fails the normal way; this page reads nothing). Reduced motion on, so every section is shown at rest.

The table below is the page with **every switch ON** (commit `998bf4c0`; since then only the order of problem 12's sentences changed). The same 24 views with **every switch OFF** are in `build-sessions/assets/for-coordinators-2026-11-04/switches-off/`: "Seven tools", "Nine problems", 9 scenes, cue-the-show and the inbox tagged "Solo plan and up", 0 px sideways scroll, no page errors. That is what the dummy env renders, because it can read no switch. For the day-of desk it is also what production shows today.

⚠ **Dark is forced for the review.** A signed-out visitor always sees Light, and `/for-coordinators` is not on `DARK_READY` (`lib/appearance.ts`). So production shows only the light page. The dark shots show what it will look like once the public pages join the dark rollout; the page is built from tokens, so it needs no change then.

| | 390 light | 390 dark | 1280 light | 1280 dark |
|---|---|---|---|---|
| **Hero** | ![390 light top](https://raw.githubusercontent.com/iscasasola/setnayan-platform/998bf4c069d492c7af95ae983299033140fd824c/build-sessions/assets/for-coordinators-2026-11-04/390-light-top.jpg) | ![390 dark top](https://raw.githubusercontent.com/iscasasola/setnayan-platform/998bf4c069d492c7af95ae983299033140fd824c/build-sessions/assets/for-coordinators-2026-11-04/390-dark-top.jpg) | ![1280 light top](https://raw.githubusercontent.com/iscasasola/setnayan-platform/998bf4c069d492c7af95ae983299033140fd824c/build-sessions/assets/for-coordinators-2026-11-04/1280-light-top.jpg) | ![1280 dark top](https://raw.githubusercontent.com/iscasasola/setnayan-platform/998bf4c069d492c7af95ae983299033140fd824c/build-sessions/assets/for-coordinators-2026-11-04/1280-dark-top.jpg) |
| **Free kit** | ![390 light free](https://raw.githubusercontent.com/iscasasola/setnayan-platform/998bf4c069d492c7af95ae983299033140fd824c/build-sessions/assets/for-coordinators-2026-11-04/390-light-free.jpg) | ![390 dark free](https://raw.githubusercontent.com/iscasasola/setnayan-platform/998bf4c069d492c7af95ae983299033140fd824c/build-sessions/assets/for-coordinators-2026-11-04/390-dark-free.jpg) | ![1280 light free](https://raw.githubusercontent.com/iscasasola/setnayan-platform/998bf4c069d492c7af95ae983299033140fd824c/build-sessions/assets/for-coordinators-2026-11-04/1280-light-free.jpg) | ![1280 dark free](https://raw.githubusercontent.com/iscasasola/setnayan-platform/998bf4c069d492c7af95ae983299033140fd824c/build-sessions/assets/for-coordinators-2026-11-04/1280-dark-free.jpg) |
| **Problems** | ![390 light solves](https://raw.githubusercontent.com/iscasasola/setnayan-platform/998bf4c069d492c7af95ae983299033140fd824c/build-sessions/assets/for-coordinators-2026-11-04/390-light-solves.jpg) | ![390 dark solves](https://raw.githubusercontent.com/iscasasola/setnayan-platform/998bf4c069d492c7af95ae983299033140fd824c/build-sessions/assets/for-coordinators-2026-11-04/390-dark-solves.jpg) | ![1280 light solves](https://raw.githubusercontent.com/iscasasola/setnayan-platform/998bf4c069d492c7af95ae983299033140fd824c/build-sessions/assets/for-coordinators-2026-11-04/1280-light-solves.jpg) | ![1280 dark solves](https://raw.githubusercontent.com/iscasasola/setnayan-platform/998bf4c069d492c7af95ae983299033140fd824c/build-sessions/assets/for-coordinators-2026-11-04/1280-dark-solves.jpg) |
| **With the couple** | ![390 light how](https://raw.githubusercontent.com/iscasasola/setnayan-platform/998bf4c069d492c7af95ae983299033140fd824c/build-sessions/assets/for-coordinators-2026-11-04/390-light-how.jpg) | ![390 dark how](https://raw.githubusercontent.com/iscasasola/setnayan-platform/998bf4c069d492c7af95ae983299033140fd824c/build-sessions/assets/for-coordinators-2026-11-04/390-dark-how.jpg) | ![1280 light how](https://raw.githubusercontent.com/iscasasola/setnayan-platform/998bf4c069d492c7af95ae983299033140fd824c/build-sessions/assets/for-coordinators-2026-11-04/1280-light-how.jpg) | ![1280 dark how](https://raw.githubusercontent.com/iscasasola/setnayan-platform/998bf4c069d492c7af95ae983299033140fd824c/build-sessions/assets/for-coordinators-2026-11-04/1280-dark-how.jpg) |
| **One login** | ![390 light many](https://raw.githubusercontent.com/iscasasola/setnayan-platform/998bf4c069d492c7af95ae983299033140fd824c/build-sessions/assets/for-coordinators-2026-11-04/390-light-many.jpg) | ![390 dark many](https://raw.githubusercontent.com/iscasasola/setnayan-platform/998bf4c069d492c7af95ae983299033140fd824c/build-sessions/assets/for-coordinators-2026-11-04/390-dark-many.jpg) | ![1280 light many](https://raw.githubusercontent.com/iscasasola/setnayan-platform/998bf4c069d492c7af95ae983299033140fd824c/build-sessions/assets/for-coordinators-2026-11-04/1280-light-many.jpg) | ![1280 dark many](https://raw.githubusercontent.com/iscasasola/setnayan-platform/998bf4c069d492c7af95ae983299033140fd824c/build-sessions/assets/for-coordinators-2026-11-04/1280-dark-many.jpg) |
| **Whole page** | [390 light ↗](https://raw.githubusercontent.com/iscasasola/setnayan-platform/998bf4c069d492c7af95ae983299033140fd824c/build-sessions/assets/for-coordinators-2026-11-04/390-light-full.jpg) | [390 dark ↗](https://raw.githubusercontent.com/iscasasola/setnayan-platform/998bf4c069d492c7af95ae983299033140fd824c/build-sessions/assets/for-coordinators-2026-11-04/390-dark-full.jpg) | [1280 light ↗](https://raw.githubusercontent.com/iscasasola/setnayan-platform/998bf4c069d492c7af95ae983299033140fd824c/build-sessions/assets/for-coordinators-2026-11-04/1280-light-full.jpg) | [1280 dark ↗](https://raw.githubusercontent.com/iscasasola/setnayan-platform/998bf4c069d492c7af95ae983299033140fd824c/build-sessions/assets/for-coordinators-2026-11-04/1280-dark-full.jpg) |

All 24 files: `build-sessions/assets/for-coordinators-2026-11-04/` (`<width>-<theme>-<top|free|solves|how|many|full>.jpg`; the `full` shots have all twelve problems opened).

Measured on each of the four: 0 px sideways scroll · 1 `<main>` · 1 `<h1>` · 12 scenes · no broken images · no page errors. At 1280 the hero photo is drawn 1320 × 742: its full height, anchored right.

### What was built, by section

**Route.** `app/(shell)/for-coordinators/page.tsx`, in the shared shell. The group layout owns the bar, the rail and `force-dynamic`. A null `loading.tsx`, like every shelled page. Full-bleed via `DOORWAY_BLEED_PATHS`, so the photo hero reaches the edges.

**Shared with the other two 4 Nov pages** (new, in `app/_components/marketing/`):
- `photo-hero.tsx` · `PhotoHeroSlides`: the photo layer. Photos cross-fade every 5 s with a 2.5% push-in and a slight scroll drift. Phone: `object-fit: cover`. ≥1024 px: the hero is `min(100svh − 56px, max(600px, 58vw))` tall, and the photo shows its full height, anchored right and pushed right by its own `--dr`.
- `problem-scenes.tsx` · `ProblemScenes`: "N problems … And what Setnayan does instead". It shows 4, then "See all N ›" / "Show the top 4". The photo settles out of a zoom and the pain line rises as each scene scrolls in.
- `photo-page.css`: the white page, section heads, kicker, hero, scenes and close.
- Motion reuses the existing `_pa-motion.tsx` (`LineRevealHeading`, `RevealBand`, `RevealList`) rather than a second copy of the prototype's scripts.

The For Suppliers sections on `main` are the older editorial design (serif + mono) and match none of these patterns. The front-page and For Suppliers 4 Nov ports had no open PR when I started. **Whichever of the three lands first should own these files, and the other two should use them**, so the pattern is never written twice.

**1 · Hero.** Photos `coord-hero` (`--dr` 25%), `problem-09-entourage` (14%) and `supplier-team-hero` (19%). Then the eyebrow, the h1 "Run every event from one place — free.", the lede and the free line. Two buttons: "Open your coordinator shop — free" → `/open-shop`, and "How it works with the couple" → `#how`. The truths line ends in the house `<InfoTip>` ("Your own clients never carry a fee" ⓘ), with the fee explanation as drawn.

**1b · The free kit.** "Free for every coordinator". Nine tools, each tagged FREE, with the prototype's icons.

**2 · Problems.** Twelve scenes with the prototype's photos, captions and order, plus the "Not free, said plainly" line (Papic, Live Photo Wall). No price.

**3 · How it works with the couple.** Four steps, each with a drawing of the couple's real screen, in the real strings: "Promote your coordinator", "Invite as delegate", "Ask the hosts", "… is asking for access", "Never Edit — View at most.", "You can take any of this back later…". The "+7 days" and "7 days after the event day" read `DELEGATE_GRACE_DAYS`; they are not typed.

**4 · One login, every event.** Photo `coord-multi-events`, then Events you run · Your team · Your own shop page.

**5 · Close.** "Set na ’yan. Every event, one desk.", one button and the fine print.

**Calls to action.** A coordinator is a supplier (`planner_coordinator`), so both go to `/open-shop`, the one supplier door. `/open-shop` takes no category from the link, so the coordinator category is picked in its wizard like every other.

**Prices.** None shown, none typed. The day-of tools are tagged plain "Free", with no end date (DECISION_LOG 2026-11-04 "DAY-OF DESKS STAY FREE — NO END DATE").

**Photos.** 16 files in `apps/web/public/marketing/2026-11-04/`, under their prototype names. The other two builders use the same folder.

### Differences from the prototype, and why

| Prototype | Page | Why |
|---|---|---|
| "Ten tools …", including **Voice and video calls** ("Call the couple from your chat with them") | **Nine tools**; calls removed from the kit and the free line | In-app calls left the chat on 28 Oct (owner: "remove both voice and video call"); nothing calls `startThreadCall`. Before that they were paid-only (`VENDOR_CALLS_PAID_ONLY`, ruled 2 Oct). The 4 Nov rows give phone and Viber hand-offs for booked suppliers, which are not "free in-app calls". |
| 04 "Calls and invites across five apps" · "Free voice and video calls inside your chat…" | "Invites across five apps" · "Invitations go to Messenger, Viber or WhatsApp in one tap, straight from the couple's guest list." | Same reason. |
| 06 "only you move the show forward … If there is no coordinator, the couple does it." | "only you and the couple move the show forward, part by part. The emcee and the other suppliers cannot." | `decideMayAdvance` lets the couple advance at any time. |
| 11 "Prepare items in private and release them … guests and suppliers do not see them." | "Prepare schedule items in private and release them to the couple when they are ready. Until then, nobody else sees them." | `setBlockPrepVisibility` works on schedule blocks; "Release to couple". |
| 12 "You lock a supplier or handle payments only if the couple allowed it when they invited you." | "… only where the couple allowed it." | The invite-time choices exist only while the consent switch is on. Either way the couple's grant is what allows it. |
| One login: "Recommend an add-on" | Removed | `studio/recommend-actions.ts`: "NO SCREEN POSTS THESE SINCE 2026-10-02". |
| 09 "every guest's **event page**" | "every guest's **Event Hub**" | House word for the page a guest opens. |
| 12 "still needs a **deposit**" · "booked supplier and **deposit**" · step 1 "mark your **downpayment**" | "still needs a **first payment**" · "booked supplier and **payment**" · "mark your **first payment**" | House word: payment, "first payment" where the order matters (owner d22, `the-money-word-is-payment.test.ts`). |
| 12 "You **lock** a supplier" | "You **book** a supplier" | House word: a couple reads "book", never "lock" (owner d19, `the-couple-books-never-locks.test.ts`). |
| "See … ›" → `/sample/coordinator#…` | 01 → `#how` · 02 → `/schedule` · 03 → `/seat-plan` · 04 → `/guest-list` · 08 → `/schedule` · the rest: tag only | No coordinator demo exists. |
| Prototype note "where each 'free' comes from" | Not on the page | A note for the reviewer, not for the reader; the sources are in the page docblock and the guard. |
| Its own topbar, rail, tabs and footer | The shared shell's | The shell draws them once; a page copy would be a second header. |
| Rail small print "For coordinators" | Added to the shell's small print, beside "For suppliers" | As drawn. It is the page's only way in until the front page links it. It shows on every shelled page, `/` included. |
| Screen drawings on literal `#fff`; white words on the light dark-mode fills | On `--surface`; the page colour on filled chips, dots and "Share" | In the prototype's dark view the drawings stayed white under light text. |
| 11.5 px, ink/50 fine print in the drawings | 12 px, ink/60 | The repo's small-print floor. |
| `@container vp` / `cqw` | `@media` at the same widths (701 · 1024 · 1440) and `vw` | Those queries sized the preview frames. The problem list keeps its own-width container query, which measures the list, not the frame. |
| Headings rise word by word (hand-rolled script) | The existing line reveal (`LineRevealHeading`) | Reuse, not a second motion system. Hero copy does not animate in, so the LCP heading paints at once. |
| Scroll progress bar in the topbar | Not built | The topbar belongs to the shell. |

### Registered
- metadata (title, description, canonical, OG and Twitter), plus JSON-LD `WebPage` + `BreadcrumbList`
- `sitemap-static.xml` · `robots.ts`
- `DOORWAY_BLEED_PATHS` · `TOP_LEVEL_SEGMENTS` (`lib/telemetry/fault-normalize.ts`)
- the generated half of `lib/reserved-slugs.ts` (`node scripts/gen-reserved-slugs.mjs`)
- `lib/ugat/screens.generated.json` (`pnpm ugat:screens`) and `scripts/port-control-baseline.json` (`pnpm port:baseline`)
- the sideways-scroll e2e list
- the shell's small print
- `lib/page-home.ts`: no entry needed. Its home is its URL parent `/`, the same as `/for-suppliers`.

### Guard
`app/(shell)/for-coordinators/for-coordinators-says-what-ships.test.ts` checks:
- every tool the page names, pinned to its symbol: `autoInviteCoordinator`, `COORDINATOR_AREAS`, `DELEGATE_GRACE_DAYS = 7`, `filterBlocksForAudience`, `CheckinDesk`, `advanceScheduleBlock`, `RequestsInbox`, `SeatScanner`, `isVendorDayOfStillFree`, `autoArrange`, `send-invite.tsx`'s three apps, `FREE_HELPER_SEATS = 1`, `eventsYouRun`, `fetchLatestBroadcasts`, `setBlockPrepVisibility`, `vendor-working-notes`;
- the corrected claims stay out: calls, "Recommend an add-on", `/sample/coordinator`, a typed ₱, an end date on "free", "celebration";
- every link opens a real page or anchor, and every photo is in `public/`;
- the page wears the shell, is full-bleed, and is in the sitemap and robots.

**Sabotage, each RED then restored:** rename `FREE_HELPER_SEATS` · write "Free voice and video calls" into the page · link `/sample/coordinator` · type "₱990" · drop the route from `DOORWAY_BLEED_PATHS`.

### Where I stopped (for whoever continues — read `CLOUD_BOARD.md` in Setnayan-specs first)

**Done.** The page is built and registered. The owner's four answers of 2026-11-04 are all applied (above): the migration, the copy, the four live switches with one test per line, and the real links. The board's true-claims fix for the day-of desk is applied too. Screenshots exist for every switch on and every switch off. The whole preflight was clean on `00881fa0`; a re-run on the switch work is recorded below. Everything is pushed.

**Next, exact steps:**
1. ✅ Done 2026-11-04 19:46 UTC: #7272 merged, so `origin/main` was merged into this branch (merge commit `b9384c36`). The generated Ugat and port baselines were regenerated, not hand-merged. No newer replacement of `business_slug_is_reserved` arrived, and `20271308786674` is still the newest prefix.
2. When #7263 merges, GitHub retargets this PR to `main`. Merge `origin/main` again if it moved, and regenerate `apps/web/lib/ugat/screens.generated.json` + `apps/web/scripts/port-control-baseline.json` on any conflict (`pnpm -C apps/web ugat:screens`, `pnpm -C apps/web port:baseline`).
3. If another migration replaced `business_slug_is_reserved` meanwhile, re-copy its body into `20271308786674` (plus `for-coordinators`) — `grep -l "FUNCTION public.business_slug_is_reserved" supabase/migrations/*.sql | sort | tail -1`.
4. If main moved again: re-run `pnpm preflight --base origin/main` whole, paste its table here, push. Then copy this file into the PR body (the GitHub connector was down at the end of the session that wrote it), and add `[migration · do not auto-merge]` to the PR title.

**Waiting on the owner:** his OK on the screenshots, and the separate gate fix that makes the day-of desk free as he ruled. This page follows that fix by itself. Nothing else. Owner check, optional, prod read: `select count(*) from vendor_profiles where lower(business_slug)='for-coordinators';` should be 0 before the migration applies.

### `pnpm preflight --base origin/main` (whole run, after merging `main`)

Five whole runs. The first found five faults (the service worker's route list, a count without `formatCount`, three house words); all were fixed in `00881fa0`, and every run since has been clean:
- against #7263's branch: `00881fa0`, `f9c3e4b5` (the owner's answers) and `7a854dfe` (the day-of fix);
- against `origin/main`: this one, after main was merged in (#7272). Because main is now in the branch, this run covers #7263's changes plus this PR's.

A migration changed, so it also ran the schema pins, the migration-replay tests and the DB tests (Ugat claims and coverage among them).

**preflight** · `claude/hopeful-archimedes-gvv2vr` @ `b9384c362` · base `origin/main` · 112 changed · wall 38m 50s · cheap faults clear

| check | result | time | first failing line | re-run |
|---|---|--:|---|---|
| 44 cheap CI guards (every `node …mjs` step of ci.yml) | PASS | 1m 52s | | |
| eslint on changed files (37) | PASS | 3.7s |  | `(cd apps/web && npx next lint --file 'app/(shell)/for-coordinators/_claims.server.ts' --file 'app/(shell)/for-coordinators/_claims.ts' --file 'app/(shell)/for-coordinators/for-coordinators-says-what-ships.test.ts' …)` |
| tsc (38 changed + 40 of 127 importers) | PASS | 1m 30s |  | `(cd apps/web && pnpm typecheck)   # the full compile, under the heavy lock — or let CI run it` |
| tests that name or import a changed file — 189 files, 1,723 tests | PASS | 2m 21s |  |  |
| whole-tree guard tests — 592 files, 4,193 tests | PASS | 19m 59s |  |  |
| unit tests that replay the migrations — 6 files, 50 tests | PASS | 28.8s |  |  |
| DB tests: source scanners + schema pins — 51 files, 389 tests | PASS | 13m 14s |  |  |

Left to CI (not run locally): full typecheck — preflight compiled 78 file(s); 87 importer(s) of the changed files were not compiled · full eslint — preflight linted 37 changed file(s) · full unit suite — preflight ran 787 of 3641 test files (a test more than two imports away from a changed file is not woken) · full DB replay — preflight ran 51 of 492 DB tests · production build · Vercel route count · shared bundle size · the Maker's first-load JS budget · lighthouse · playwright e2e · secret scan (gitleaks is not installed on this machine) · native encoder tests (src-tauri untouched)

A green preflight is not a green CI. The commits after `b9384c36` touch only this file.

One migration, the shop-address reservation, applied only by the pipeline after merge. Nothing touched production. Dummy env only.
SPEC IMPACT: none to the corpus. This ports `prototypes/for_coordinators_2026-11-04.html`; the copy differences above are listed for the owner to accept or overrule.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EvosmUZKJqhwGrrZrRBFYy
