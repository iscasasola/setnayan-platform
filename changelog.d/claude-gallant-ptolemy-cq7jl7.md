## 2026-11-14 · fix(people,chat,hub): W3 re-walk — Enter sends everywhere, /signin forwards, a person page shows a name and answers a request, the cover never makes an event its own host

- **F-W3-28** `shouldSendOnEnter` (`lib/chat-enter-to-send.ts`, the ONE rule every composer asks) no longer holds Return
  back on a touch screen: Enter sends, Shift+Enter is a new line, on every device — the event chat and the group chat
  answer the same key the same way. IME composition still never sends.
- **F-W3-01** `/signin` and `/sign-in` forward to `/login` (308, query kept so `?next=` still lands) through the house's
  forward map (`lib/legacy-redirects.ts`, read by the middleware) — not pages, not `next.config` rules (both cost routes).
- **F-W3-04/10/29** (person page) `/u/[userSlug]` names the person by display name, else the account's own first + last
  name (`profileShownName`, `lib/person-page-facts.ts`) instead of "Someone on Setnayan", and never prints
  `setnayan.com/u/S89U-…` as an address — the address line shows only a handle the person chose.
- **F-W3-06** A person who asked you to connect: their page now carries Accept · Decline (the shipped
  `confirmConnection` / `declineConnection` — no new server action; `ProfileViewer.answerConnectionId`).
- **F-W3-27** (part) "They confirmed your connection" names who confirmed (`confirmedByName`: the person row's name,
  else the account's own).
- **F-W3-24** The cover's line under a Get-together's (host-type) title reads "join us to celebrate", not
  "<event name> invites you to celebrate" (`invitationLine`); the couple and celebrant types keep their words.

SPEC IMPACT: None. (F-W3-28 retires the "a phone's Return is a newline" arm in favour of one rule on every device —
the chat-step cards' existing "phones send too"; flagged for the owner in the PR.)
