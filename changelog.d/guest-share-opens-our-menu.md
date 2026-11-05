## 2026-11-05 · fix(guests): Share always opens our own menu, on every device

Owner 2026-11-05: on the couple's Guests page the guest card's **Share** opened Setnayan's own share menu in the
iPhone app (WhatsApp · Viber · Messenger · More apps… · Copy message · Copy invitation link) but jumped straight to the
iPhone's system share sheet in the phone's browser — he prefers the app's look. `rowShare` in
`guests/_components/guest-invite-cell.tsx` no longer calls the system sheet first: the card's Share, its pinned copy
in the panel head, and the list row's Share icon all open our menu on every device. The system sheet is only behind
the menu's "More apps…" (the user chooses it), still through the one `shareInvite`. Guards re-pinned to the new rule:
`the-guest-row-is-share-and-delete`, `the-ticket-row-is-three-icons`, `the-card-head-sits-above-its-body`,
`lib/the-run-counts-only-who-is-left`.

SPEC IMPACT: None
