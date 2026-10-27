## 2026-10-28 · feat(admin): the admin's supplier slice — everything a supplier sends is done in its row in Work; Categories › Hub tools; Messages as one chat

Owner, verbatim: *"A"* (DECISION_LOG 2026-10-28 "ADMIN SUPPLIER SLICE APPROVED — BUILD NOW"; prototype
`prototypes/admin_supplier_slice_2026-10-28/`).

- **Work › From suppliers** (`app/admin/work/_components/supplier-inbox.tsx`, read by `lib/admin/supplier-work.server.ts`):
  one oldest-first list with the prototype's chips (Documents · Name & address · Flagged cards · Event types ·
  Messages); a row opens in place (`?item=`) and is settled there — every form posts a SHIPPED action with `back` /
  `return_to` = Work, so the admin never leaves the list. A kind whose read failed is said, never drawn as "all clear".
  - **Documents** — the paper's photo beside the checklist (the verify desk's own checks); Approve, or **Needs a fix**
    with a reason from the list → `settleVerificationFromWorkList` (moved from `work/actions.ts`, was
    `approveVerificationFromWorkList`) on the SAME decision engine; the shop's step 5 reads "Needs a fix" + the reason.
  - **Name / address requests** — old → new, the shop's why; Approve (the address moves through
    `admin_correct_business_slug`, which writes the `slug_change_log` forward) or **Decline with a reason** — stored in
    the new `vendor_correction_requests.decline_reason`; the shop is told in the app either way.
  - **Flagged cards** — Repost watch's open flags: their photo beside the matched one, the match %, an unverified-shop
    note; **Publish** (dismiss) or **Needs a fix** with a reason → `resolveRepostFlag`, which now tells the shop in the
    app. ⚖ No price reason: the owner ruled "NO PRICE CHECK ON SERVICE CARDS AT ALL" (2026-10-26).
  - **Event-type requests** — built against PR #7001's `event_type_requests` (not merged): **Add the type** creates it
    with its supplier coverage ticked per group in the same press (`createEventTypeRoster` + `cover_group`, through
    the same `nextEventTypes` rule as Scope categories); **Point them to it** links an existing type; a linked ask
    offers **Put it in the picker** (#7001 tells the askers in-app). Before #7001 merges the table is absent and the
    row SAYS so.
  - **Messages** — a shop's message with an in-row reply (`settleHelpFromWorkList`).
- **Categories › Hub tools** (List ▾ › Hub tools): per category the switches of the ONE shared library + the default
  scan mode (Once · Ordered → Received · Unlimited · Group session · Roaming), saved in place ("Saved ✓") by the new
  `setCategoryHubTools`. **A tool is a RECORD** (owner-approved 2026-10-28, `hub_tools_working` + `admin_tool_maker`):
  `hub_tools` (key · name · one of EIGHT templates · `is_active` — Turn off keeps data; seeded with the 43 approved
  tools) · `category_hub_tool_switches` (category × tool, FK both, RESTRICT on the tool) · `category_hub_settings`
  (scan default; its row = "saved"; none = the approved 80-service seed in `lib/hub-tools.ts`). `hubToolsFor` is the
  pure reader the supplier Hub will call. **Not built here:** the supplier-side Hub, the eight templates' screens, the
  Tool maker (which will just write `hub_tools` rows). The template each seed tool takes is the builder's reading.
- **Messages** (`/admin/help`, nav "Help" → "Messages"): the Help inbox drawn as a Messenger-style chat — people left,
  conversation right, reply box at the bottom — on the shipped data and action (C1's chat is not merged; no second
  chat). A ticket still holds ONE reply (`admin_notes`); sending again replaces it, and the box says so.
- **Honesty fixes found on the way**: the work list's redirect-swallowing wrapper announced a page action's
  `?error=` refusal (address taken, shop gone) as success — `redirectRefusal` now sends it back as "That could not be
  done" with the page's words. `applyApplicationDecision` (the badge engine) is no longer an exported server-action
  route — it had no admin gate of its own.
- In-app only: new notification type `supplier_request_answered` (NOT on the email allowlist). Server actions: +0 net
  (`setCategoryHubTools` +1, `applyApplicationDecision` −1; the verify settle moved files).
- Migrations: `20271292839996_notification_type_supplier_request_answered.sql` (enum value, own file) ·
  `20271293237246_admin_supplier_slice.sql` (`decline_reason` + `hub_tools` · `category_hub_tool_switches` ·
  `category_hub_settings`, RLS at CREATE: read signed-in, write `is_admin()`). Not applied — the pipeline applies on merge.
- Lab: `/dev/admin-supplier-lab` (fixtures; every press caught and said).

SPEC IMPACT: corpus `DECISION_LOG.md` — a BUILT row under "ADMIN SUPPLIER SLICE APPROVED" (what shipped, what waits:
#7001 for event-type asks, C1 for the chat, the supplier-side Hub for the tools; the price reason left out per the
2026-10-26 ruling).
