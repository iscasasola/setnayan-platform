## 2026-11-09 · feat(supplier): Build 2 leftovers — video link titles, Forms "N saved", supplier refunds finished

Owner 9 Nov: *"finish it"*; on supplier refunds: *"yes build this"*. Stacked on Build 3 (#7416).

- **Video link titles.** Portfolio › Video links: each row reads its Title, else the link's host; the open row gains a
  Title field (≤ 80, Enter saves, in place). Stored in the new `vendor_profiles.gallery_video_titles` (jsonb, keyed by
  the link — never by position, so a rewrite of the links can't move a title onto the wrong video); written in the SAME
  update as the links, removed links take their titles with them, and an editor that never read the titles leaves them
  untouched. The public shop page (`/v/[slug]`) captions each video with its title. Erasure scrubs it; the shop owner's
  export carries it. `lib/video-link-titles.ts`.
- **Forms "N saved".** Shop › Makers › Forms Maker tile says "3 saved" / "None yet" / "Couldn't load". The count rides
  the Shop page's existing own-row select as an embed — no new request.
- **Supplier refunds, the three gaps from DECISION_LOG 2026-11-08:**
  - Admin › Payments › **Supplier refunds** (`/admin/payments/supplier-refunds`) — a read-only list (no write), the
    console's `ConsoleTable` + `requireAdmin` pattern.
  - The couple is told **in the app** (`client_refund_recorded`: amount, day, why) — not on the email allowlist,
    declared `app_only` in `lib/couple-supplier-notices.ts`. A double tap's repeat tells nobody twice.
  - The couple's data export carries `supplier_refunds_received` beside `payment_ledger` (couple-grain, session
    client), leaving KNOWN_GAPS (69 → 68).
  - Money rules unchanged: Paid = confirmed − refunds, the agreed total stays, refund ≤ confirmed − earlier refunds.
- **Portfolio "services vs photo albums overlap": nothing done** — settled by the owner-approved Build 5 Portfolio
  redesign (every section stays a rail).

Migration `20271334860034_video_link_titles_and_a_refund_notice.sql` (ALTERs only): `gallery_video_titles` + its CHECK
helper `video_titles_are_short`, and the `client_refund_recorded` notification enum value.

SPEC IMPACT: None to the locked decisions — this builds what DECISION_LOG 2026-11-08 ("A RECORDED REFUND LOWERS PAID")
listed as not yet built, and B2-B owner call (a) (v118's video Title). The corpus is read-only for this lane; the
controller should mark those rows done in `plans/supplier_build_2_2026-11-08/00-BUILD-2-PLAN.md` ("Later").
