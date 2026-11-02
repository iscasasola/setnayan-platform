# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-11 · feat(papic): Keep Full-Res on apply-then-pay + pre-drop warning email + enable the 3-month drop

Completes the storage retention model live (owner "we want everything running now").

- **Keep Full-Res SKU** (`HIGH_RES_ARCHIVE`, ₱999/yr per 50 GB) — activated on the EXISTING apply-then-pay flow (manual BDO/GCash reconciliation), owner "temporary connect it to our first way of payment then we just shift them when we are ready." Migration `20270723385655` upserts it active with a storage-cost figure for cost-watch. A buy card on the Papic studio (`InlineCheckoutDrawer`, mirrors the Unlock-all buy) shows the price + an "active" state when owned. It is the opt-out from the drop (the sweep already skips owners).
- **Pre-drop warning email** — new cron `/api/cron/papic-fullres-drop-warning` (daily) emails a couple ONCE ~2 weeks before their oldest Papic photo ages into the 90-day window ("download / connect Drive / Keep Full-Res"). Migration `20270724164334` adds `events.full_res_drop_warned_at` for dedup. Skips Keep-Full-Res owners; resolves the couple email via `event_members` couple → `users.email`; `sendEmail` no-ops gracefully if Resend isn't configured (and we DON'T stamp then, so it retries once the key is set).
- **3-month drop ENABLED** — `dropEnabled()` now defaults ON (owner "enable the drop"), with a `PAPIC_FULLRES_DROP_ENABLED='false'` kill-switch. Safe: downloads fall back to the web copy (#3119), Keep Full-Res is the opt-out, the couple's Drive holds full-res, tags + metadata are never touched, and prod has only the excluded sample photos so nothing is drop-eligible yet.

Migrations validated against live prod (rolled-back tx); couple-email join columns confirmed to exist. full tsc + lint + 9/9 drop tests green.

SPEC IMPACT: Applied — DECISION_LOG 2026-07-11; Pricing.md § 2.1 retention model.
