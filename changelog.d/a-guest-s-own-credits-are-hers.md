## 2026-08-31 · fix(papic): a guest's own credits are hers — the couple's ceiling stops eating them

**Owner, 2026-08-28** (`DECISION_LOG.md`, "SHOTS PER GUEST — ALL THREE DECISIONS MADE", § b, verbatim: *"both. they can claim it all or share it to everybody."*): at the moment a guest buys, **she** picks — **keep them for me** (*"their money, their shots, the couple's limit does not touch them"*) or **add them to the celebration** (into the shared pot; she reverts to an ordinary equal share).

**The choice already shipped. The gate did not honour it.** `papic-buy-shell.tsx` has offered both buttons since 2026-07-29 — "This camera only" (`one_reload`) and "Everyone's pool" (`pool_topup`) — on both live capture surfaces. This is session S5's gate half.

### The defect, read off the applied function and not off the spec

`papic_record_guest_capture` (20271184624871 § 7) metered a guest like this:

```sql
SELECT COALESCE(SUM(points_cost), 0)::INTEGER INTO v_used
  FROM public.papic_guest_captures
 WHERE guest_id = p_guest_id;
...
IF v_ceiling IS NOT NULL AND (v_used + v_cost) > v_ceiling THEN  -- refuse
```

`v_used` sums **every** capture that guest ever made, with no distinction of funding source. So a guest the couple NAMED who **also** chose "keep them for me" had the shots she paid for counted against the couple's number and was refused early. **Her own purchase was consumed by somebody else's limit** — the opposite of what she was sold.

**Why nothing caught it:** every test of that gate was written for a guest whose captures all come from the shared pot. The case only exists where the ceiling feature and the guest-buy feature MEET, and no session owned both.

### 🔎 Inert today, and that is thin

Measured against production 2026-08-31, in a rolled-back transaction: **5 events · 0 with `papic_guest_spend_ceiling_on` · 0 rows in `papic_guest_spend_ceilings` · 0 rows in `papic_guest_captures` · 0 rows in `papic_guest_orders`.** No ceiling binds on anybody yet and no live capture changes. But the BUYING half is **live** — `NEXT_PUBLIC_PAPIC_GUEST_BUY` is ON in the real Vercel Production environment. This goes wrong the day one couple names one guest who has also bought.

### ⛔ The funding source is derived, never taken from the caller

🚨 `papic_record_guest_capture` **is anon-callable** — 20271114597183 deliberately keeps its EXECUTE for `anon` + `authenticated`, so it is the one object a hostile direct caller still reaches. A `p_self_funded BOOLEAN` would be a **one-word walk through the couple's ceiling entirely**: set it on every call and no capture is ever metered. That is the defect `papic_reserve_camera_capture` was closed for (`p_limit IS NULL` ⇒ unconditional TRUE), and the ceiling migration already states the asymmetry it lives under — *"cost in, ceiling read from the couple's own table."* **The funding source is a limit-shaped fact, not a cost-shaped one.**

It is derived from two ledgers no session role can write, the same stored state `papic_reserve_capture_split` already decides the pot/dedicated split from:

```
exempt = LEAST( papic_seat_point_usage.points_used on her own camera,
                grants on that camera traceable to HER OWN papic_guest_orders
                rows of kind 'one_reload' )
```

The `LEAST` is the safety: never more than she paid for, never more than was actually spent. A `pool_topup` lands `seat_id IS NULL` and is invisible here **on purpose** — those credits *are* the pot now, which is exactly what she chose.

**🪤 The order of operations, and why both orders are safe.** The route reserves the split and *then* records, so by gate time `points_used` already carries this capture's dedicated leg while the capture row does not exist yet — which is why the arithmetic is `(v_used + v_cost) − exempt` and comes out exact. A caller who **skips** the reserve leaves `points_used` stale, so the exemption is *smaller* and the gate *stricter*. There is no ordering a caller can arrange that loosens it.

### What ships

- **New migration `20271185324597_a_guest_s_own_credits_are_hers.sql`.**
  - `papic_guest_self_funded_spend(uuid)` — the ONE definition of "her money".
  - `papic_guest_ceiling_spend(uuid, integer DEFAULT 0)` — what the ceiling actually meters. `p_extra_cost` is why it is **one** function and not two: the gate asks "what would this be after the shot in my hand?", the guest's pill asks "what is it now?", and **a counter that disagrees with the gate is its own defect**.
  - `papic_record_guest_capture` — the newest body **CREATE OR REPLACE**d. **The signature does not move**, so this is a genuine replace and not a drop-and-create: no fourth overload, no grant lost, no deploy-window rung in the route changed. (20271184624871 measured what a second overload does to this exact object against prod — `42725`, which the route's fallback ladder *matches*, silently degrading every clip to a photo.)
  - The shipped precedence is untouched: named guest → release → the couple's number → derived equal share, with the ceiling branch asked FIRST and independently of `v_unlimited`.
- **`lib/papic-guest.ts`** — `fetchGuestQuota` reads `papic_guest_ceiling_spend` so the pill shows what the ceiling meters, not every credit she ever spent. **A log line never changed a pixel; the measurement had to reach the render.** The subtraction is *not* re-derived in TypeScript — this surface has already paid for two copies of one money rule (the browser once mirrored half of `v_unlimited` and enforced a 150 the database was not applying anywhere). Falls back to the pre-fix figure on a database that predates the migration, which under-promises rather than over-promises.
- **`self_funded`** added to the RPC reply, and the ceiling refusal now reports the **pot-metered** `used` — telling a guest who bought 50 that she is 50 over a ceiling of 20 would be a correct refusal with a lying explanation.

### ⚖ What deliberately still counts, and is surfaced rather than decided

Credits the **host** hands a camera (`papic_seat_allocations` via `papic_dedicate_shots`) still count against the ceiling. They are the couple's own pot money moved onto one QR; the ruling is about *"a guest who **buys** credits"*, and this change only ever **narrows** what the ceiling eats. ⏭ **OWNER:** a couple who both name a guest at 20 and hand her camera 200 have given two contradictory instructions and the tighter one wins. If a hand-out should lift her ceiling the way her own purchase does, that is one predicate and a decision-log line — **his call, not this session's.** Pinned by a test so the boundary is on the record rather than an accident.

### 📏 The bound, stated as a number rather than a hope

Her camera can in principle also shoot through the **seat** door
(`papic_record_seat_capture` → `papic_photos`), which spends the same dedicated balance and lands no row in `papic_guest_captures`. The worst that then costs the couple is **her ceiling plus what she personally paid for, and not one credit more** — the `LEAST` is what bounds it. Pinned by a test that shoots exactly 70 against a ceiling of 20 and a purchase of 50 and asserts the 71st is refused, so an unbounded exemption cannot be slipped in later while every other test stays green.

That door is shut for this population today (`papic_record_seat_capture` needs `claimer_user_id = auth.uid()` and a guest's own camera is minted with it NULL). ⏭ **Flagged, not fixed here:** `claim_paparazzi_seat` would claim a guest-linked camera for whoever presents its `claim_qr_token` — it does not exclude `guest_id IS NOT NULL` — and nothing renders that token today. Narrowing that claim path is its own change with its own blast radius.

### Proof

- **15 new db tests** (`tests/db/papic-guest-own-credits-are-hers.db.test.ts`), values **deliberately pulled apart** — ceiling **20**, purchase **50**, **70** captures. The defective gate refuses at 21; the correct one refuses at 71. No assertion can pass for the wrong reason, and every "she is allowed" test has a twin asserting she is **refused** (the same guest without the purchase · the same guest who gave to the pot · somebody else's purchase on her camera · a host hand-out · the 71st shot). Includes the owner's own worked example — a clip costing 8 paid **2 from her and 6 from the pot** meters **six**.
- **5 new unit tests** (`lib/papic-guest-own-credits-are-wired.test.ts`) pinning the display seam and the migration's invariants from outside.
- **🛡 10 mutations, every one measured before → after, occurrence counts printed, ALL RED.**
  🚨 **Three of them were GREEN on the first run, and that is the finding worth keeping.** Deleting `purchase_kind = 'one_reload'`, deleting `g.seat_id = v_seat`, and deleting the negative clamp each left all twelve tests passing — every one of those predicates was covered only by *another* predicate in the same query, so the suite was asserting the **conjunction** and never the parts. **A predicate no test can kill is a comment with a WHERE in front of it.** Three tests were added to make each one load-bearing: a pool purchase whose grant lands on a seat (a state the product cannot yet produce, constructed by hand, because that filter is the second fence for the day it can) · her purchase sitting on a **revoked** camera while the host has handed her live one 200 · her dedicated balance spent through the other door.
  ⚠ **A fourth test failed and the DESIGN was right and the TEST was wrong** — it asserted refusal at 21 where the design gives her ceiling-plus-purchase. Rewritten to assert the bound that actually holds, and the bound written into the migration header as a number.
- **23 existing ceiling db tests still green**; 57 across the five related papic db files.
- **11,520 unit tests pass, 0 fail.** `TSC_EXIT=0`, `TSC_ERRORS=0` — and the empty tsc log was **proved to be a clean one, not an unresolved one**: a deliberate type error in the changed file produced `SABOTAGE_TSC_EXIT=2` with `TS2322` naming the real inferred signature.
- **Migration dry-run against PRODUCTION inside `BEGIN … ROLLBACK`** — transcript in the PR body. The db-test replay runs as superuser with `BYPASSRLS`, so a forgotten grant passes green there; the dry-run checked the real prod role privileges (`anon` keeps EXECUTE on the writer · both new functions closed to `anon` and `authenticated` · `service_role` holds EXECUTE · overloads stay at 1) and ran the 71-capture self-check against the real schema, leaving no rows behind.
- `check-migration-timestamps` ✓ · `lint-events-column-grants` ✓ · ugat schema-claims + concept-coverage, exposure-freeze, schema-drift and anon-table-grants-closed all green (24 tests).

SPEC IMPACT: None — no SKU, price or schema-shape change. It makes an existing owner ruling (2026-08-28 § b) true in the gate; `WHATS_NEXT_Shots_Per_Guest_SESSIONS_2026-08-28.md` § S5 already specifies it.
