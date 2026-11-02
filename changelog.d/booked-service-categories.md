## 2026-08-01 · fix(vendor): a supplier can now actually READ the services on their own booking

PR #4010 taught the day-of console to derive a supplier's roles from the services on their booking
instead of the booking row's single summary category. Correct idea — **it could not read them.**

### How this was caught

By verifying **as the vendor's own identity** (`SET LOCAL ROLE authenticated` + their jwt claims)
after seeding a fixture, rather than as service-role:

```
can read their OWN vendor_services   → 2 rows   ✅
can read their OWN event_vendors row → 0 rows   ❌
```

**A marketplace vendor cannot read the `event_vendors` row that links them to the couple's event.**
So `requested_service_ids` was invisible and the read in #4010 returned an empty list — **with no
error.** An RLS denial and an empty list are the same value to the caller, so the feature would have
sat dormant looking perfectly healthy.

That is precisely why `booked_categories` works today: `get_vendor_event_brief` is `SECURITY
DEFINER`. The category was never read directly either.

### The fix

`get_vendor_booked_service_categories(event_id)` — a small `SECURITY DEFINER` function that mirrors
the brief's identity resolution (profile owner **or** team member) and its booked-stage bar
(`contracted`/`deposit_paid`/`delivered`/`complete`), and nothing else.

**Why not extend the brief.** `get_vendor_event_brief` is a large shipped function carrying the
disclosure ladder, the budget-band derivation and the dietary matrix. Replacing its whole body to add
one array is a large blast radius for a small need.

**What it exposes:** only `vendor_services.category` values on the **caller's own** booking — text
the caller authored. No couple data, no other supplier's services, no prices, no ids. A second
`vs.vendor_profile_id = ANY(v_profile_ids)` belt makes sure a stray service id cannot pull in
someone else's row. `anon` has no execute.

**Degradation is unchanged:** this feeds a *refinement* (which desks to offer), never a gate. No
booking, no services, or an outright failure → empty → the caller falls back to the booking's summary
category, which is exactly the behaviour that shipped before any of this.

### Verification

- Function **proved as the vendor's own identity in prod** (rolled back): returns
  `{host_mc, live_band}` where the direct read returned nothing.
- **Exposure baseline regenerated in this PR** — the new fact reads
  `secdef=yes exec=authenticated search_path=public`, no `anon`.
- `tsc --noEmit` **exit 0, 0 errors** · `next lint` clean · **`test:unit` 6,008 / 6,008** ·
  `lint-exposure-baseline` OK.

SPEC IMPACT: None — completes the read path #4010 intended.
