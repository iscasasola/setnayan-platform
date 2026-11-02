## 2026-09-03 · feat(live-studio): one unlock per event, and the broadcast day stops existing

Owner ruling 2026-09-02: "live studio is 2500 per event", "unlock once per
event, unlimited streams, unlimited video link upload", "i want the mixer and
the integration to be one in price". This retires the per-event-day model
Wave 7 shipped on 2026-07-25 (and the ₱1,500/day reprice from earlier the same
day as this ruling, migration `20271192082215`).

Both halves ship together, deliberately — the catalog reprice alone would have
been WORSE than doing nothing: a couple paying "per event" who lost multicam a
day after first go-live, the page saying one thing while the code did another,
on a wedding day.

- **Catalog** (migration `20271194920190`): `LIVE_STUDIO` → ₱2,500,
  `billing_period = 'one_time'`. `LIVE_STUDIO_HOSTED_CHANNEL` (the separate
  "Setnayan runs the channel" upsell, kept separate per the owner's same-session
  ruling) is **deactivated**, not repriced — it was priced to sum with
  `LIVE_STUDIO` into "₱3,000 total for the hosted option," that pairing broke,
  and no replacement figure was given. Zero orders existed on either SKU at
  deactivation, so nothing is stranded.
- **The window itself** (`lib/live-studio-window.ts`, `lib/live-studio-window-server.ts`):
  `decideBroadcastWindow` collapses to `owned ⇒ multiCam, forever` — no anchor,
  no fold, no expiry, no never-interrupt rule (nothing left to interrupt), and
  no founder/comp/internal/promo METERED-vs-UNMETERED grant-kind split (every
  route to ownership already gets the same permanent answer now).
  `foldWindowEnd`, the day-stacking fold, `GrantKind`/`classifyGrant`, and the
  "Add another day" purchase path (`ADD_A_DAY_LABEL`, the controller's inline
  checkout drawer) are deleted, not hidden. `panood_control_state.first_live_at`
  keeps being stamped — it is now a purely informational "first broadcast" fact
  (still read by the unrelated legacy flag-off watermark model), no longer an
  entitlement anchor.
- **Pool-channel reclaim** (`lib/live-studio-roam-provision.ts`) no longer
  borrows its grace period from the retired broadcast-day constant
  (`PANOOD_WINDOW_HOURS`, `lib/panood-watermark.ts`) — it now owns
  `POOL_CHANNEL_RECLAIM_GRACE_HOURS` (same 24h value, its own name and
  reasoning), since reusing a constant whose meaning was retired would have
  been a second, disagreeing source of truth wearing the first one's name.
- **The controller strip** (`broadcast-window-strip.tsx`) keeps ONLY the
  12-hour YouTube archive-cap warning — a per-stream technical limit,
  unrelated to how Live Studio is billed. The day-countdown, the "we will not
  cut you off" reassurance, and the unanchored-day notice are gone with the
  clock they described.
- **Every "per day"/"per event-day" surface rewritten**: the catalog
  description, `lib/llms-txt.ts` (×2), `lib/llms-txt-guard-input.ts`'s fixture,
  `lib/help.ts`'s Live Studio article, `LEAD_TIME_NOTICE`
  (`lib/live-studio-readiness.ts` — "your unlock covers the whole event, no
  day to start, no clock to burn" replaces the retired first-go-live anchor
  promise), and a stale "Coverage: One event-day / Add a day per event-day"
  stat on the free single-camera setup page
  (`studio/panood/setup/page.tsx`) that had been describing the FREE tier as
  day-limited, which it never was post-Wave-7.
- **`live-studio-control/page.tsx`**: the hosted-channel upsell section is now
  hidden entirely when the add-on is off-sale and not already owned
  (`getCustomerSkuPriceLabel` as the on-sale probe — `formatV2Sku` does not
  filter on `is_active`) — otherwise a couple could open a working-looking "Add
  hosted channel" checkout sheet for a SKU the generic retirement guard
  (`checkout/actions.ts`) only refuses at submit time.
- New guard `lib/live-studio-unlock-never-expires.test.ts` (canonical
  `lib/strip-comments.ts`): an event owned long ago still gets `multiCam` today
  (nothing in the resolution chain reads a clock any more), no non-test surface
  under `app/`/`lib/` says Live Studio is priced per day, and the reclaim grace
  period is still a named, imported constant.

Tests: `pnpm test:unit` 12,124/12,124 pass. Rewrote
`lib/live-studio-window.test.ts`, `lib/live-studio-window-server.test.ts`,
`lib/live-studio-lead-time.test.ts`,
`lib/live-studio-roam-reclaim-guard.test.ts` for the new model; updated
`apps/web/tests/db/family-discount-matches-the-catalog.db.test.ts` (LIVE_STUDIO
is now `one_time`, its retired siblings correctly stay `per_day`).

SPEC IMPACT: YES — `DECISION_LOG.md` row superseding the 2026-09-02 ₱1,500/day
row, and `Live_Studio_Unified_Spec_2026-07-25.md`'s per-event-day model
(§ 4f ②) is superseded by the permanent-unlock model. The
`LIVE_STUDIO_HOSTED_CHANNEL` re-pricing question is left OPEN for the owner —
see the migration and this fragment.
