## 2026-10-26 · feat(guests): send an invite through WhatsApp, Viber or Messenger

Owner, verbatim: *"Viber/Whatsapp invite buttons. we need to allow the invite to work seamlessly
with messaging apps."* The per-guest Invite now offers the host's own messaging apps as direct
choices, with the same message and the guest's own personal link the share sheet already sends:

- **Guest card · Invite ▾** — WhatsApp · Viber · Messenger as rows of the one Invite sheet; on a
  phone "More apps…" is the shipped share (message + ticket) and Copy invitation link stays under it.
- **One-by-one run and the accepted-request card** — one "Send in an app ▾" dropdown (PickMenu)
  beside the shipped Send / Copy message.
- What each does (`lib/invite-app-links.ts`, `inviteAppPlan`): WhatsApp → `wa.me/?text=` on phone and
  computer; Viber → `viber://forward?text=` on a phone, a copy (and says why) on a computer; Messenger
  → copy, then open Messenger empty (no Facebook app id, `fb-messenger://share` unverified — see the
  share-buttons docblock); More apps… → the phone's share sheet, else a copy.
- Opening an app is NOT a send: it never stamps `invitation_sent_at`; the line it leaves offers Mark
  as sent, exactly as a copy does. No recipient is in any link — the host picks the chat in their app.

Guards: `lib/invite-app-links.test.ts` (encoding, each app's URL shape, desktop Viber → copy, copy
before open), `guests/_components/invite-apps-are-one-choice.test.ts` (one sheet / one dropdown, one
speller, never stamps). `lib/no-door-out-of-the-app.test.ts` gains one owner-scoped
GUEST_CONTACT_BILL line for the two recipient-less links.

Also: the one-by-one run's guest card was hard-coded `bg-white` and drew white-on-white text in dark
mode; it now takes `dark:bg-raised` (found while screenshotting this change).

SPEC IMPACT: DECISION_LOG.md — one row, "INVITE THROUGH WHATSAPP · VIBER · MESSENGER" (2026-10-26).
