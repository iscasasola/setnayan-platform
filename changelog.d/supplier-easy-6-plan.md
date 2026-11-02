## 2026-10-14 · feat(supplier · step 6): Plan · Helpers · Settings · Notifications · Help — and one free Helper on every plan

The simpler supplier dashboard, step 6 (owner-APPROVED 2026-10-14; prototype
`supplier_easy_dashboard_2026-10-14_fable.html` moments 4 · 5 and Helpers / More / the avatar sheet). Each screen
extends the shipped one; reads and actions are the shipped ones.

- **Plan** (`/vendor-dashboard/subscription`) — rows: "You are on <plan> · <what you pay>", the plan as ONE dropdown
  and the cycle as ONE dropdown with **Pay** (`startSubscriptionPurchase`, `sku_code` only), the **Booking fee** line
  from the LIVE standing (`resolveBookingFeeStanding` → "N of 5 used" / Waived / bills to pay), **What <plan> gives you**
  read from `TIER_CAPS`, **Receipts** (paid plan orders → `/receipts/<id>`), Add-ons (the shipped cards, kept below),
  Papic credits (catalogue price → Event Hub), Featured by Setnayan, Custom plan, Cancel the plan (nothing renews by
  itself). The three plan cards and the cycle pill track are deleted.
- **How is my business doing** (`/vendor-dashboard/performance`) — a plain-words top over the SAME reads: window ▾,
  "N couples looked at you · N asked · N booked", three rows that count up, monthly bars, How you are doing ▾, More ▾.
  The full cards stay below.
- **Helpers** (`/vendor-dashboard/team`) — rows; role as ONE dropdown (Admin · Team member · Helper), Invite a helper
  sheet, Who works what, Admin changes (two admins agree), Step down. Role words changed in `lib/vendor-team.ts`.
- **ONE FREE HELPER** (owner 2026-10-14 🧑‍🤝‍🧑) — `lib/vendor-free-helper.ts`: up to `FREE_HELPER_SEATS = 1` member in
  the Helper role (`viewer`) does not count against the plan's team seats. Read by the invite, the role change, the
  Helpers screen and the Shop tile. No price changes.
- **Settings** (`/vendor-dashboard/settings`, new) — Account · Notifications ▾ (push · email · Recent) · Plan · Getting
  paid · Helpers · Details · More tools ▾ (the shop's shelves, grant-gated) · Help · Your events. No Sign out (owner
  2026-08-13 rule — the avatar carries it). **Help** (`/vendor-dashboard/help`, new) — five doors.
- **Notifications** — "Recent" + Mark all read; `inquiry_displaced` reads "Someone else was booked".
- **More** — Event Hub · Messages · How is my business doing · Settings · More tools. The account sheet gains the
  supplier's rows (Helpers · Plan · Settings) via a new optional `shopRows` prop on `AccountSwitcher`.
- Lab: `/dev/supplier-plan-lab` (dev-only).

SPEC IMPACT: the vendor tier ladder's team seats gain "+ 1 free Helper on every plan" (corpus
`Vendor_Tier_Capability_Matrix` / `Vendor_Subscription_Ladder_*`). NOT edited here: it is the money item the controller
confirms with the owner before ship (brief § 6); the DECISION_LOG row 2026-10-14 🧑‍🤝‍🧑 already records the ruling.
