## 2026-08-15 · feat(privacy): a fourth audience — only guests with a Setnayan account

Owner, 2026-08-15: *"it is the owner's choice if they want this in public or link
only or tagged accounts only (no tagged account means it is private for them)."*
Asked directly who counts as tagged, the owner chose: **anyone on the guest list
who has an account.**

`events.landing_page_visibility` gains **`invited_accounts`** — between "link
only" and "private": narrower than a link, wider than yourself. A stranger and a
person merely holding the link both get the **identical** locked screen; a
different message for the link-holder would confirm the address is real.

🔴 **THE DANGEROUS PART WAS NEVER THE MIGRATION.** `canViewSlugEvent()` opened
with `if (visibility !== 'private') return true;` across **31 call sites**. Adding
the new value under that spelling would have made **the most private setting in
the product completely public, everywhere, instantly.** It is now an allow-list
(`openToStrangers`), so a value added later is CLOSED until somebody deliberately
opens it. 🔑 **An exclusion test over a growing set admits every future member by
default** — the same shape, on the same column, was publishing link-only
celebrations to the stories shelf and the sitemap earlier the same day.

**Two more exclusion tests found and corrected while widening:**
`resolveSiteReachability` would have told a host their site was *reachable* when
the link alone opens nothing; and `isScheduledLaunchDue` declined only by
accident of which side of `!== 'private'` the new value landed on — a timer set
months earlier must never flip a deliberately narrow audience to public.

**Who is recognised — two claims, either admits.**
**A ·** the account is **bound to a seat** (`event_members` guest row with a
`guest_id`) — the shipped primitive behind `findGuestSeatForUser`, established by
holding the invitation QR or clicking an emailed link. **B ·** the account
**owns a person on the list** (`guests.email` → `set_guest_person` trigger →
`people.claimed_by_user_id`), which needs nothing from the guest.
🔑 **RULE 0 CAUGHT ME MID-BUILD:** I wrote B first and found A already shipping
one file away, in this page's own "Path C". **Check for the shipped primitive
before inventing the concept.**
⚠ **B is weaker than A and the PR says so:** a mistyped email opens the
celebration to whoever owns that address. Accepted deliberately — the invitation
is emailed to exactly that address — and it grants nothing but reading a page the
host chose to share with their guests.

⚠ **TODAY THIS ADMITS NOBODY, AND THAT IS THE RULE WORKING.** Prod holds 35
guests with **zero** emails (the trigger deliberately leaves a name-only guest
unlinked — *"needs a confirm"*) and no guest-type member rows. So the setting
currently means "only the hosts" — exactly the owner's *"no tagged account means
it is private for them"*. **The host is told this in the option's own text**,
because a setting that silently shows the page to nobody reads as a fault, not a
choice. Do NOT loosen the match to make it do something: a name is not an
identity.

⚠ **Named `invited_accounts`, not "tagged".** `events.live_photo_wall_visibility`
already carries a value literally called `'tagged_only'` meaning something else —
and its own 2026-08-12 row records that the name promised a filter existing
nowhere. Two columns on one table sharing a word for two rules is how the next
reader gets it wrong.

🛡 `lib/event-visibility.test.ts` — 10 tests: the four values and their order,
the allow-list, listable-vs-readable ("link only" is readable and never
advertised), fail-to-private on junk, no exclusion test in either access file,
the gate calls the allow-list, the public page takes the locked path for the new
value, **the host can actually choose it** (five settings in this product have
shipped with no way to reach them), and the migration CHECK agrees with the code.
**Baseline verified GREEN — it was RED first and caught a real one** — then three
sabotages, **each verified to have LANDED by occurrence count** (allow-list call
1→0 · locked-path match →0 · host option 1→0), all three red.
✅ 8302 unit tests pass · typecheck clean · migration allocator + 3 lints pass.

SPEC IMPACT: `STORIES_AND_EDITORIAL_INTEGRATION_2026-08-15.md` § 5 ·
`prototypes/event_story_audience_2026-08-15.html` · `DECISION_LOG.md` 2026-08-15.
