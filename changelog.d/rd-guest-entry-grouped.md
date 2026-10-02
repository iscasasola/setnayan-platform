## 2026-10-02 · feat(guests): the five "How guests get in" choices are shown under three rules — List only · Accept · Open

Owner ruling (DECISION_LOG 2026-10-02, "THE FIVE GUEST-ENTRY CHOICES ARE SHOWN UNDER THE THREE RULES"). Wording and grouping only: the same five values stay stored in `events.rsvp_ask_config`; no data, schema or behaviour changes.

The one "How guests get in" PickMenu now lists its choices under three headings (PickMenu already supported `group`, so nothing was added to it): **List only** (Guests reply · No reply, each gets their own QR), **Accept** (Guests reply · No reply, one QR, I approve each), **Open** (One QR for everyone). The closed button reads heading + choice ("List only · Guests reply") via `buttonText`.

One shared helper, `lib/who-can-reply.ts` (`GUESTS_GET_IN_CHOICES` with a `group`, `guestsGetInLabel`, `guestsGetInOptions`), with the three heading words in `GUEST_ENTRY_RULE` (`lib/rsvp-ask.ts`). The same words now appear in the Maker RSVP stage dropdown, Event Details (RSVP + Guests rows), the Guest list's Invite panel, the Guest list first-visit pop-up (List only / Accept), onboarding's Guests card and Entry dropdown, and the privacy page / Maker Public copy that used to name "Anyone, I approve".

Tests: new `lib/guest-entry-is-grouped.test.ts` (3 headings, 5 choices, round trip to the same stored values, one helper, no old spellings; sabotaged once). Existing pins updated to the new words.

SPEC IMPACT: None
