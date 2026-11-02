## 2026-09-21 · fix(guests): Unlisted guests — link only to the unlinked, by search; keep with name, side, role, group

Owner, on "Same as · Choose a guest on your list…": *"this should only show accounts that are not yet
linked. there should be a search bar also. And allow manual add to list where you can choose their
role, group, side, and name as well."*

- **Same as** offers only guests no account has claimed (`event_members.guest_id`, read with the admin
  client after the couple check). The Link action already refused a second account on a claimed guest,
  so offering them only produced an error. A refused read hides the picker rather than offering them.
- The 79-name dropdown is a **search box** (`claims/link-picker.tsx`): every word typed must appear in
  the name, any order, case- and accent-blind; Link cannot post until someone is picked. Posts the same
  `target_guest_id` the form always did.
- **Keep on my list** opens a form — first / last name (prefilled from what they typed), side, role
  (this event's offered roles, never Bride/Groom), group — and adds them with those. The action re-checks
  every choice (`readKeepChoice`), reports a taken singleton role in words, and shows its errors on the
  page instead of failing silently.
- Rules in `lib/unlisted-guests.ts`, tests `lib/unlisted-guests.test.ts` (5; the unlinked filter
  sabotaged → caught). Picker verified in a browser: search, accent-folding, "nobody" message, blocked
  empty submit, posts the picked guest.

SPEC IMPACT: None
