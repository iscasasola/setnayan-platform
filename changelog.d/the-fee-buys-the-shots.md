## 2026-08-26 · fix(vendor-papic): a supplier's free shots finally scale with the booking fee they paid

Owner, 2026-08-26: *"photographer will buy shots or use their free shots from booking fee to upload their photos… and the owner of the event can view it as well."*

**Most of that was already his own ruling.** On **2026-07-22** he set *"points in proportion to what they paid"* — a supplier's free Papic allowance starts at **50 shots at ₱0** and rises to **200 at a ₱4,000 booking fee**, proportional in between, photos and video throughout.

## 🚨 That ruling was written, unit-tested, and called by nothing

`vendorPapicPointsForBookingFee` has existed since the ruling with **ten passing assertions and ZERO application callers** — only its own tests referenced it. Every supplier kept getting the flat tier number (50, or 70 if founder-comped) **regardless of what they paid**, and **not one test failed**, because a pure function tested in isolation passes whether or not anybody uses it.

🔑 **The same shape as a granted RPC nobody calls and a column with no writer.** It typechecks, its tests are green, and the owner's decision does nothing.

The reason was honest when written — the module's own header says the booking-fee mechanism was *"still a working doc (unbuilt)"*, so there was no fee to scale on. **`booking_fee_charges` shipped since, and nothing was watching for the reason to expire.** This is the wire.

## What shipped

- **`fetchVendorBookingFeePaidPhp`** — what this supplier actually paid for this event. 🔑 **Only `status = 'paid'` counts.** The other statuses are real and none is money we received: `pending`, `failed`, `expired`, `waived_import`, and **`waived_free5`** — the owner's own first-5-sourced-bookings-free rule, which by construction means they paid ₱0 and get the floor. **Reading a waived charge as paid would hand the free five a 200-point allowance.**
- **`allowancePointsFor(tier, feePaid)`** — the resolver, with two rules that are the whole safety of the change:
  - 🔑 **THE FEE CAN ONLY EVER RAISE, NEVER LOWER.** A founder-comped supplier sits on `ltd` (70) having paid nothing; the fee formula alone would hand them **50 and take 20 points away**. Nobody may lose an allowance they already had because a wire got connected. It is a `MAX`, not a replacement.
  - 🔑 **AN UNPROVEN FEE GRANTS NOTHING.** `null` means the read failed — never *"they paid nothing"*. It falls back to the tier's own number. This is the mirror of `fetchVendorPapicPointsSpent`, which already fails **closed** by assuming the budget is exhausted. **Neither invents generosity out of an outage.**
- **Both surfaces read the same three inputs.** `fetchVendorPapicAllowance` feeds the supplier's own on-the-day screen; the capture route decides what is accepted. Wiring only the route would have shown a supplier **"50 shots"** while the route accepted their **125th** — two screens disagreeing with no error anywhere.

🔢 **Safe by arithmetic today:** the booking fee is flag-dark and production holds **zero** fee charges, so every supplier reads `paid = ₱0` → the 50 floor → `MAX(50, 50)` = **exactly today's behaviour**. Nothing changes until the owner flips the fee on.

## 🛡 Guard `lib/the-fee-reaches-the-allowance.test.ts` — it does NOT check arithmetic

`vendor-papic-tier.test.ts` does that (5 new tests, including the comped-supplier regression). This guard asks the only question those tests cannot: **does the running product actually consult it?** Six rules, with an anti-vacuum floor.

**Mutations**, counts printed before → after: route stops reading the fee (1→0) 🔴 · fee read then dropped before `canCapture` (1→0) 🔴 · fee allowed to LOWER an allowance (1→0) 🔴 · an unread fee becomes a `0` (1→0) 🔴 · the two surfaces come apart (1→0) 🔴. Green on both clean sides.

## ⏭ Not in this PR, deliberately

- **A supplier BUYING extra shots.** The owner asked for it on 2026-08-26, but he **dropped it himself on 2026-07-18** (*"not allow upgrade +50 if it is difficult"*). Reversing an owner lock is his call to state explicitly, not something to infer from a follow-up sentence.
- **Uploading finished work** (vs capturing live on the day). Same machinery as the couple's upload — see `WHATS_NEXT_Papic_Uploads_Are_A_Way_In_2026-08-26.md` § 2. **Do not write a second capture path.**
- 🔴 The whole supplier lane is still **switched off** behind the DPO ruling (`isVendorPapicCaptureEnabled`, route 403s). This change is inert until that opens.

**SPEC IMPACT:** None — it connects an existing owner ruling (2026-07-22) that had never been wired.

---

## 2026-08-26 (same PR) · the rate is reset, and video unlocks at 800

Owner, after seeing the numbers: *"okay. this is reasonable. 800 credits will allow them to take videos."*

**⚖ THE RATE CHANGED BECAUSE THE ALLOWANCE CHANGED PURPOSE.** The 50→200-at-₱4,000 curve was sized for a supplier **documenting the day** — a handful of shots between jobs. Owner 2026-08-26: *"they can upload their work via papic credits as well per event."* A wedding photographer delivers **300–800 photographs**; 200 cannot hold a gallery. The old ceiling was sized for a job nobody is doing any more.

**The principle is unchanged and still his** (2026-07-22, *"points in proportion to what they paid"*) — only the rate and ceiling move: **one shot per ₱5 of fee paid, floor 50, ceiling 2,000.**

| package | fee collected | was | now |
|---|---|---|---|
| ₱30,000 | ₱1,500 | 106 | **300** |
| ₱50,000 | ₱2,500 | 144 | **500** |
| ₱80,000 | ₱4,000 | 200 | **800** |
| ₱250,000 | ₱6,500 | 200 | **1,300** |

🔑 **It costs us nothing that matters.** 500 kept photos are about **six centavos a year** of storage, against **₱165** if a couple bought the same 500. The gift feels substantial and is a rounding error to serve. The 2,000 ceiling stops a ₱2M booking minting twenty thousand free shots.

**🚨 AND THE VIDEO RULE FILLS A BRANCH THAT COULD NEVER FIRE.** `allowVideo` was `true` on **every** tier, so `canCapture`'s `video_not_allowed` refusal was unreachable — a rule described and enforced by nothing. Video is now derived from the **allowance**, not the tier: **≥ 800 points**, which at one shot per ₱5 is a ₱4,000 booking fee. The tier flag is still ANDed in so a future tier can veto outright, rather than deleted and silently losing that ability.

⚠ **This NARROWS video relative to the unreachable state before it** — a supplier on the 50-point floor could nominally shoot video and now cannot. **Safe by arithmetic**: production holds zero vendor captures and the lane is switched off, so nobody loses something they were using. Stated rather than buried, because it is a narrowing.

**🚨 A THIRD SURFACE WAS SHOWING THE STALE NUMBER.** `tierReadout` is the badge a supplier reads on their on-the-day page, and on the bare tier it would have said **"Papic Lite · 50 pts · photos + video"** to somebody whose real allowance is 800 photos with no video. Three surfaces now read the same three inputs: the capture route (what they GET), the capture screen's allowance, and the badge (what they READ). **Wiring any two of three leaves a supplier reading one number and getting another, with nothing anywhere reporting a disagreement.**

**Guards:** the caller guard is now **8 rules** — three surfaces, the video threshold, and the four original wire rules. Mutations, counts printed before → after: 800 threshold removed (1→0) 🔴 · video back on the always-true flag (3→2) 🔴 · badge drops the fee (1→0) 🔴, plus the five earlier. Green on both clean sides. Two pre-existing expectations were updated with the reason recorded inline, never quietly.

---

## 2026-08-26 (same PR) · a supplier sees the shots from THEIR challenge, and nothing else

Owner, ruling on whether suppliers may reach guest media at all: *"the host will allow access. they only get shots from the sponsored papic challenge."*

**🔑 THAT WHOLE CHAIN ALREADY EXISTED IN THE SCHEMA.** A supplier writes a challenge (`papic_missions.source='vendor'`), **the host approves or declines it with one tap** (the panel ships), sponsorship is recorded against what they paid, and every guest photo is already linked to the challenge it answered — **carrying that guest's own `consent_to_share` flag**. Nothing new was modelled; the access rule is a query over data we already hold.

**Measured first:** no supplier surface reads `papic_photos` or `papic_guest_captures` **at all** today, so the constraint was satisfied by absence. This ADDS a bounded capability rather than restricting an existing one.

**`fetchVendorSponsoredShots` — eight gates, each one somebody's decision:**

| gate | what it protects |
|---|---|
| `m.event_id` | this event, never another of their bookings |
| `m.vendor_id` | THEIR challenge, never another supplier's |
| `m.source='vendor'` | a supplier challenge, never the couple's own |
| **`m.approved`** | **the host said yes — this clause IS the access grant, and un-approving is the revoke** |
| `m.is_active` | a retired challenge stops feeding |
| **`mc.consent_to_share`** | **the guest said yes, per photograph** |
| `c.hidden_at IS NULL` | the couple's own take-down is honoured |
| `c.moderation_state='clean'` | the safety screen passed it |

🔑 **THE SCREEN CHECK IS AN ALLOWLIST, NOT A DENY-LIST**, and that is deliberate: two of the five states in that column (`consent_withheld`, `faceblock_withheld`) are filtered on elsewhere in the app and **written by nothing**. A deny-list lets through every state nobody thought of — including `unscreened`.

⚠ **SERVICE-ROLE READ, SO THE APP-SIDE GATE IS THE WHOLE FENCE.** RLS is a floor, not a scope; there is no policy underneath to catch a dropped clause. Losing any one gate silently widens this from *"the photos guests took for your challenge"* to *"the couple's gallery"* — the exact shape that has cost this project three times (an admin posting into any private samahan, a shop reading every other shop's correction requests, a coordinator served the whole album).

⚠ **A failed read returns `ok: false` and an empty list, and the strip SAYS SO.** *"We couldn't load your challenge photos just now — this isn't a sign there are none."* Telling a supplier their challenge produced nothing when we simply could not look is the same lie as an unread count rendered as zero.

🪤 **A bug caught before it shipped:** `displayUrlForStoredAsset` is **async**, and the first cut called it inside the render map — which would have put a Promise into `src` and rendered **nothing, silently**. `r2://` refs are not URLs, and an unresolved one fails as an empty frame with no error. This repo has paid for that across sixteen surfaces.

**🛡 Guard `lib/vendor-sponsored-shots-are-scoped.test.ts`** — 11 rules: an anti-vacuum floor, one per gate with the specific harm named in its failure message, the allowlist rule, and the failed-read rule. **Six mutations**, counts printed before → after — dropping the vendor gate (1→0), the host-approval gate (1→0), the guest-consent gate (3→2), the screen gate (1→0), the take-down gate (1→0), and a failed read pretending success (1→0) — **all red**. Green on both clean sides.

**Mounted** on the supplier's existing on-the-day Papic page, grouped by challenge prompt, rendering **nothing** when there is nothing — a supplier without an approved challenge never meets an empty frame implying photographs sit behind it.
