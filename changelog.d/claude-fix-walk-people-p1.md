## 2026-11-13 · fix(people): walkthrough P1 — "Plan an event" from a Group opens the create-event sheet

- **F-W3-13** Group › All events › "Plan an event" (a client navigation to `/dashboard/create-event?samahan=…`) showed
  "This page doesn't exist" with HTTP 200. Cause: `(launcher)/@modal/(.)create-event` intercepts that navigation from
  ANY page under /dashboard and draws its sheet inside the launcher layout, whose main slot had no `default` — so from
  any page outside Home (Group, Life flash, Library) the slot rendered not-found. A refresh is never intercepted, hence
  the real page then. Fix: `app/dashboard/(launcher)/default.tsx` (renders nothing; the sheet is the content, closing
  it returns to the page the tap came from). Reproduced and confirmed on a minimal Next 15 app of the same route shape.

SPEC IMPACT: None.

- **F-W3-12 + the composer** The group chat's one-line box became `GroupComposer`: Enter sends and Shift+Enter is a new
  line (the house `shouldSendOnEnter`), the box grows, one send in flight at a time, a fresh box the moment a message
  leaves (so text typed while it sends is the next message), and every message carries a client-minted `message_id`
  (UNIQUE already) so a repeated send is one row — the action answers the duplicate as sent.
- **Member names** The group's chat, members and last-line reads named people by `users.display_name` only (blank on
  most accounts → "Member"); they now use `accountPersonName` (display name, else first + last, never a dash).
- **F-W3-11** "Ask someone from People" opens People in its shipped select mode (`?ask=<group>`), where "Ask N into
  group" sends the invitations.
- **F-W3-03** Not a code bug: name search needs a name (testnayan5 has none — display, first and last are all empty);
  an email add DOES reach the existing account (a pending connection + notice) but never says so on screen, by design
  (`addPersonConnection`: nothing about the lookup is returned, so an email cannot be probed for an account).

- CI follow-up: the group chat's composer box carries the field-template lint's `field-ok` reason (it is the chat-box
  template, the lint's own documented exception) — the baseline is not raised.
