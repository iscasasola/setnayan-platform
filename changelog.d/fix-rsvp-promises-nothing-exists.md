## 2026-08-07 · fix(rsvp): the reply form promised guests three things that do not exist

Under the RSVP form, every guest who is not a limited +1 read:

> *"You'll be able to add a song request and dance style, plus a Papic Challenge
> opt-in, when you sign up for a free Setnayan account."*

**All three are false, and so is the account.**

| Promise | What actually exists |
|---|---|
| song request | No guest-facing surface. The playlist screens are couple-side (`dashboard/[eventId]/studio/playlist`) and admin (`admin/songs`). |
| dance style | Appears in exactly one migration (`20260522030000`, a music-category schema) and nowhere in `apps/web` at all. |
| Papic Challenge opt-in | **Nothing anywhere** — no column, no screen, no action. The sentence was its only occurrence in the repo. |
| "sign up for a free Setnayan account" | There is no guest account area: no `app/guest`, `app/account` or `app/me` page exists. |

The Papic clause was flag-gated on `papicGamesEnabled()`, so turning Papic Games
on in production is what switched this promise on for real guests.

This is the same fault the 2026-08-06/07 sweep kept finding: **copy describing a
feature nobody built.** A guest reads it, replies, and waits for a screen that
will never appear — and it sits at the exact moment we are asking them to trust
us with their RSVP.

Removed the sentence. That orphaned two things, both also removed: the
`papicGamesEnabled` import, and the `limited` prop on `RsvpWidget` (its only use
was choosing whether to show this sentence). `limited` is dropped at both
`site-body.tsx` call sites; `isLimitedPlusOne` still feeds three other widgets
and is untouched.

Nothing replaces it — an RSVP form does not need a footnote, and inventing a
truer one would just be new copy about a feature that still would not exist.

Verified: `tsc --noEmit` clean · 17/17 lint scripts · exposure baseline OK.

SPEC IMPACT: None. If a song request / dance style / challenge opt-in is wanted
for guests, that is a build, not a copy change — see `0012_papic` §9 for the
challenge side.
