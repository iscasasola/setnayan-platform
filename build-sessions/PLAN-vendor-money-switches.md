# PLAN · The two money switches get an off-button

> **Vendor dashboard session · 2026-09-22 · PLAN ONLY — no branch, no commit, no code.**
> Launched by the REDESIGN CONTROLLER or not at all.
> ⚠ Every claim below was measured against `origin/main` and prod on 2026-09-22. Re-measure before
> acting; a plan is not evidence.

## The problem, in one line

Two switches can refuse or forgo money, and **neither has an off-button outside SQL**:

| switch | what it does | where it lives | editable in the console? |
|---|---|---|---|
| `fee_unlocks_event_enforced` | locks a supplier out of a wedding until the booking fee is paid | `platform_settings` | **no** |
| `booking_fee_free_from` / `_until` | waives every booking fee opened inside the window | `platform_settings` | **no** (shipped in #5873) |

Both were turned on/created today. If a promotion has to stop on a Saturday, it currently needs a
database client.

## RULE 0 — what already exists

**The page is already built.** This is the correction that shrank this job; I had told the
controller it was a new admin page joining four registries, and that was wrong.

```bash
git grep -n "booking_fee_rate_pct" origin/main -- 'apps/web/app/admin/**'
```

- `apps/web/app/admin/pricing/_components/booking-fee-form.tsx` — a live form with three inputs
  (`booking_fee_rate_pct`, `booking_fee_tier1_limit_php`, `booking_fee_tail_rate_pct`), a live
  preview (*"A supplier is billed…"*) computed from what is typed, worked examples at ₱60k / ₱300k /
  ₱1M / ₱10M, and an `inverted` warning when the tail rate exceeds the head rate.
- `apps/web/app/admin/pricing/_surfaces/pricing-surface.tsx` — reads the fee columns.
- `apps/web/app/admin/pricing/price-control-actions.ts` — the writer.

**So: no new page · no new route · no nav row · none of the four registries a new admin page joins ·
no `MODEL_CHOICE_CAP` +1.** The guards that enforce those never fire, because nothing new is mounted.

## The delta

Four files, all inside `admin/pricing/**`, plus one new pure module and its test.

1. **`booking-fee-form.tsx`** — a second fieldset under the existing schedule fields:
   - `booking_fee_free_from` · `booking_fee_free_until` (two `datetime-local` inputs)
   - `fee_unlocks_event_enforced` (a checkbox)
   - a live status line built from the pure module, in the same voice as *"A supplier is billed…"*
2. **`pricing-surface.tsx`** — +3 columns in the existing `select`, passed as props.
3. **`price-control-actions.ts`** — a new action beside the schedule one, following its shape
   exactly (validate → read prior → no-op if unchanged → update → **audit row** → revalidate).
4. **NEW `apps/web/lib/free-window-status.ts`** — the pure module (below).

`apps/web/lib/booking-fee-free-window.ts` already exists from #5873 and is reused, not duplicated —
`isBookingFeeFreeWindowActive` stays the one rule for *is it open*.

## The pure module — `free-window-status.ts`

The admin form needs a question the runtime rule does not answer: **is this pair of dates a sensible
thing to save, and what will it do?**

```ts
freeWindowStatus({ from, until }, now) →
  | { kind: 'off' }                          // both blank — the off state
  | { kind: 'inverted'; message }            // end before start — REFUSED
  | { kind: 'scheduled'; startsIn }          // set, not started
  | { kind: 'running'; endsAt | null }       // open right now
  | { kind: 'ended'; endedAt }               // set, already past
```

Pure, no clock of its own (`now` is passed), so a guard executes it.

⚠ **`inverted` is modelled on the precedent already in this file.** The schedule writer refuses a
tail rate above the head rate, and the refusal explains the *consequence* — *"that would charge more
for being honest about a bigger booking."* An end before a start is the same class: it looks like a
promotion and can never be open. The SQL already treats it as closed (a db-test pins that), so this
is not a second rule — it is the form refusing to save something the database would silently ignore.

### The test, and the sabotages to watch go red

`lib/free-window-status.test.ts` executes every arm. At least these three watched red before the
commit stands:

1. make `inverted` return `scheduled` → the refusal test goes red (a nonsense window saves silently)
2. make `ended` report as `running` → the status test goes red (the console says a finished
   promotion is still giving money away)
3. drop the `admin_audit_log` write from the action → the audit test goes red

## 🔑 The feature worth building that nobody asked for

**Show the blast radius before the switch is flipped.**

Before turning the lock on today I ran a count of unsettled charges, because flipping it with
someone mid-booking would have shut them out of a wedding. That check should not depend on whoever
happens to be at the keyboard. The enforcement checkbox should carry a live line:

> Turning this on locks **0 suppliers** out of an event right now.
> *(2 charges on record · 0 unsettled)*

Re-measured from `booking_fee_charges` on render. If it reads anything but zero, the console has
named the people it is about to affect **before** the click, not after.

Same for the window: *"Opening this window waives the fee on every booking agreed from now until
30 November."*

## Traps on this ground — measured, not remembered

- **`lint-vendor-layout-revalidate.mjs` scans RAW SOURCE and does not strip comments.** The existing
  action carries a long note about which revalidate call it deliberately does *not* make, written
  without the literal call, because quoting it even in a comment re-trips the guard. Do the same.
- **The writer audits.** `admin_audit_log` gets an `action` + `before`/`after` metadata row on every
  schedule edit. A money switch with no audit trail is the gap this plan exists to close — both new
  switches write one, with their own action names.
- **Revalidation is narrow and justified.** The existing action explains, in measured terms, why it
  busts `/vendors` and the booking-fee path and *not* the vendor shell. The window changes what a
  supplier is told on the Agree button (`promo_window` standing, #5873), so its revalidate set is a
  real question to answer with a grep, not to copy.
- **Prod is read-only for this session.** The plan is written from `select` only.

## Collision surface — for the controller

| path | who else is here |
|---|---|
| `apps/web/app/admin/pricing/**` (4 files) | nobody in the Redesign group |
| NEW `apps/web/lib/free-window-status.ts` (+test) | nobody |

`#5867` is in `apps/web/app/signup/actions.ts`; it is not in `admin/pricing`. No migration, no SKU,
no price change, no Ugat node, no new route — so no generated baseline is touched either.

**This is the cheapest thing in my queue and it collides with nothing.**

## Open — the owner's, not mine

1. **Should the free-fee window be announceable to suppliers?** Today a supplier learns the fee is
   waived only when they open a quote. A banner is a separate build; say if it is wanted.
2. **Should turning enforcement ON be refused while any charge is unsettled**, or only warned about?
   Recommendation: warn and show who, do not refuse — the owner may have a reason.
3. **Does a window need a reason field** (`"launch month"`, `"Christmas"`) for the audit row to be
   worth reading in a year? Recommendation: yes, one free-text line.

## What this plan does NOT cover

The chatbox kit and the quote-maker kit both land in the supplier chat thread and its tool registry.
Neither is in this plan, both are contested between sessions, and both are the controller's to
assign. See the two sequencing reports sent 2026-09-22.
