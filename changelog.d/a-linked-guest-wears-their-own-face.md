## 2026-09-20 · feat(guests): a guest who has an account wears their own face

⚖ Owner 2026-09-20, looking at his own row on his own guest list: *"why is my
account not showing. i registered on the event as me"* — then, once told the
roster only ever reads the guest row's photo: *"so when users create their
accounts, when they have a profile photo, it will show here too"*.

Measured that day: his registration was perfect. `event_members.guest_id` linked
his row to his user with role `groom`. The roster simply never looked at the
account — every avatar came from `guests.photo_url` alone, so a guest who had
joined, claimed their invite and set a profile photo rendered as two grey
initials, indistinguishable from a name typed in once and never heard from
again.

- `lib/guest-account-photos.ts` — `guest_id → their account's stored photo ref`.
- The couple's own upload **always wins**. `guests.photo_url` was chosen for
  THIS wedding (often an RSVP selfie taken for the seating chart); the account
  photo is the fallback for a row that has none.
- One helper, `faceFor`, now answers all six row surfaces (roster, both mobile
  lists, the grid and two self-join variants) plus the drawer and the inspector.
  Each used to spell the lookup out itself — which is how five would gain the
  fallback and the sixth silently not.

🔒 **It needs an admin read, so it does its own gating.** Another account's
`users` row is invisible under RLS by design (the wall `lib/people-search.ts`
documents), so the photo cannot be fetched as the couple. The membership read
runs as the CALLER — a non-member gets zero rows, there are no user ids, and the
admin client is never asked anything, so the gate is a policy rather than an
`if`. The admin select carries exactly `user_id, profile_photo_url`: no email,
no display name, no discoverability flag.

⚖ **IT IS OPT-IN.** Owner 2026-09-20, shown the disclosure before it shipped:
*"keep it opt-in, add the preference column"*. Nobody's face reaches a couple
until they switch it on in their own profile (Privacy → "Can the couples you
join see your photo?", off by default).

`users.share_profile_photo_with_hosts` (migration `20271236036451`) is
**nullable with no DEFAULT**, and the read filters `.eq(true)` — which excludes
NULL, so silence means no. A `NOT NULL DEFAULT TRUE` would have performed the
declined disclosure once, silently, on every existing account; a `DEFAULT FALSE`
would be a decision nobody made recorded as though they had. Its sibling
`discoverable_by_name` reads `?? true` for the same reason this reads
`?? false`: same shape, opposite default, because the question is opposite.

The preference is **filtered on, never selected**, so the admin read still
carries only `user_id, profile_photo_url` — somebody's privacy setting is not a
fact this function needs to hand back.

The stored value is an `r2://` ref, not a URL, so it goes through
`guestPhotoDisplayUrls` like every other face — a raw ref in an `<img src>` is a
broken-image glyph, the defect `a-guest-face-is-resolved.test.ts` was written
for after it shipped in four loaders at once. A refused read degrades to
initials (what the roster drew before this existed) and is logged, because a
refusal and an event where nobody has joined look identical from the outside.

Guarded by `lib/a-linked-guest-wears-their-own-face.test.ts` (11 tests). Six
sabotages confirmed red: the account photo preferred over the couple's upload ·
the admin select widened to carry `email` · one surface reverting to an inline
lookup · the opt-in filter dropped · the column gaining `NOT NULL DEFAULT TRUE`
· the profile defaulting the preference to ON.

SPEC IMPACT: None.
