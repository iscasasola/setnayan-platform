## 2026-11-22 · fix(chat): a refused send, a locked mic and an expired quote each say why, where the press was

From the supplier-ready walk of chat (inquiry → reply → quote → accept → pay → receipt → schedule → files → voice
notes) on origin/main: 7 of 10 steps were working. Three were not, and this fixes them. No migration, no new server
action (1251 of 1251).

- **A refused send says why.** The composer strips `return_to`, so a send the server refused (an unverified shop's file
  or voice note, a host's second follow-up before the shop accepts, off-platform contact, a long message…) returned
  nothing: the bubble read as sent, then turned "Not sent" with no reason six seconds later. `sendChatMessage` now
  hands the reason back (`ChatSendRefusal`) and the bubble says it, with no Try again for a rule that would only refuse
  again. A fault (the insert failed) still throws and keeps Try again.
- **No mic for an unverified shop.** The mic follows the ＋ sheet's rule (`verified === false` locks it) — every voice
  note from an unverified shop was refused (`plus_unverified`).
- **Accept on an expired quote says so.** "Accept the update" in the chat (and Accept on the quote page) refuses on
  `?notice=quote_expired`: "This quotation expired before it was accepted. Ask the supplier for a new one." It read as
  accepted before.
- Guard: `lib/a-refused-chat-send-says-why.test.ts`.

SPEC IMPACT: None — makes shipped flows say their answers; no ruling changed.
