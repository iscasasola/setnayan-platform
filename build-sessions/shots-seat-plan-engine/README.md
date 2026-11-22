# Seat plan on the shared engine — proof of no visible change (2026-11-20)

The shipped `SeatingEditor`, drawn by the no-database lab `/dev/guests-lab?part=screen&gview=seats&seat=map|list`
(fixture event, no sign-in), shot with Playwright at deviceScaleFactor 2:

- `*-375-light` · `*-desktop-light`: the page as everyone sees it today.
- `*-dark-forced`: `.dark` added to `<html>` by hand. Seats is not on `DARK_READY` (`lib/appearance.ts`), so no one
  sees it dark yet. The lab's own top and bottom bars are not dark-ready on either side.

Each shot was taken twice, from `origin/main` (ece103de4) and from this branch, and compared pixel by pixel:
**all 10 pairs are identical.** Only this branch's set is committed.
The Next.js dev "issues" badge (the placeholder Supabase URL refusing) is hidden in every shot.
