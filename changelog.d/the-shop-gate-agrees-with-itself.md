## 2026-08-28 · fix(marketplace): a service card is public exactly when its shop is

Owner: *"fix it."*

**The defect.** Two columns decide whether a shop is public, and two surfaces
read two different ones. `vendor_profiles.public_visibility` is authoritative —
the marketplace, `/v/[slug]` and `vendor_profiles_public_read` all use it.
`is_published` is the legacy boolean that `lib/vendor-visibility.ts` documents
as superseded, the explore page says is *"no longer queried here"*, and the
admin accounts surface calls **"the dead column"** in its own comment after
moving two tabs off it.

`vendor_services_public_read` never got that memo, and gated every service card
on the dead one.

**Both production shops sit exactly where the two disagree:**

| shop | public_visibility | is_published |
|---|---|---|
| SetnaProd | `verified` | **false** |
| fixture | `hidden` | **true** |

So the real shop is listed while its cards are unreadable, and the hidden
fixture is the mirror image. It bites nobody today only because SetnaProd has no
cards yet — the moment it publishes one, the shop is visible and the card is
not, with nothing on screen saying why.

⚠ **NOT a leak, and I checked before writing that it was.** Probed as
`authenticated` in prod: `vendor_services` returns **0 rows**, because the
policy's subquery runs under the caller's RLS and `vendor_profiles` only ever
shows a stranger the verified-AND-verified set — so the hidden shop's id never
reaches the IN-list. Its cards were already unreachable, **by accident of nested
RLS rather than by the policy's own text.**

**The fix** mirrors `vendor_profiles_public_read` exactly, written as an explicit
predicate rather than left to the nested RLS: a policy that is correct only
because *another* policy happens to filter its subquery is one change away from
being wrong with nothing to say so.

🔒 A shop reading its own cards is untouched — that is `vendor_services_manage`,
a separate policy, asserted by a post-condition.

**Measured** · dry-run against **production** inside `BEGIN … ROLLBACK`: all
post-conditions passed, a signed-in stranger still sees 0 cards, and the admitted
set swaps from 1 shop (the hidden fixture) to 1 shop (SetnaProd) — the same
count, the correct shop · 6 db tests, a four-corner matrix over both columns plus
a positive control · 3 mutations, each measured before → after, all RED.

🪤 **Two fixtures described rows the database cannot hold, and both failed
loudly:** a verified shop needs a `last_verified_at` stamp (a CHECK), and a live
card needs a price and a Setnayan Exclusive (the publish gate shipped this
morning). A seed the database refuses proves nothing about the policy under test.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-28.

**THE FREEZE fired, and it was right to.** A predicate change cannot be
mechanically proven to narrow, so the exposure guard hands it to a human. Read,
and recorded here rather than waved through:

- The delta is **one line** — the same capability, differently gated. Fact count
  unchanged at **6274**; nothing added, nothing removed.
- **Roles unchanged** (`authenticated`), **command unchanged** (SELECT), the
  `is_active` leg unchanged.
- The predicate swaps `is_published = true` for
  `public_visibility = 'verified' AND verification_state = 'verified'` — the
  exact pair `vendor_profiles_public_read` already uses, so a card is now public
  on precisely the condition its shop is.
- **Against production it is a two-way move, both correct**: the hidden fixture
  shop's cards leave the admitted set, and the verified real shop's enter it.
  Same count (1 → 1), different shop, and the different shop is the right one.
