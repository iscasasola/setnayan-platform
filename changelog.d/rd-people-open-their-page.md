## 2026-10-25 · feat(people): every person with an account opens their page; the person sheet says less

Owner, on People › Following: *"so why don't i see their user account page?"* · *"i cannot click their names i
should be able to see it because they have account already"* · on the roster: *"i want to see the 3"* · on the
person sheet: *"wording is too much"* · *"yes they should have an account like me."*

- **Every People row that is an account links to `/u/…`** — Following, Followers, the roster (labelled, no label
  yet, and waiting for them), and Requests. Face + name (+ the line, on Following/Followers) are the press; the
  Connected chip, Unfollow / Follow back, ✎ Edit, ✕ Remove, Accept / Decline stay their own controls. One answer
  for the address, `lib/person-page-link.ts`: the account's `users.slug`, else its public handle `S89U-…`; an
  unclaimed person (`S89P-…`) or an alaga stays plain text. The rows carry the slug from the reads they already
  make (`lib/people-follows.ts` reads slugs beside the names; `lib/people-roster.ts` adds `slug` to its existing
  account embed). No migration.
- **`/u/[userSlug]` also finds an account by its public handle** (`lib/public-profile.ts`) and forwards to the
  slug when one exists — 18 of 27 accounts had no slug on 2026-10-25, so a slug-only page left most people with
  no address at all.
- **A person who already knows them gets their page, not a 404** (`lib/profile-viewer.ts`). A switched-off
  profile used to 404 for everyone but its holder. A signed-in viewer who is connected, asked to connect, or
  follows either way now sees the account page: initials, the name People already shows them, a "Connected" /
  "Waiting to connect" / "You follow each other" line, the account's PUBLIC events as cards, and "Nothing shared
  publicly yet" when there are none. Never the photo (the public-profile switch is the consent to publish it),
  never chapters (their pages gate on the switch), never audience numbers. Strangers: unchanged (404).
- **The single-event auto-jump on `/u` is now for strangers only**: a viewer who knows the person lands on the
  profile with the event as a card. The holder keeps the jump. The viewer is read only inside that branch and the
  dormant branch, so the public render stays ISR-cached.
- **The person sheet** (roster ✎): the "CONNECTED · NO LABEL YET" eyebrow is gone (the pill and the Label row say
  it); a "See {first}'s page →" row sits under the name; the label note + the spouse note live behind the Label ⓘ
  and the group note behind the Group ⓘ; "Remove … from your people" stays a quiet link.
- Guard: `app/dashboard/(account)/people/every-person-row-opens-their-page.test.ts` + `lib/person-page-link.test.ts`.
- `/dev/people-lab`: fixtures carry handles (one row without, to show the plain case), Following has rows.

SPEC IMPACT: None — no locked decision changes. Flagged for owner sign-off in the PR: a switched-off profile is
now visible (name + public events, no photo) to signed-in people who already know the account on Setnayan.
