## 2026-10-02 · fix(root-map): waves 2 + 3 — "same fact shown twice" 12 → 0, "numbers typed in" 45 → 0

Every line was opened and decided against the code; the Root map baselines shrink
by exactly those 57 lines (+1 report-only "words" line that the same edits fixed)
and nothing is added.

**Wave 3 — numbers that looked live but were typed in (45 → 0).** Each is now read
from the thing that decides it, or leaves the text. Only two labelled sample lines
are allowlisted (below).
- Read from their rule: Most Booked / Top Pick "top N%" (the percentile floors the
  badge is awarded at) · payout stage split + BIR rate (`PAYOUT_STAGE_PCT`,
  `BIR_WITHHOLDING_BPS`, which `planPayoutStages` now also pays by) · social publish
  gate and pull window (`SHARE_PUBLISH_GATE_DAYS`, `SHARE_PULL_WINDOW_HOURS`) ·
  low-pool threshold (`POOL_METER_LOW_PCT`) · "the first N photos" (the loader hands
  `ARRANGEMENT_POOL_CAP`) · range span (`MAXSPAN`) · editorial media cap
  (`MAX_PER_TYPE`) · custom-plan base seats/photos (`CUSTOM_BASE`) · Papic floor ·
  the 90% reply spread (`REPLY_SPREAD_PCT`) · the "0%" commission figure
  (`COMMISSION_PCT`, beside the one promise).
- New `lib/rule-constants.ts` for rules no table holds: refund report window,
  error-log retention (the Privacy notice), the comp-grant co-review threshold
  (now ONE number for the action and the form's hint), and the date-change answer
  window (re-exported from `lib/date-change.ts`, so the Maker's panel does not pull
  that module into its first load).
- Number left out of the words: ₱30,000 coordinator anchor, "3 guest seats", the
  236,000-couples statistic, "284 days to go" on the download mock, "20%" battery
  default, the typed `₱8,000` / `−15%` / `0.2 kg` examples, and the 10-note limit
  (the database holds it). "0% while we launch — and we never hold a peso" is gone
  from the supplier get-paid row: it is the launch-window promise
  `lib/commission-promise.ts` bans.
- Two labelled SAMPLES are allowlisted, each with its reason (`RULE_CONSTANTS` in
  `lib/ugat/scan-shown-values.ts`): the Voice-match preview's fixed example sentence
  and the Add-a-service explainer's "A sample card" price line.

**Wave 2 — the same fact shown twice (12 → 0).**
- **Home:** `lib/home-facts.ts` works days-to-go · coming · no reply · Paid / Still
  owing out ONCE. The page calls it; the first screen draws it; the dashboard below
  is handed `daysOut` + the guest counts + the resolved money instead of re-deriving
  them (it no longer reads the guest list a second time or resolves the money a second
  time). `daysUntil` moved to the lib. One read — `lib/budget-live-read.ts` — now
  serves Home and the Merkado budget lens. `MeasuredGuests` carries its own `stats`
  (`unmeasuredGuests()` is the one shape for "not read").
- **Guests:** the roster's RSVP words are one list (`RSVP_ROW_WORDS`) instead of four
  copies; the page takes the read's counts instead of recounting.
- **Customers:** the Bookings queue under the roster stopped restating days to go
  (it showed "in N days" from the server's midnight, which disagreed with the
  roster's Manila day near midnight); it keeps the plain date.
- **Words that collided with a calculation:** "dates coming" → "dates ahead",
  "locked in" on a milestone line / "unlocked in chat", and the post-event road's
  "days to go" at past milestones → "days before the day".

Tests: `lib/root-map-waves-2-3.test.ts` (move the input, the output moves, for each
number made live, plus a sabotage that types each literal back and watches the scan
find it); `home-numbers-move.test.ts` now runs the real `homeFacts` chain, and the
Home guards pin that the page and the dashboard no longer recount.

SPEC IMPACT: None
