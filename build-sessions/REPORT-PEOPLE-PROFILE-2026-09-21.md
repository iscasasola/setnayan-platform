# REPORT — People discussion session → Overall Controller (2026-09-21)

Sent by message first; that message expired unapproved, so it is left here.

## Shipped (auto-merge armed)
1. **PR #5827** · `claude/name-search-any-order` — People find-by-name matches words in ANY order ("Casasola Ice" → "Ice Casasola"). Pure `nameSearchTerms` in `lib/people-search-query.ts`; one escaped ILIKE per word, ANDed. Enumeration guard kept (a search needs at least one word of 2+ characters). Sabotage-checked.
2. **PR #5831** · `claude/profile-formal-name` (stacked on #5827):
   - Migration `users_formal_name`: `users.name_prefix/first_name/middle_name/last_name/name_suffix` (same as `guests`, 80-char cap) plus a generated `users.name_search` (nickname + five parts + slug).
   - Profile: a "Full name" group. Display name stays the nickname. `users.slug` is relabelled **Account name** and shown as **@tag**. Blank parts are PRE-FILLED (not saved) from a guest row already linked via `guests.person_id` (`lib/formal-name-from-guest-list.ts`).
   - Search reads `name_search`; each result shows nickname · @tag · full name.
   - Verified: tsc clean · lint clean · unit tests 18/18 · db tests (ugat ×3, anon-cannot-write-to-users, credential-column-lockdown) 22/22.

## Owner rulings — see DECISION_LOG.md, row 2026-09-21 "THE PROFILE CARRIES A FORMAL NAME…"
- The nickname stays; the five parts are the formal name. Self-declared, never verified.
- @tag = the existing `users.slug`.
- A search result shows nickname + full name + @tag (this shows middle names to anyone who searches; the owner accepted that).
- Guest list "Add from your people": confirmed connections first; the other-events and samahan sources are KEPT.
- Adding a connection COPIES their formal name (the host can edit it) and LINKS the guest row to their account.
- Meal / allergies / photo are NEVER auto-imported; the person confirms (per event, or via RSVP).

## NOT BUILT — queue (overlaps the "Guestlist" session)
Files: `add-from-people-sheet.tsx`, `people-add-actions.ts`, `lib/people-you-can-invite.ts`.
- Order confirmed connections first.
- Copy the user's formal parts into `quickAddGuest`, which already takes prefix/middle/suffix.
- Link `guest.person_id` to the connection's claimed person, SERVER-SIDE only (the roster hides user_ids by design).
- Add a per-event "share meal/allergies/photo?" consent request.

Open owner questions:
- Nudge existing accounts to fill in their full name?
- Does the "share photo with hosts" toggle count as consent?
- Should the top search bar follow the same rules?
- Any other profile fields?

## Prod data fix (owner-approved, done)
- The owner's groom row on `cale-ice` (guest `9342bbca…`) was held by `testnayan4@test.com` through `event_members` id 159 (`guest_signup`, created 2026-09-18). That row was deleted.
- The groom row's email was then set to `iscasasolaii@gmail.com`, and `set_guest_person` relinked it to his own person node (`e22f1a33…`). Verified.
- ⚠ Sweep other `testnayan*` `event_members` rows on real events.
- ⚠ Gap: no mechanism links a couple's OWN groom/bride rows to their accounts. `link_guest_to_account_person` fires only for `member_type='guest'`.
