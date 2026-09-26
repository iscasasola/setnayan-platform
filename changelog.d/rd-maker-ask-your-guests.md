## 2026-09-26 · feat(event-hub): the Maker gets "what do you want to ask your guests?"

Owner ruling (DECISION_LOG.md, 2026-09-25, verbatim: *"with this invitation
process in mind we need to add this process on the editor for easier setup. to
ask what are the information you want to get from the guest."* Follow-up, item
5: *"yes on and off"*).

- New Details-panel section (`MakerRsvpAsk`): the couple turns on/off which
  RSVP-form questions this event asks — plus-ones, meal, dietary, a song
  request, a note, a mobile number. `attending` stays unswitchable — it is not
  a field of the config at all.
- The toggle goes through the existing Draft → Apply door (the generic
  `hubDraftAction`, zero new server-action exports) — guests see today's
  behaviour unchanged until the couple presses Apply.
- Server-side enforcement: `submitRsvp` re-reads `events.rsvp_ask_config` and
  ignores an off field even when a crafted POST carries a value for it; the
  song-request API route does the same for its own card. Turning a question
  off never deletes an answer already given.
- DEFAULT = today's behaviour: an absent key (every event that never opens the
  panel) reads as ON for every field.

SPEC IMPACT: None — this is a build-order item from the owner's 2026-09-25
ruling already in `DECISION_LOG.md`; no wording or SKU changed.
