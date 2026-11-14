## 2026-11-14 · fix(notices): an invited connection and a chat add are told; "Place didn't load" says what it is; the confirmer is named

W1/W3 walkthrough findings (findings-W1.md RW-197 · F-W3-27) on the live site. Measured on prod (SELECT only) first:

- **"A guest invited to an event gets NO notice."** `an_invitation_reaches_the_account` works but matches the account by
  the guest's EMAIL only — and People → "Your people" adds a connection BY NAME (no email or person id ever reaches the
  browser), so nothing tied the guest row to the account: no request on its Events page, no bell row. Now the server
  links the new row to the connected person after the add (`lib/connected-guest-link.server.ts`: re-reads the connection
  as confirmed, the host's own person at one end, the other end claimed by an account), and migration `20271346481550`
  lets `incoming_requests_for_me` and the invitation trigger match by the claimed person too — **for both roads only an
  account whose email is confirmed** (the replay test caught that the person road would otherwise skip that proof).
- **"Added to its chat gets NO notice."** New trigger `a_chat_add_reaches_the_account` on `chat_thread_members`: a person
  added by someone else gets one `chat_message` notice — "{who} added you to {group}" / "… to the chat with {shop}" —
  carrying the event; not the adder, not a self-rejoin, not a refused add.
- **"6+ notices read 'Place didn't load'."** All were places that HAD loaded: 26 notices about since-deleted events and 8
  shop notices for an account that no longer has a shop. `placeMissingWords` now says "An event that was removed",
  "An event you're no longer on", "A shop you no longer run" or "One of your shops"; "Place didn't load" is kept for a
  read that really failed.
- **"They confirmed your connection" had no name** (8 of 8 on prod): the person node's name is empty; the account's own
  name is now the fallback (the label path already did this).
- **Inquiry → notice + email:** confirmed in-app + push (`vendor_inquiry_received`, push level normal). It is
  deliberately NOT emailed — owner 2026-10-11 "we manage without emails" (`lib/couple-supplier-notices.ts`, the frozen
  allowlist). Not changed; flagged for the owner.

No new server action. One migration (triggers + one function, no table).

SPEC IMPACT: None — implements the shipped rulings (2026-09-28 "an invitation reaches the account", 2026-11-12 group
chats, 2026-11-13 notification place). The inquiry-email question is for the owner (not changed).
