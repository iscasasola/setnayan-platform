## 2026-09-15 · feat(shop): a shop is told when Setnayan lists, hides or takes down its listing

SUP-31 (SHOP-2). Measured on origin/main 2026-09-15: FOUR admin surfaces change
whether a shop is visible to couples, and only `/admin/verify` ever told it.

    admin/verify/actions.ts                  1 visibility write · 3 notifies
    admin/vendors/verification-bypass-*.ts   2 visibility writes · 0 notifies
    admin/integrity-watch/actions.ts         1 visibility write · 0 notifies
    admin/fraud/actions.ts                   2 visibility writes · 0 notifies
    admin/vendors/actions.ts                 1 (an INSERT — see below)

A shop whose vouched badge was withdrawn by hand, or whose listing was
un-published off an integrity flag, learned by finding its own page gone.

- Granting a vouch now says the shop is live; withdrawing one says it is hidden;
  an integrity takedown says the listing came down. Each says plainly that
  nothing was deleted and how to reach the team.
- They ride the EXISTING `notifyVendorStatusChange` rather than a new sibling:
  it already resolves the owning account, SKIPS an unclaimed shop with no
  account, and is fail-soft so a notify failure can never roll back the admin
  action. Its union gains three listing decisions; the copy and the deep link
  are the only new parts.
- Listing decisions deep-link to `/vendor-dashboard/shop`, where the listing
  state lives. Verification decisions keep `/vendor-dashboard/verify`, which is
  itself now a redirect to `shop#get-verified`, so both land on the same page
  and the verification ones keep the right anchor.

🔑 THE EMAIL ALLOWLIST IS ASSERTED, NOT ASSUMED. In this repo a notification and
its allowlist entry are two halves of one mechanism and having one is
indistinguishable from having neither. `vendor_status_change` is on
`EMAIL_ENABLED_TYPES` and deliberately NOT on `PUSH_ENABLED_TYPES` — the
allowlist's own comment says these types are transactional and belong on email.
Both facts are now pinned.

DELIBERATELY NOT CHANGED, and both are judgements rather than omissions:
- `admin/vendors/actions.ts` is an INSERT that stages a vendor with `user_id:
  null` — there is no account to notify yet, and the notifier would skip it
  anyway.
- `admin/fraud/actions.ts` un-suspends to `hidden`, moving an already-hidden
  shop sideways; the owner's own note says re-listing is `/admin/verify`'s
  separate deliberate decision. Whether a shop should be told "your suspension
  is lifted but you are not relisted" is a fraud-handling judgement and is
  flagged for the owner rather than changed here.

SPEC IMPACT: None — no new notification type, no new table, no migration.
