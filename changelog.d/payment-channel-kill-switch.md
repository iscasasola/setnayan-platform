# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-08-01 · feat(payments): per-rail kill switch + monthly receiving-cap meter

Owner 2026-08-01: no business account yet, GCash's limit is **₱500,000/month**, and *"i need a button to turn off the gcash once my gcash hits the limit for that month."*

**Why this is a real hazard, not housekeeping.** Setnayan receives on **personal** GCash and BDO accounts. A personal GCash wallet has a monthly *receiving* limit, and past it incoming transfers **fail rather than queue** — with no warning inside GCash's own flow. Without this, the first signal is a couple reporting a bounced payment after they have already paid.

**Changes**

- **Migration `20271028100000`** — `gcash_enabled` / `bdo_enabled` (default TRUE, so applying changes nothing) and `gcash_monthly_cap_php` / `bdo_monthly_cap_php`, seeding GCash at ₱500,000. The cap is a **column, not a constant**: it is a bank policy that changes without asking us.
- **`lib/payment-channels.ts`** (new) + **14 tests** — `openChannels` / `resolveChannel` (the shared decision the UI *and* the server both run) and `capUsage` / `capMessage`. Bands escalate at **75% / 90% / 100%**, deliberately early: one ₱27,999 order can cross the last 10% of a ₱500,000 cap in a single step, and a meter that reddens only once you are over is a report, not a warning.
- **Server enforcement** in `submitOrderAction` — a posted channel that is closed is **refused**, not silently rebooked onto the other rail. The couple is looking at the QR and account details for the rail they picked; quietly moving them would mean paying the wrong destination.
- **Checkout** hides closed rails, re-selects an open one if the owner closes the rail mid-session, and when **both** are closed replaces the payment panel with an honest "payments are paused" notice and disables submit.
- **Admin** `/admin/settings/payment-methods` gains a switch + cap field + rolling-30-day meter per rail.

**Fail-open, deliberately.** A missing column or a failed read defaults to **enabled** (`?? true`, riding the same soft probe as the QR payloads — see #3968). A transient read error must never silently close checkout. The opposite default would take payments down on a hiccup.

**Both rails off is allowed**, and is not a bug: if both accounts are at cap, paying into either fails at the bank. An honest pause beats a working-looking button.

**Bug caught before shipping:** the meter query was first written against `status = 'approved'`. There is **no such value** — the enum is `pending | matched | rejected | resubmit_requested`, and `approvePayment` writes `'matched'`. It would have returned zero rows forever while rendering a reassuring **0%** meter — the exact "an empty read is not a safe read" trap.

⚠ **The meter counts Setnayan orders only.** The cap applies to everything the account receives, including the owner's personal transfers, which we cannot see. Every band's copy says so; the figure is a **floor**, never the true total.

Not touched: `components/billing/ManualCheckoutModal.tsx` also picks a channel but has **no live callers** — left alone rather than editing dead code.

SPEC IMPACT: `DECISION_LOG.md` — row for the personal-account receiving cap (₱500,000 GCash), the per-rail kill switch, and the fail-open contract.
