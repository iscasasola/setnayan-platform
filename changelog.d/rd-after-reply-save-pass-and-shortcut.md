## 2026-10-21 · fix(guest): the after-reply shortcut line only where "Add to Home Screen" exists, and a guard that the pass and the shortcut are reachable after a Yes

Owner: *"on their RSVP. do we let them save their QR code after they reply. their digital pass? and also teach them to
add a shortcut icon for this event via Safari/Chrome (if they are on safari/chrome)"*.

Both already shipped, on the thank-you door (`/{slug}/invite/enter`) after a Yes: "Save my ticket"
(`SavePassCardButton` → `lib/save-pass-cards.ts`: the 1080 × 1440 pass PNG from `/api/guest/pass-card` through the
phone's share sheet, a download where there is none; nothing after a No — `landingTicketOf`) and the 2026-10-03
shortcut line (`ShortcutLine`). Today's reply flow reaches that door: every guest door to a reply is the reply page,
whose save (`submitInviteReply` → `submitRsvp`, `return_to=invite`) lands on it — in the side panel on a desktop.

Changed: the shortcut line is now decided by `shortcutLineShows` (`lib/home-screen-shortcut.ts`) — after a Yes, and
NOT inside the store app (Capacitor shell, `isStoreShellRequest`) nor a chat app's browser (Messenger / Instagram /
Facebook, `isInAppWebview`), where there is no Add to Home Screen; there the page's existing `InAppBar` already opens
the page in Safari / Chrome. New guard `app/[slug]/invite/after-a-yes-the-pass-and-the-shortcut-are-reachable.test.ts`
walks the whole chain (7 sabotages, each red). The maker lab gains `?rsvp=thanks&guest=1` (the thank-you as a guest
sees it, live pieces on the me-lab pass; `/dev/me-lab/ticket` takes `&couple=mj`).

SPEC IMPACT: corpus `DECISION_LOG.md` — row "AFTER THE REPLY: SAVE YOUR PASS · ADD THIS EVENT TO YOUR HOME SCREEN"
(2026-10-21), the owner's words and what already shipped.
