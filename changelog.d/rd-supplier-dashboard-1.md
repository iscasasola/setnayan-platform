## 2026-10-12 · feat(supplier): the supplier dashboard's first two steps on today's main, in the approved look (S-PR0 + S-PR1, supersedes drafts #6443 · #6450)

The supplier dashboard redesign's foundations (S-PR0, draft #6443) and "Today is rows" (S-PR1, draft #6450) — corpus
`SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 6 rows S-PR0 · S-PR1, prototype
`prototypes/supplier_dashboard_2026-10-08_fable.html` — merged onto main (only generated baselines conflicted;
regenerated), then refitted to the owner's 2026-10-12 "APPROVE ALL" look calls and the § 9 templates.

**From the two drafts (unchanged in what they do).** `SupplierThumbRow` (the frosted floating row, portalled,
slides in/out, one fit state) · `SupplierSubmit` (a form's submit through the button rule) · the envelope in the
supplier's top bar (the bell stays until S-PR9) · tour keys `vendor_shop_v1` / `vendor_hub_v1` (registered, not
mounted) · Today = ONE Next card ("1 of 3") → three numbers → Coming up → **Also waiting** (the rest of the queue,
each answer opening in place) → one Shop row; the event-day dark card; a failed read says "couldn't load", never 0;
the banners folded into `pickSupplierNext` rules or kept as rows; `/dev/supplier-lab` (no session, 404 in
production); the per-component button sweep guard.

**The look, refitted (2026-10-12 look audit of #6443/#6450):**
- **The outcome of an answer** is the shared TOP toast (`PeekToast`: terracotta ✓ · white note · dark red with
  "Try again" only where pressing again can work) saying its first sentence, plus the whole sentence as the page's
  status line, drawn by the server and never leaving by itself. It was a dark pill drawn by hand at the BOTTOM for 8 s.
- **The Next card has no frame and no fill** (`app/_components/next-card.tsx`, shared — the couple's Home loses its
  frame too, fixed once). A failed read keeps its danger wash; the event-day card stays dark, and now stays a DARK
  card with light words in dark mode (it turned into a white slab).
- **Every main button is terracotta** (`brand`) — the Next card's verb and every answer in the rows; taking
  something away for good (remove a celebration · "it never arrived") is the delete look. The answers' hand-made
  buttons and links are `SupplierSubmit` / `ActionButton` now (44 px each); `overview-sections.tsx` joins the sweep.
- **Also waiting is the shared `Fold`** (one open at a time across the screen, its terracotta arrow, 0.7 s), and
  so are the "no" folds inside the answers; `Fold` gains two optional props — `line` (a row's second line) and
  `aside` (a state at the right). "Nothing to answer" rows too.
- **States are the shared `Badge`** (new `app/_components/badge.tsx`, kind 11's shown-state member: soft fill, no
  border, always its word) — "2 of 3", "Live". `TodayPill` is gone.
- **Every tap mark is terracotta** (`text-sn-accent`) — row arrows, the list doors, and a small mark under each of
  the three numbers (still tappable); the waiting number wears the accent token instead of a hand-written mulberry.
- **The booking-fee bills on Today are hairline rows** (`BookingFeeBills rows`), Pay now the row's main button;
  every other surface keeps the boxed row.
- **Thumb row: every control 44 px** (its doors and its field were 40 — found on the walk).
- **Two orphans deleted** — `first-steps.tsx` (its meaning is the `setup` rule) and `spotlight-award-banner.tsx`
  (its home is S-PR7): S-PR1 unmounted both, and `ugat-both-ends` refuses a component nothing mounts.
- Not changed, listed: the thumb row's own search field (a SearchBox kind is being designed — DECISION_LOG
  2026-10-12 look call 12).

Guards: `today-is-rows.test.ts` re-aimed (rows are the shared Fold · the toast is the shared top toast + a status
line · every main look is terracotta, read from both look tables) and a new test 8 (no frame/fill · every tap mark
is the accent · Badge has no border · the dark-mode day card); five desk guards re-anchored to the new markup with
their claims kept; `badge.tsx` joins the accent watch. Sabotage: 14 runs, each red (PR body).

No migration · +0 exported server actions · no new rule in `globals.css`.

SPEC IMPACT: None to the plan. Applies DECISION_LOG 2026-10-12 "APPROVE ALL: THE SUPPLIERS + SUPPLIER-DASHBOARD LOOK CALLS" (1 · 3 · 7 · 8 · 9) to S-PR0/S-PR1; the 14 deviations in `SUPPLIER_DASHBOARD_BUILD_STATUS_2026-10-08.md` stand except deviation 9 (the fold answers now wear `ActionButton`) — noted in that file. One shared-look change the owner should see: the couple's Home Next card also loses its frame.
