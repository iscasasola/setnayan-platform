## 2026-07-21 · fix(papic): the guest-camera gate must recognise all four Papic One rungs

**The bug.** Migration `20270828140000` turned the flat pass into three purchased point buckets plus
a top-up — but `eventPapicGuestActive()` still checked only `PAPIC_GUEST`. **A couple buying the
6,000- or 10,000-shot rung would have been granted their points and gotten no cameras.** This is live
on `main` right now; the gate now checks all four via `PAPIC_PASS_SERVICE_KEYS`.

**No date gate — the pass runs until the POINTS are depleted** (owner 2026-07-21).

A `service_date` column and a date-aware gate were built and **removed before merge**. The reasoning
is worth keeping, because it will look like an omission later:

- **Points are already the bound.** The fail-closed pool RPC refuses at zero, so a date gate is a
  second fence around something already fenced. The exposure that motivated dates — "the pass never
  closes" — is bounded by construction anyway: N unused points is at most N more captures, whenever
  they happen. Time was never what contained it.
- **It is the only model that survives a multi-day event.** `travel` is `multi_day = TRUE` by
  definition, and a ten-day trip must not need ten purchases. Per-day scoping breaks there; points
  don't.
- **It matches the rest of the design.** We settled on purchased buckets — you buy N shots and get N
  shots. Days were the one place that model didn't hold.

If the pass ever does need to close, tie it to the **retention window** — it shuts when the gallery
does — rather than a per-day picker. Recorded in the `PAPIC_PASS_SERVICE_KEYS` docblock so the next
session doesn't re-derive it.

Multi-date events need nothing further: several purchases stack into one pool, and every capture from
every date already lands in **one album** because photos key to `event_id`, never to a purchase.

No migration. No schema. One gate fix.

SPEC IMPACT: `0012_papic/Papic_Pricing_Lock_2026-07-20.md` § 2.3 — points-until-depleted recorded as
the pass lifetime; the service-date model is explicitly NOT adopted.
