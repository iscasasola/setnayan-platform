## 2026-11-16 · feat(admin): the admin reorganised — 7 places, 65 live pages merged into 18, every old address forwards

Builds the owner-approved admin drawing (`Setnayan-specs/prototypes/admin_reorg_2026-11-16/`, artifact
P9ncoiiemWTMxMF3gGTq3J, v7 → v10; DECISION_LOG 2026-11-17 "ADMIN REORGANIZATION … Yes, all 5", "ADMIN FOCUS PILES
OPENED … Yes, all 4", "PAYMENTS: THE ADMIN VERIFIES THE MATCH", "Admin reorg calls 10–14"). Reposition and realign only
(owner, 17 Nov: *"No code everything that is already there"*): every merged page MOUNTS the shipped page bodies as its
dropdown views.

- **The map** — `lib/admin/admin-pages.ts`: Focus · Work (Queue · Kind ▾ with all 17 queues, Messages) · Money (To
  approve, Records, Prices, Offers & gifts at the new `/admin/offers`) · People (Look up, Papers, Ties) · Catalogue
  (Services, Studio, How the app finds things) · Insights (one page, View ▾) · Setup under the avatar (Team, Switches &
  delivery, Business keys & privacy, Help).
- **The shell** — bottom bar, desktop rail (only the open tab lists its pages), the pinned-row picker grouped by page
  ("Queue · Kind ▾"), Setup rows under the avatar. Same components, new source. Tab dashboards (`TabLanding`) on
  `/admin/work`, `/admin/money`, `/admin/directory`, `/admin/app-performance`, from the queue digest the layout reads.
- **The forwards** — every old address opens its merged view from the middleware (307, the visitor's query kept); no
  route, stub or `next.config` rule added. `lib/admin/admin-pages.test.ts` holds all 114 drawing addresses to a home.
- **Payments to confirm** — one "Matches ✓" / "Doesn't match: <field> · <diff>" line per field read off the photo
  (`lib/admin/receipt-match-lines.ts`, from `payment_receipt_reads`). A help line; the admin always presses Confirm.
- **Badges & seals** (v10) — #7827's page carried to Money › Offers & gifts; Spotlight Awards fold in; each shop's five
  tiers read through #7807's adapter; read-only (holds and the lock wait on an owner decision).
- **v10** — the Focus Ask answers "suppliers badge progress", "payments to confirm", "papers to verify" in place; People
  lists everyone under its cards with the shipped Show & sort sheet on the Ask bar; Insights carries the shipped
  Overview charts on one page; PickMenu gains `opensUp` (dropdowns in a phone sheet open upward).
- No new server action. No migration. `MODEL_CHOICE_CAP` 153 → 157 (the file's own rule: +1 per new admin page).

SPEC IMPACT: `FEATURE_REGISTER.md` (spec corpus) — `/admin/offers` added to the "Discount codes, gifts, launch offer,
founder seats, referrals" row (the five old addresses forward there). No decision changes.
