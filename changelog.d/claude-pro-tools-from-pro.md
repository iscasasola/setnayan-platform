## 2026-11-20 · feat(supplier-plans): the photo challenge and the 3D booth come with Pro and up — grandfathered

Owner, 20 Nov (specs 6c891356): *"the AI chatbot / the 3D booth / the photo challenge this is part of Pro and Up"*.
Controller, same day, under owner delegation: Free · Verified · Plus may not have them; whatever a shop already held runs to its end.

- **New gate `vendor_pro_tools_included(shop, event)`** (migration `20271356215288`): a live Pro or Ultra plan, or a shop
  grandfathered in the new one-time snapshot `vendor_pro_tools_grandfather` (a live Plus term → to its end, a renewal never
  shortens it; an open-ended Plus → while it stays so; a live Specialized tools window; a claimed trial on its event).
  The snapshot is written once — the table COMMENT is the marker, so a re-apply grandfathers nobody new.
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
