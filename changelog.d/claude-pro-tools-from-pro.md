## 2026-11-20 · feat(supplier-plans): the photo challenge and the 3D booth come with Pro and up — grandfathered

Owner, 20 Nov (specs 6c891356): *"the AI chatbot / the 3D booth / the photo challenge this is part of Pro and Up"*.
Controller, same day, under owner delegation: Free · Verified · Plus may not have them; whatever a shop already held runs to its end.

- **New gate `vendor_pro_tools_included(shop, event)`** (migration `20271356215288`): a live Pro or Ultra plan, or a shop
  grandfathered by three columns frozen once on `vendor_specialized_tools_access` — `pro_tools_plus_until` (the Plus term
  running at ship time, to its end; a renewal never shortens it; `infinity` = an open-ended Plus, kept while it stays so),
  `pro_tools_unlock_until` (a live Specialized tools window), `pro_tools_trial_until` (a claimed trial on its event).
  The snapshot writes once — the column COMMENT is the marker, so a re-apply grandfathers nobody new.
- `vendor_papic_challenge_entitled` and `event_branded_booth_vendor_ids` now call it instead of
  `vendor_specialized_tools_unlocked`. Their legacy arms (a live 28-day photo-challenge window, a paid per-event booth
  order) are unchanged. The Specialized tools unlock keeps opening every other paid tool.
- **AI chatbot: no change needed** — Pro and up in code since 14 Nov (`PLAN_CHATBOT_LEVEL`, `AI_CHATBOT_SOLD_ON_ITS_OWN = false`).
- **Screens:** the client page's Papic Challenges card and "Your booth in their 3D Plan" show the shared 🔒
  (`LockedFeature`, Problem → Solution → Upgrade to Pro) below Pro, replacing "Turn on Papic Challenges" and "comes with a
  paid plan (Supplier Plus …)". A Pro or grandfathered shop reads "Comes with your plan".
- Two new locks in `lib/locks.ts`: `photoChallenge`, `boothBranding` (opens `pro`, lines marked draft).
- TS mirror `proToolsIncludedFrom` in `lib/specialized-tools-access.ts`, held to the SQL by
  `tests/db/pro-tools-come-with-pro.db.test.ts`.

SPECIAL NOTE: the badge rewards (`lib/badge-upgrades.ts`) can still grant a lower-plan shop a 28-day photo-challenge, 3D
booth or chatbot window; the legacy windows are honoured as paid time. Flagged to the controller, not changed.

SPEC IMPACT: `DECISION_LOG.md` row 2026-11-20 (controller, under owner delegation — closes the open (3) as no, with grandfathering).

### Ship review fixes (20 Nov)
- The photo challenge card now asks the database's own gate (`vendor_papic_challenge_entitled`) instead of the old Specialized tools unlock read: a Plus or trial shop after the ship is no longer shown "On" for a submit the database refuses, opening the card no longer claims the one-time trial, and a failed read shows "couldn't check" instead of the upgrade lock.
- Plan copy follows the ruling: the 3D booth logo line sits under Pro (anchored to `PRO_TOOLS_MIN_TIER`, "add-on" dropped); Plus's Specialized tools row and line no longer say "All"; features entry c43 says the two tools come with Pro.

## 2026-11-21 · feat(supplier-plans): the AI chatbot is Verified and up; the smarter chatbot is Pro and up

Owner, verbatim (21 Nov): *"AI Chatbot is for verified and up but smarter chatbot is for pro and up"* — replaces the
14 Nov split (chatbot on Pro, smarter on Ultra only).

- `PLAN_CHATBOT_LEVEL` (lib/vendor-ai-level.ts — the table the inbox gate reads): Verified and Plus → basic, Pro and
  Ultra → advanced, Free → none. `planChatbotLevel` now reads `verification_state`, because approving a shop's papers
  does not rewrite `tier_state` — a verified Free shop is answered. The inbox gate selects that column.
- A new `chatbot` lock (lib/locks.ts, opens Verified, server = inbox-hook): the Clients ⚙ auto-reply section draws the
  shared 🔒 for an unverified Free shop instead of a switch that does nothing.
- Every surface that names who gets it: Plans table (Free cell "🔒 Opens once Verified"), For Suppliers + For
  Coordinators Verified line, /pricing, /features plan columns, voice-match words (Pro and Ultra), the retired buy
  action's message.
- Paid chatbot windows still run to their end (unchanged). Neither level is sold on its own. No schema change; the
  migration is byte-identical to 391132f618.
- Tests: `lib/the-chatbot-is-verified-and-up.test.ts` (Verified/Plus basic, Pro/Ultra smarter, unverified Free 🔒),
  plan-table cells. §4: `build-sessions/shots-pro-tools-lock/` gains the chatbot lock (closed + opened).

SPEC IMPACT: DECISION_LOG 21 Nov row already logged by the controller; no further corpus edit.
