## 2026-10-23 · feat(admin): Make small copies of old photos — a dry run, then a press

Owner, 23 Oct: yes to small copies of the OLD cover photos that predate in-browser compression. Measured that day on
the live Discover page: one cover (a Main background, `events/<id>/std-background/…-Prenup7.jpg`) is **4,320 KB** —
the largest paint and 81 % of the page's bytes (shots-2026-10-23/speed/SPEED.md, cause 1). Production data changes
only through the pipeline or an owner action, so this ships the tool; the owner presses it after it ships.

- **Admin › Papic storage › "Make small copies of old photos"**: the page shows the DRY RUN on open — every event
  cover still pointing at an original in its own folder, sized with a HEAD (nothing downloaded, nothing written), the
  oversized ones (over 1 MB) counted and the largest listed. The button (admin-only, server-checked) makes up to 6
  per press, largest first: download → a 2048-px JPEG q82 written BESIDE the original (`….web.jpg`, same folder) →
  the cover points at it. Kept only when smaller. **The original is never deleted, moved or overwritten.**
- **Prints keep the original**: `lib/print-set.server.ts` swaps a copied Main background back to its original at
  print size (`originalForPrint`).
- Migration `20271284663331_small_copies_of_old_photos.sql`: the ledger `media_web_copies` (RLS on, no browser
  grant — service role behind requireAdmin) and two service-role-only functions — `media_web_copy_candidates()` and
  `apply_media_web_copy()` (points one cover at its copy only if it still names that original, and records the pair).
  Scope, first pass: the hero row's Main background (the Save-the-Date film's own upload was folded into it by
  20271277600211). The hero photo column is printed at full size and is not touched.
- Guards: `tests/db/old-photo-copies.db.test.ts` (fixtures: the right covers listed and no others; one cover moved,
  the rest of it kept, the pair recorded; a changed cover / foreign folder / non-copy name / bigger copy refused;
  idempotent; service role only) · `lib/old-photo-copies.test.ts` (the rules; dry run until pressed; no delete; prints
  on the original). Ugat: one declined line (ops tooling).

- Server-action budget (1,225, never raised): the press is one new route, so `removeGuestFromGroup`
  (`app/dashboard/[eventId]/guests/groups-actions.ts`) — an exported action nothing in the repo calls any more (its
  "Remove from group" chip is gone) — is removed, the #6003 / slice-A way. Budget back to 1,225 of 1,225.
- The section is grouped by a rule and type, not a box (`lint:no-card`).
- Sizes read through `formatCount` ("4.3 MB" / "380 KB"); a refused ledger read or `apply_media_web_copy` call
  is logged as `[supabase-error]` before it falls back (both-ends guard); the FK-behaviour map records
  `media_web_copies.made_by → auth.users SET NULL` (regenerated).

SPEC IMPACT: None (an admin tool on an existing page; no product behaviour or SKU changes).
