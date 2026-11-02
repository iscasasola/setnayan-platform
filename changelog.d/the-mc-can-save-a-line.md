## 2026-08-29 · fix(vendor): the host/MC can save a line — the fourth site of one dead gate

Every attempt to save a run-of-show cue answered **"You are not booked on this event"** — for every
shop, always. The composer, the library, the whole Script tab: dead since it shipped.

**The cause is the one repaired three times on 2026-08-28.** The gate ran on the vendor's own
session. Measured against production as the shop's own authenticated role, in a rolled-back
transaction: `event_vendors` carries four policies — couple read, couple write, moderator read,
moderator write — and **not one admits a vendor**. A shop genuinely booked reads **zero rows** of
its own booking. Nothing throws: `maybeSingle()` on an RLS refusal returns `{ data: null }`,
byte-identical to *"you are not booked here"*.

**Why it waited a day, and what changed.** It was named-not-fixed because the writes *behind* the
gate also run on the session — and repairing a gate whose downstream is equally shut just moves the
silence one statement later. That is now **measured rather than assumed**:

| | |
|---|---|
| `event_schedule_blocks` | carries `event_schedule_blocks_booked_vendor_read` ✅ |
| `vendor_block_scripts` | `FOR ALL` on `current_vendor_ids()` ✅ |
| `vendor_lines` | `FOR ALL` on `current_vendor_ids()` ✅ |

…and every real shop satisfies `current_vendor_ids()`, because `/open-shop` seeds a **founding admin
seat** on registration. **Proved end to end in a rolled-back transaction against production**: with
that seat present, the caller reads the blocks and the script upsert lands.

⚠ **Two alarms of my own were wrong on the way, and both were corrected by measuring rather than
reasoning.** A shop owner with **no team row** does exist — so `current_vendor_ids()` returned
nothing and 15 policies would have denied them their own data — but that shop is a **seeded
fixture** that never went through registration, and the real published shop has its seat. No live
shop is affected, and the 15 policies are fine.

**The repair uses the SAME helper as the other three**, now exported, rather than a fourth copy —
every copy of a rule is a copy that can be fixed alone and drift. The status floor stays this
action's own, because the shared resolver deliberately carries none: a handover and a change order
are raised at stages a cue is not.

🛡 Its line in the class guard's exemption list is **deleted** (the guard fails on a stale
exemption, by design) and the file joins the *repaired sites stay repaired* list, so a regression
says which one.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-29. One named-not-fixed item remains from that sweep — the
manpower open-gig list.
