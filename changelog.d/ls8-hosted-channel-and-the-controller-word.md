## 2026-09-03 · feat(live-studio, nav): the hosted channel returns at ₱3,000/day, and "Event Hub" stops meaning two things

Two owner rulings from the 2026-09-03 `DECISION_LOG` row (corpus commit `b3c435b` — referenced,
not duplicated).

### 1 · `LIVE_STUDIO_HOSTED_CHANNEL` is back on sale — ₱3,000 per day

Migration `20271200509567` sets `retail_price_php = 3000`, `billing_period = 'per_day'`,
`is_active = TRUE`. LS6 (PR #5134) had not retired this product: it deactivated it because the
₱1,500 was set to SUM with `LIVE_STUDIO` into a ₱3,000 hosted total, that pairing broke when
`LIVE_STUDIO` became a ₱2,500 one-time unlock, and the session was told not to invent a
replacement. Zero orders existed then and exist now (`onboarding_order_items` +
`event_software_activations_v2`, both empty for either Live Studio SKU, measured live 2026-09-03),
so nothing was stranded either way.

🔑 **PER-DAY BESIDE A ONE-TIME BASE IS THE RULING, NOT AN INCONSISTENCY**, and the migration says
so at length because the obvious "cleanup" is to make the two rows match. The base unlocks
SOFTWARE that costs Setnayan nothing to run twice; a Setnayan-supplied CHANNEL is scarce —
production holds three, two claimable, one event-day consumes one. Per-day is what stops a couple
sitting on inventory another couple's date needs.

⚠ It is also **deliberately more expensive than the product it attaches to** (₱3,000/day against
₱2,500 once). That is a safety price. A Content ID strike on a pooled channel lands on OTHER
couples' archives and three strikes removes all of them (LS7, #5136), so this is sold deliberately
and never bundled.

**No code needed a price change, and that is the point of the flag.** `HostedChannelUpsell` opens
with `if (!owns && !onSale) return null`, and `onSale` comes from `getCustomerSkuPriceLabel`, which
filters on `is_active` — so while the row was FALSE the whole section, *including*
`POOL_CHANNEL_SHARED_STRIKE_NOTICE` that LS7b had just routed into it, rendered to nobody. Flipping
the boolean is what puts the warning back on the buyer's screen.

🪤 **THE FIXTURE TRAP WAS PAID FOR A THIRD TIME, AND THE FIRST FIX OF IT WAS WRONG.**
`lib/llms-txt-guard-input.ts` had to move in this PR — known, and done. What was *not* known is
that moving the row is not enough: `llms-txt.test.ts`'s "every ACTIVE retail price is quoted
somewhere in the file" failed on the first attempt, because while the SKU was off sale it was
correctly absent from `REQUIRED_RETAIL` **and** from the llms.txt prose. `llms-txt.ts` documents
the retirement pairing ("delete the prose line and the `REQUIRED_RETAIL` entry together") in one
direction only; **it runs both ways**, and coming back on sale needs both restored or llms.txt
under-describes a live product. Both are restored here, and both files now say so.

### 2 · One word, two screens — resolved

**Event Hub = the guest-facing site. Event Hub Controller = the dashboard where the couple
controls what it contains.** PR #5108 shipped one Hub keyed `launch` in all three phases and its
own note left "two rail rows share that word" open; this closes it.

Decided per occurrence against the ruling, never bulk-replaced — 310 occurrences across 110 files
in `apps/web`, of which **eight strings** are the dashboard sense:

- `lib/customer-menu.ts` — the phone roster's `launch` row in all three phases (plan · day-of ·
  after);
- `app/dashboard/[eventId]/_components/customer-nav-config.ts` — the desktop rail's `launchItem`;
- `lib/nav-registry-defaults.ts` — `customer.sidebar.launch` + `customer.bottom-nav.launch`;
- `app/dashboard/[eventId]/launch/page.tsx` — `metadata.title` and the masthead in all phases.

Everything else keeps the bare word because it already means the guest site correctly: `/llms.txt`,
the Live Studio FAQ ("They open your Event Hub and press play"), `lib/studio-apps.ts`, the
`landing-page` product card and its "Open your Event Hub" CTA, and `Event Hub PRO`.
**`COUPLE_WEBSITE_PRO` stays ₱3,500 and keeps its title** — it upgrades the guest site, so its
name is already right under the ruling. No `service_code`, route or column was renamed.

### Guards

`app/dashboard/[eventId]/the-hub-and-its-controller-are-two-words.test.ts` (new) pins all three
facts and each assertion was mutation-tested by occurrence count. The two existing guards migrate
rather than being weakened: `one-menu-word-in-all-three-phases.test.ts` (`HUB_LABEL`) and
`one-event-hub-door.test.ts` (the single `metadata.title` claimant) now hold the controller's new
name, and both keep asserting the bare word has not leaked back onto a dashboard row.

⚠ **OWNER QUESTION — A THIRD SENSE EXISTS AND WAS DELIBERATELY LEFT ALONE.** The SUPPLIER's day-of
room at `/vendor-dashboard/on-the-day` is also called "Event Hub", owner-ruled 2026-08-28 and held
by `the-room-is-called-the-event-hub.test.ts` (`vendor.sidebar.on-the-day` +
`vendor.bottom-nav.onday`). It is neither the couple's guest site nor the couple's controller, the
2026-09-03 ruling does not mention it, and renaming it would silently overturn a standing ruling.
Flagged, not resolved.

SPEC IMPACT: None — the `DECISION_LOG` row of 2026-09-03 (corpus commit `b3c435b`) already records
both rulings. Referenced, not duplicated.
