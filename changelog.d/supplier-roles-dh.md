## 2026-11-21 · feat(supplier-roles): d–h — one client, one Account Manager; the inquiry split; a smaller plan pauses seats; the chat is told

Builds the #8013 drawing's (d)–(h), stacked on #8036 (a–c). Ships in the SAME batch as #8036.

- **(e) Who gets new inquiries** (`/vendor-dashboard/team/roles/inquiries`, linked from Team › Roles): each new
  inquiry goes to ONE Account Manager — branch → card → event type → last name — by a fair split cut from counts
  (the shop's own once it has `platform_settings.inquiry_split_own_enough` past clients; blank = all-Setnayan
  inquiries). A card nobody covers → its Branch Manager, else the Shop Manager. Managers Adjust a cut between two
  people; Reset returns the fair split. Routing runs after the inquiry responds (`lib/inquiry-routing*.ts`).
- **(f) Clients**: Handled by is the client's one person ("Lead Stylist · Bea Santos · Makati"); Group by gains
  Branch and Card; a second card's pick marks **Hand over** (Keep / Give — the holder or a Shop/Branch Manager);
  managers move any client with "Handled by ▾".
- **(g) Plan end**: on a smaller plan the newest seats PAUSE (`deactivated_at` + `paused_by_plan_at`), the founder
  and the free Helper always stay, nothing is deleted; their clients are covered ① same card by split ② Branch
  Manager ③ Shop Manager, and come back on upgrade. Cron-free reconcile on each supplier visit.
  **Overturns shipped ruling 5683 ("everyone stays")** per owner 21 Nov, DECISION_LOG "YES TO ALL" item 3.
- **(h) The chat**: every change posts one Setnayan line (first, moved, paused, back), the drawing's words.
- Schema (migration `20271356599293`): `chat_threads.handled_by_member_id` (+ set_at, hand_over, covering — server-
  only, revoked from browsers, guard trigger) · `vendor_inquiry_split_cuts` (RLS at CREATE, read by the shop,
  server-written) · `vendor_team_members.paused_by_plan_at` (guard trigger) · `platform_settings.inquiry_split_own_enough`
  · `inquiry_last_name_prefix_counts()` (service role only) · `current_vendor_ids()` and
  `agent_assigned_service_ids()` now skip a paused seat (canonical helpers — flagged for sign-off).
- All writes fold into ONE server action (`supplierRolesAction`): the budget is 1251 of 1251, not raised.

SPEC IMPACT: Corpus already holds the rulings (DECISION_LOG 19–21 Nov: "Supplier roles drawing OK + build", "YES TO
ALL" item 3). The overturn of ruling 5683 and the canonical-helper change to `current_vendor_ids()` are surfaced in
the PR body for owner sign-off; no corpus edit made by this PR.
