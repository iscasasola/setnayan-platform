## 2026-10-28 · feat(guests): the summary becomes one carousel (style A, the ring); the row pins once; Excel in ≡; headers marked by their chip

Owner rows of 2026-10-27 (DECISION_LOG): "APPROVED — GUESTS CAROUSEL STYLE A (THE RING), COMPACT" (*"ring looks
good."*), "EVERY CAROUSEL SNAPS TO CENTRE, PEEKS BOTH SIDES, LOOPS", the ⓘ-per-card sentence of "EVERY THUMB ROW IS
FROSTED GLASS…", "APPROVED — FOLDABLE HEADERS ARE MARKED BY THE ICON CHIP" (*"1"*) and "FILE BUTTONS ARE A SHARE
BUTTON". Prototype `prototypes/guests_summary_carousel_2026-10-27/`.

- **One carousel, three cards** (`guests-screen.tsx`, ≤ 96 px each at 390): ① Total guests — a 44 px ring filling to the
  % replied (green attending · red not coming over the grey track; ~600 ms in, static under reduced motion), "● N
  requests to join ›" / "No requests waiting"; the whole card opens the Requests page. ② Attending · Not coming · No reply
  · To invite — each count the door to its filter (`To invite` is a new `ReplyFilter`, `isToInvite` — the same rule its
  number counts) — and `Invite N ›`, the one send run; "One link for everyone · Share" on a one-link event with no list
  to walk (Share opens Guests ⚙ on "Your one link"). ③ +1s — named / no name yet as a two-part bar, each half a door.
  Every card's ⓘ sits top-right and opens inside its card. The "Option A" counts strip and the "N requests to join ·
  Review" strip are gone — folded in.
- **`SnapCarousel`** (`components/snap-carousel.tsx`) — the shared part: centre snap, a small peek both sides, a
  continuous loop (two inert copies each end, added after hydration; the server draws each card once), auto-advance
  ≈3 s, paused 6 s on touch / hover / wheel / focus, never off screen or under reduced motion; dots for position.
- **The row pins once:** at rest `List · Map · ⚙` scrolls with the page; once the carousel has gone, ONE 44 px row pins
  — `List · Map · ✓ ✕ ? · ⚙`, no Invite (it lives on card ②). A holder keeps its height, so nothing moves. Map unchanged.
- **Save as Excel** is a ≡ choice on the List's thumb row wearing the share icon — the shipped save (`usePrintSave`:
  share sheet / download), never a link.
- **`.sn-acc-head`** (globals.css): the foldable-header mark — chip soft grey closed, solid terracotta with a white icon
  open, one divider under, no band; light + dark. Applied to Guests' group headers only (Suppliers adopts it later).

Guards: `the-summary-carousel-holds-the-doors.test.ts` (replaces the retired `the-counts-strip-is-option-a.test.ts`,
same doors), `lib/every-carousel-snaps-to-centre-and-loops.test.ts`, `lib/a-foldable-header-is-marked-by-its-chip.test.ts`;
updated `lib/the-pinned-row-is-one-row.test.ts` (no Invite, pins once), `lib/guest-export-file.test.ts` (test 6 → the ≡
choice), `the-counts-filter-what-they-count.test.ts` (+ to invite), `the-fable-card-and-rows.test.ts`,
`lib/guests-read-is-honest.test.ts`. Port baseline regenerated (the meter's `<Fill>` left the route). +0 server actions,
no migration.

SPEC IMPACT: None — builds the approved 2026-10-27 rows. Build notes for the record: card ① opens `/guests/claims` (the
page that holds the requests its number counts — `/access-requests` is coordinators' asks); the ⓘ tips open inside each
card (the carousel's track clips anything hanging out of it); the header divider runs the column's width.
