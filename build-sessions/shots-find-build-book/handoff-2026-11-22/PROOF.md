# #7920 · BUILD_RULES §4 proof · hand-off 22 Nov 2026

Head before this hand-off: `bd3c1c512` (origin/main `e72c4f313a` merged in, unchanged since).

## 1 · Shots (375 light · 375 dark · 1280)

All from the dev labs on fixtures (`next dev`, dummy Supabase URL — never prod), with
`NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED=true` (the one-screen Find that card 14 lives in).
Re-shoot with `shoot.mjs` / `book.mjs` beside this file; the drawing half with `draw.mjs`.

| Screen | Build | Drawing (v15 "Proposed", `drawing/`) |
|---|---|---|
| Find | `find-375-light/dark`, `find-1280`, card 14 close-ups `find-cards-*` | `drawing/find-390-*`, `find-1280` |
| Build | `build-375-light/dark`, `build-1280` | `drawing/build-*` |
| Book | `book-375-light/dark`, `book-1280` (lab's chapters sheet dismissed) | `drawing/book-*` |
| When | `when-375-light/dark`, `when-1280` | `drawing/when-*` |
| Where | `where-375-light/dark`, `where-1280` | `drawing/where-*` |
| Guests | `guests-375-light/dark`, `guests-1280` | `drawing/guests-*` |

**Dark:** neither `/dashboard/[eventId]/vendors` nor `/onboarding` is on `DARK_READY`, so the app's own
dark scheme paints these six screens light. The `*-375-dark` shots are the browser in dark mode, i.e. what a
user sees — not forced dark.

## 2 · The three rules named in the hand-off command

| Rule | State | Where |
|---|---|---|
| One service card everywhere — card 14 "Mall card", two across (4 on desktop) | ✅ on Find's rail and "to compare" (main `d3cffa7a2`, merged in). ⚠ not on the category search overlay's rows (gap 3) | `find-cards-*` |
| Distance reads "about N km from your venue" | ✅ on card 14; ✅ **new here** on the category search overlay (`bd3c1c512`), which printed a bare "12.3 km" | `lib/mall-card.ts` `aboutKmLine` · guard `lib/find-search-distance-reads-card-14.test.ts` |
| Saved suppliers first, only if in area and free on the date | ✅ on the rail and in the category search ranking (`lib/saved-first.ts`) | `find-cards-375-light`: the saved, in-reach, free SetnaProd booth leads; the saved booth with no calendar and the saved out-of-reach booth keep normal order |

## 3 · Parity gaps (drawing v15 vs build)

The drawing is dated 17 Nov. The 20 Nov card 14 rows are newer, and the newer row wins (BUILD_RULES header).

**Find**
1. **Find's body is not the drawn "one search".** The drawing makes Find only a search box (results over Discover's
   parts), with the categories and saved suppliers moved to Build. The build keeps the category column. The 20 Nov
   rows draw card 14 and saved-first *in* that column (`.fold.flat`, "in an open category and in search results"),
   so the column is now ruled; whether Find should still become search-only is for the drawing session/controller.
2. **The drawing's result rows (avatar + "Add to build")** are superseded by card 14 (20 Nov). Built as card 14.
3. **The category search overlay** (opened by "See all", "✓ Done · Search again", a liked photo's "Find who") draws
   its own row, not card 14's face. Its distance words now match (`bd3c1c512`). The face needs each supplier's
   service card in the overlay, which it does not read today — a new read, so not done here.
4. **Card 14 says the distance twice when out of reach** — the badge "Beyond reach · 64 km away" and the line
   "about 64 km from your venue" (`find-cards-1280`, 4th card).
5. **A category row wraps its name under its icon at 375** ("Lights & Sounds · 1 yours", `find-cards-375-light`).
6. **The floating thumb tools (⇅ · search · sliders) sit over the card verbs at 375** (`find-375-light`).

**Build**
7. **Build is not "the List merged in".** The drawing shows "Dates that fit everyone", the venue anchor, guests,
   then every category with what is saved and booked and a 🔍 into Find. The build shows the build total, the
   budget bar and one line per category.

**Book**
8. **Book is not the drawn single "your orders" list**, and its heading reads "Waiting for their yes" (disclosed
   since 20 Nov).
9. **Book's three buttons (Nudge · Chat · Withdraw) wrap onto two rows** at 375 — not balanced.

**When**
10. The drawing's one dropdown "How sure are you of the date?" (Specific dates · A range · Some months · Not sure
    yet → popular months, pick 1–3). The build's dropdown opens on "Specific dates · 1–4 days" over the hot-date
    calendar; "Some months" shows per-month rows, not the drawn season groups (disclosed since 20 Nov).

**Where**
11. The drawing: a search box, area chips with "Not sure yet", which asks where guests live and **"What kind of
    place?"**. The build: "Pick an area" dropdown, "More places", "We already have our venue". "What kind of place?"
    is not built (disclosed since 20 Nov). Area cap is 3 (`MAX_EVENT_AREAS`), as drawn.

**Guests**
12. The drawing starts a wedding at 150 (the event type's size), with a Small · Medium · Large dropdown, a range bar
    and a Discover article link. A fresh wizard does start at 150 (`ESTIMATE_START`, pinned in
    `lib/onboarding/wedding-cards.test.ts`); the shot reads 200 only because it was reached by resuming a seeded
    draft, and resume fills missing fields from the older default. The dropdown, the bar and the article link are
    not built.

**Everywhere**
13. Dark mode: both routes are off `DARK_READY` (see §1).
14. Shots are from fixtures, not real data.

## 4 · Every way in

| Way in | Opens |
|---|---|
| Bottom nav "Suppliers" | Suppliers on Find (step row Find · Build · Book) |
| Step row / `?tab=build` / `?mode=booked` | Build / Book |
| Notification "<supplier> said yes" | that supplier's workspace (files tab) |
| Notification "Your date is set" · ask expired | `/dashboard/{id}/vendors` → Find. ⚠ The drawing moves an agreed or ended ask to Book. |
| Find "See all" · "✓ Done · Search again" · liked photo "Find who" | category search overlay (distance fixed here) |
| Sign-up wizard (approved wedding flow) | When = step `date`, Where = `w_area`, Guests = `w_pax` |
| Event details · date sheet | reads "Some months" back (20 Nov work, unchanged) |

## 5 · Guards (from `apps/web`)

See the PR status comment for the full preflight table (filled in at hand-off).
New guard this round: `lib/find-search-distance-reads-card-14.test.ts` (3 tests; sabotaged twice — a bare
`{r.distanceKm} km`, and `distanceFromVenue` from any coords — each turned it red). Tests reading the overlay or
the search: 25 files, 243/243 pass. Server actions: 1251 / 1251 (no new action).

## 6 · Files that overlap other open PRs

Code: `vendors/page.tsx` (#8094, #7903) · `vendors/_actions/category-search.ts` (#8087, different hunks) ·
`details/page.tsx` (#8004) · `lib/supplier-card-verbs.test.ts` (#8094).
Generated: `port-control-baseline.json` (18 PRs), `exposure-surface.baseline.txt` (#8094 #8088 #8057 #7968 #7881
#7868 #7585), `admin-jobs.generated.ts` (#8095 #8094 #7614 #7585).

## 7 · BUILD_RULES §2 rules not followed

- "Build EXACTLY the approved drawing": gaps 1, 3–12.
- "Screenshots from real data": fixtures only (no prod session from a cloud builder).
- "Dark is part of done": both routes off `DARK_READY`.
- "Buttons uniform and rows balanced": Book (gap 9).
