## 2026-11-14 · feat(admin): People records — Person, Shop, Event and Venue on the approved drawing (build A4)

Owner, 14 Nov 2026: *"Yes, queue the builds"* — the approved 13 Nov inner-screen drawing
(`Setnayan-specs/prototypes/admin_pub/people.html`, screens `person` · `shop` · `event` · `venue`).

- **One record kit** (`app/admin/_components/record-kit.tsx`): record head (what it is · its ID over the name, then
  badges), read-only facts on hairlines (T18, never cards), one shared `Fold` per drawing fold with its one-line
  summary, hairline rows with the terracotta ›. Tokens only; mirrors #7632's `template-rows` classes so the two can
  merge once that lands.
- **Person** (`/admin/users/[id]`): the five-tab rail becomes one page of folds — Profile · Events · Orders &
  payments · Comps · Problems · Activity · Access · Flags · Admin log. An old `?tab=money|support|activity|governance`
  address opens the fold that now holds it. The users-list row actions the drawing moves here (Confirm email ·
  temporary password · Sign out everywhere · Team · Blacklist · Delete · Revoke comp) sit in Access / Flags / Comps,
  calling the same server actions. Suspend / Unsuspend (#7584) unchanged. **Honest-read fix:** the comps read used
  `.catch(() => [])`, so a refused read printed "No comp grants." — it now says "Couldn't read".
- **Shop** (`/admin/vendors/[id]`): head + facts + demo-shop switch, then Verification · Plan · Services (open with
  the page, so `#cards` still lands) · Money · Team folds. This is where every "Open record" for a shop lands.
- **Event** (`/admin/events/[id]`): head + facts + Hosts rows, then Guest list (Reopen) · Face tagging · Suppliers.
- **Venue** (`/admin/venues/[id]`): head, the shared VenueForm, Remove at the bottom behind a titled confirm.
  **Honest-read fix:** a refused venue read fell through to `notFound()`; it now says "Couldn't read this venue".
- `/dev/admin-people-lab` draws the four records with the real kit inside the real admin shell (dev-only).
- No new server action, no migration, no new read beyond the person page's pending-team-grant check (the same read
  the users list makes).

SPEC IMPACT: None — builds the approved drawing; no decision changed.
