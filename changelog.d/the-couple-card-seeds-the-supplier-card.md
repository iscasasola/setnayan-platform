## 2026-09-20 · feat(claim): the couple already described this service — the supplier stops retyping it

Owner: *"when a vendor gets this lock, the service card will be the one
registering for that portfolio. and the price as well."*

**The loop closed on the link but never on the content.** A couple adds a
supplier themselves, records the price, transport, crew meals and inclusions,
and sends the claim QR. The supplier scans it, signs up, and lands on
`/vendor-dashboard/services/new/[category]?claim=<token>` — which opened
**blank**. `registerClaimedServiceToCouple` then wired whatever they built back
to the booking, so the two sides were linked while the one description that
already existed was thrown away and the supplier retyped a price the couple had
agreed with them.

**Extends, never re-draws.** The maker already accepts a seed — `CanvasInitial`,
built by `buildCanvasInitialFromCard` for the "Start from one of your cards"
(`?from=`) doorway. This adds a **second source for the same seed type**, not a
second seeding mechanism: the page picks one builder and hands the result to the
same `initial` prop, so the canvas cannot tell the doorways apart and every
field-parity guarantee that covers `?from=` covers this. `?from=` wins when both
are present — it is an explicit choice made on that screen; the claim seed is a
default nobody asked for.

**Carried:** the agreed total as `starting_price_php` (basis `fixed` — one
number is not a rate card), transport, crew meals, crew size, and the inclusion
lines with a blank `worth`. Every one is a DEFAULT in an uncontrolled input; the
supplier can change all of it and nothing saves until they submit.

**Deliberately not carried, each for a reason:**

- **The title.** The couple named a SUPPLIER ("Seda Vertis North"); a card's
  title names the SERVICE. A wrong value in the most visible field is worse
  than a blank one.
- **`covers_plan_groups` → `linkedCategories`.** Different vocabularies — plan
  group ids vs canonical services, with no total mapping. Inventing one would
  bundle a card with categories its owner never chose.
- **The payment notes and the address.** Those are the couple's private record
  of an off-platform arrangement (2026-09-20 ruling). Copying them into a
  published listing would publish something nobody agreed to publish.

**Nothing to say ⇒ say nothing.** When the couple recorded nothing worth
carrying the builder returns `null` and the maker opens plain, rather than
announcing "started from what the couple told us" over a card identical to a
blank one. A ₱0 total is *nothing recorded*, not a free service.

**Security.** The seed reads a COUPLE-owned row with the admin client, so it is
gated on `showClaimBanner` — the existing four-way proof that the invite is
`claimed`, belongs to this user, resolved to this vendor profile, and matches
this route's category. That is the same chain `registerClaimedServiceToCouple`
demands before it writes. A weaker gate would hand one couple's agreed price to
whoever guessed a token.

**`server-only` split.** The first draft put the mapping behind `server-only`
and the test died on `Cannot find module 'server-only'`. Rather than fall back
to grepping the source, the decision was split into `lib/couple-card-to-canvas.ts`
(pure, executed by 14 tests) with the one-row fetch left behind the guard. Three
sabotages verified the tests bite: nulling the price (2 red), seeding the
business name as the title (1 red), removing the empty-seed floor (2 red).

⚠ **Flag dependency, stated rather than assumed:** `initial` is only honoured
when `NEXT_PUBLIC_CANVAS_MAKER_ENABLED` is on — the 6-step `ServiceWizard` takes
no defaults. Two independent records say it is `true` in production (a
`vercel env pull` recorded in `changelog.d/claude-card-copy-carries-its-options.md`,
and the owner in `DECISION_LOG.md` 2026-08-29: *"the 3 vercel has been long time
set to true"*). I could not read the value directly — the Vercel token has no
`projectEnvVars` permission. If the flag were off, this seeding would be inert
rather than wrong.

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md` — extends
the 2026-09-20 self-added-supplier row with (g): on claim, the couple's service
card seeds the supplier's first card — price, transport, crew, inclusions — as
editable defaults; the title, the category bundle, the address and the payment
notes are deliberately withheld.
