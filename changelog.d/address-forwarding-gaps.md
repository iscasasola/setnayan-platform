## 2026-08-12 · fix(routing): the printed invitation QR did not forward — and four other gaps an adversarial pass found

An independent review of the four merged address PRs raised 13 candidate
defects; 10 survived refutation. All ten were re-verified by hand against
`origin/main` and prod before this change. Two are mine and user-facing.

**🎟 The one URL actually printed on an invitation never reached forwarding.**
A personal QR encodes `/{slug}?invite={token}`, and the page short-circuits
every tokened URL to `/{slug}/redeem` **before** the forward runs. That route
then dropped the token and bounced the guest to the old address, which forwarded
to the right event **as a complete stranger** — no seat, no RSVP, and a private
lock screen telling them to "scan your invitation QR", which is exactly what
they had just done. Every re-scan of a card already in someone's hand repeated
it. Worse than the 404 it replaced, because it reads as the couple shutting them
out. The redeem route now carries the token to the current address.

**🔁 `/v/{slug}` hard-404'd after a corrected shop address** while the admin was
told "links and QR codes already printed keep working" — true of the bare root
only, not the legacy form the shop was shared and indexed under.

**🔒 A forward out-disclosed the gate it landed on.** `/u/{handle}` is dormant by
default and 404s to strangers so it is not an existence oracle — but a 307
discloses in its `Location` header regardless of what the target returns, so
forwarding a hidden account's old handle published both that the word was
somebody's and what their handle is now. The user branch now reads
`public_profile_enabled`.

**🚨 The admin correction matched the shop with an unvalidated LIKE pattern.**
Only the destination was format-checked, so `banawe%` — or an `_` typed where
the slug has a `-` — could permanently move a **different** shop's address. Now
an exact match, and the success message names the business that moved.

**🛡 Two guards that could not fire, both mine:**
- The closed-shop mint test seeded `hiraya-events`, but the mint is hyphen-free
  and produces `hirayaevents` — it compared against a word the mint can never
  hand out and passed regardless. Re-seeded on a word the mint really produces,
  with a **control** asserting that precondition. Mutation-proved: neutering the
  ledger check now turns it red; before, it stayed green.
- `lint-no-function-level-custom-set.mjs` knew **one** spelling. `ALTER FUNCTION
  … SET setnayan.x` is rejected by prod identically and sailed past. Broadened
  to the `ALTER FUNCTION/PROCEDURE/ROUTINE/ROLE/USER/DATABASE` forms.

Copy: the **public Help Center** still told couples a renamed address forwards
for 90 days — now derived from the one constant, as is the availability
module's docblock.

🪤 **And the first cut of the new reachability guards was itself decorative** —
its mutation run reported zero failures because the regexes matched the
*sabotaged* names as substrings (`DISABLED_resolveRenamedPath` still contains
`resolveRenamedPath`). The same prefix-matching trap this repo has paid for
before. Anchored with `\b`, then re-run with the sabotage **verified applied**
(occurrence count checked to zero): all four fire.

SPEC IMPACT: None.
