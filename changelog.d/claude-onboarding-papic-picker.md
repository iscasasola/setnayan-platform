## 2026-08-11 · feat(onboarding): the Papic services step becomes a picker — pick your shots and cameras, pay after

Owner, this session: *"how many shots do you want for this event? 50 - Free … then they can
press + and minus. which will set how much they will pay. Or papic one (pick how many papic
one) they want to add. so this can be their paywall for the onboarding. can add more later."*

**RULE 0 first — almost none of this was new.** The screen already ships
(`app/onboarding/_shared/services-step.tsx`, live on all three flows). The − / + stepper with a
running total already ships too, on `/pricing` (`_papic-estimator.tsx`), display-only. The whole
apply-then-pay Papic purchase machine already ships (`purchasePapicPoolTopUp` ·
`purchasePapicOneCamera` · the guest buy path). What was missing was the JOIN: the onboarding
card *informed*, it never *asked*. Nothing was redrawn.

### It asks, it does not block

Paying is a bank / GCash transfer a human reconciles — up to 24 hours. A step that refused to
finish until the money landed would lock every new couple out of their own dashboard overnight.
So the free floor is always a complete, finishable answer; the order is minted **alongside** the
event, never in front of it, and the couple lands on their Papic studio with its existing payment
banner. Buy nothing and it is the ordinary dashboard landing, unchanged.

### + and − walk the ladder, not single shots

There is no SKU for an arbitrary shot count — the Pool sells whole blocks. A free-running counter
would display a quantity that cannot be ordered, priced or granted. So a step IS a rung: step 0 is
the free grant alone, each + adds the next live rung, and the free grant is ADDED to every step
rather than replaced by one. A rung an admin retires shortens the ladder instead of putting an
unbuyable step in the middle of it. All of that arithmetic is pure and unit-tested in
`lib/papic-onboarding-selection.ts` (21 tests).

### 🔴 The database only allowed ONE camera per order

"Pick how many Papic One" has to mint ONE order with ONE reference code — N orders would hand a
brand-new couple N separate bank transfers. `papic_one_orders.order_id` was the PRIMARY KEY, so the
second camera was refused outright (`23505`). Migration `20271128697126` widens the key to
`(order_id, seat_id)` and makes `papic_grant_camera_points` iterate every row instead of reading
one — which is now load-bearing, since with several rows and the old single-row read the cameras
after the first would be provisioned, paid for, and funded with nothing.

⚠ **A correction is recorded in the migration itself.** The first draft claimed the function had a
silent multi-row bug. It did not — the single-row read was correct for a table whose key permitted
one row. The database was REJECTING, not miscounting. Writing the test first is what caught it.

🚨 **And the first draft silently reverted a security fix.** It was written against the function's
ORIGINAL definition (`20271019231590`) and so dropped the 2026-08-06 cross-event guard added in
`20271114597183` — `CREATE OR REPLACE FUNCTION` replaces the whole body. Only
`papic-camera-grant-authz.db.test.ts`'s source assertion caught it. **Before replacing a function,
find the LAST migration that defines it, not the one that created it.**

### Guarded

- `papic-one-multi-camera-grant.db.test.ts` — 6 tests, **mutation-tested**: reverting the loop to
  the single-row read turns 3 of them red, including the headline one.
- `papic-onboarding-selection.test.ts` — 21 tests over the ladder, the clamps and the untrusted
  parse boundary.
- The controls render **only** where the mount passes `selection` + `onSelectionChange`, i.e. only
  where the commit actually carries the pick through to an order. The wedding and `simple` flows
  keep today's read-only ladder until their commits are wired — a stepper that changes a price and
  charges nothing is a fake door.
- SEC-4 holds: the browser posts service_codes and a count and **no amount**. Every rung is
  re-resolved from the live tier tables and every price from the ACTIVE catalog server-side, with
  `is_active` checked before an order exists.
- The camera order **fails closed**: if fewer seats are provisioned than were bought, the order is
  cancelled rather than left standing as a charge we cannot fulfil.
- Order minting is **non-fatal by contract** — the event and both free grants are committed first,
  so nothing here can cost a couple their event.
- The purchase intent is deliberately **not** persisted into the localStorage draft: a resumed
  draft must not silently still be buying the biggest pool from a session days ago.

### Reverses two owner locks, at the owner's instruction

The 2026-06-21 *"no paywall in onboarding"* ruling and the 2026-07-27 *"Papic informs, never sells /
NO checkout in onboarding"* ruling. The rest of both stands: `PAYWALL_SCREENS` in the wedding shell
is untouched and the retired bundle / à-la-carte tail stays out of the funnel. What comes back is
ONE product's ladder, on the screen that was already showing it.

## 2026-08-11 · feat(papic): the Pool ladder runs to 30,000, and Papic One has ONE price

Two owner decisions the same session, both applied to the picker above.

**Pool — nine rungs.** Owner: *"so for papic pool, it will be 3000, 6000, 10000, 13000, 16000,
20000 23000, 26000, 30000"*, at ₱1,000 per step (owner-confirmed against the three already live).
The shape is the existing 3k/6k/10k block repeated three times, so ₱3,000 buys 10,000 credits at
every point on the ladder — this **lengthens** it, it does not reprice it. The three live rungs are
untouched. Migration `20271129155172`.

🔑 **The picker needed NO code change** — `poolStepCount` is derived from the rung list, so the
stepper walks whatever the catalog resolves to. Proved with a nine-rung case rather than asserted.
Adding a rung is a migration and a hook line, nothing else.

**Papic One — one price.** Owner: *"…remove the 100 pesos. let's just have one price for papic one."*
then, correcting himself minutes later: *"sorry. my mistake. it should not be 100 for 50 pesos. it is
**150** papic credits for 50 pesos."* Supersedes the 2026-07-29
two-rung ladder **and** the flat "₱1 = 1 shot" rule with it. Rate moves ₱1.00 → ₱0.333 per credit — now within ~11%
of the Pool rather than 3×, so a dedicated camera costs essentially what the shared pot costs and
the small premium is all that is charged for "unshared, with its own QR". A reload is
the same rung at the same price; there is deliberately no separate reload SKU. Migration
`20271129422037`. The picker's size chips vanished on their own (they only render above one rung).

🔑 **A NEW CODE `PAPIC_ONE_150` WAS CUT; BOTH OLD RUNGS RETIRE.** The first draft reused
`PAPIC_ONE_100` — right while the figure was 100, wrong the instant it became 150, because it would
have left a stored value whose NAME states a different number from the one it holds. Same failure
that forced the `sponsored_included` rename. **When the number in a code's name changes, cut a new
code.** ✅ Retiring both was verified safe against PROD, not assumed: zero `orders` rows on
`PAPIC_ONE_100`, `PAPIC_CAMERA_MINI_DAY` or `PAPIC_CAMERAS`, and `papic_one_orders` empty.

🔒 **`PAPIC_CAMERA_MINI_DAY` is deactivated, NOT deleted, and is still load-bearing** — the legacy
multi-camera grant reads it, and every 'mini' seat is stamped with it as a `sku_code`. Its constant
was `PAPIC_ONE_50_SKU`; renamed to `PAPIC_ONE_LEGACY_MINI_SKU` because "50" is now the PESO figure
of the *surviving* rung, so the old name pointed at the exact opposite of what it meant. Both
retired codes keep their activation hooks so any pre-existing order could still convert.

⚠ **The Papic One migration's FILENAME says `hundred_credits` and is wrong** — the correction
arrived after the file was allocated, and an applied migration's name can never be edited. The
correction is at the top of the file that does the work. **Trust the SQL, never the filename.**

### 🚨 The thing that would have silently taken ₱9,000 and granted nothing

`activateOrderSku` dispatches on an EXACT `service_key` map and ends `if (!hook) return; // default
no-op`. A rung that is live in both tables but **absent from that map** is fully purchasable and
grants **zero** credits: the couple pays, an admin approves, the order goes `paid`, and the pool
stays empty. Nothing throws, nothing logs, no alert fires — a no-op is the *designed* behaviour for
a key that owns no capability. The migration alone would have put six unfunded rungs on sale.

🛡 `papic-rungs-are-fundable.db.test.ts` (7 tests, **mutation-tested** — deleting one hook line
turns it red) now spans the gap: replayed migrations for what is SELLABLE, module source for what
is FUNDED. Neither half can see this alone. It also pins the owner's exact ladder, pins Papic One
at exactly one rung, and proves the legacy grant still funds its seats now that the MINI rung is
inactive.

🪤 **The migration failed on first replay** — `papic_pass_tiers.service_code` has a foreign key to
`platform_retail_catalog_v2`, so the catalog rows must be inserted **first**. Caught by the PGlite
replay, which is the only place that ordering is exercised before a deploy tries it on prod.

⚠ Two shipped tests were **correctly failing** because they encoded the superseded rules (the
three-rung Pool, and "₱1 per photo on both rungs"). Updated to the new rules with the reason
recorded inline — not weakened, and each gained an assertion it did not have before.

SPEC IMPACT: applied — `DECISION_LOG.md` rows for 2026-08-11 (the picker, the nine-rung ladder, the
Papic One single price); `Onboarding_Papic_AI_Cards_BUILD_SPEC_2026-07-27.md` § 3 Card 1 ("Action:
none. The card informs.") and its § 0 rung/rule table; `Papic_Promotion_Surfaces_BUILD_SPEC_2026-07-29.md`
§ 1; `WHATS_NEXT_Card_Family_Handoff_2026-07-29.md`.

## 2026-08-11 · feat(onboarding): Setnayan AI can be bought on the same screen, as its own line

Owner asked how to strategise Papic One and Setnayan AI *"so the papic and setnayan AI can be
costed at the beginning so they can purchase it instantly"*, then confirmed the split: *"yes it can
be just 50 and 499."*

**Setnayan AI is now a tick on the services step**, off by default, joining a single commit. What
was missing was only the ability to say yes there — the card already showed the price and pointed
at the studio.

✅ **Checked, not assumed: per-event-type AI pricing is ALREADY LIVE in prod**
(`platform_settings.setnayan_ai_per_event_pricing_enabled = true`). ₱1,499 is the WEDDING figure;
most types already resolve to ₱499, the lightest to ₱99, and a vendor-free type is not offered it
at all. The onboarding card was already showing each couple their own correct number — verified
before writing anything, because the opposite would have been a live defect on the screen we were
turning into a paywall.

### 🚨 The trap that would have overcharged every non-wedding couple

The two Papic branches in the order minter read the flat catalog row directly, and that is
**correct for them** — it lets a retired rung be rejected before an order exists. Doing the obvious
thing and reusing that helper for Setnayan AI would have billed the **wedding** price to every
birthday, debut and christening — ₱1,499 instead of ₱499, on their very first order, with the order
row looking perfectly well-formed. AI is priced through `resolveOrderChargeCentavos`, the single
authority that applies the per-type override and re-reads the event's **stored** type so a tampered
payload cannot pick a cheaper tier. `services-step-data.test.ts` now pins that asymmetry and is
**mutation-tested** — swapping the AI branch to the catalog helper turns it red.

### Two lines, never one number

Papic and the planner are shown separately and only summed at the end. On most event types Papic is
a few tens of pesos and the planner several hundred; one blended figure reads as though Papic is
what got expensive. `quoteServicesStepSelection` returns `papicPhp` and `aiPhp` alongside the total
so the screen cannot accidentally conflate them.

🪤 **`Boolean('false')` is `true`.** The simple-event flow posts this as a form field, where every
value is a string, so the parser accepts only a genuine `true` / `'true'`. A naive coercion would
have left the planner permanently ticked and silently billed every one of those couples. Pinned by
a test that walks `'false'`, `'0'`, `''`, `'yes'`, `1` and a missing field.

🔒 **No price and no tier ride on the selection** — only a yes/no. A test asserts the object has
exactly four keys, so a future "helpful" addition of `aiPricePhp` cannot slip in and become
something a tampered payload gets an opinion about.

♻️ **Renamed for honesty:** `PapicSelection` → `ServicesStepSelection`, and its module and the order
minter with it. The object now carries something that is not Papic, and a type named for one of its
two contents is the same naming lie this session already corrected twice.

SPEC IMPACT: applied — `DECISION_LOG.md` 2026-08-11 row for the AI tick and the per-type finding.
