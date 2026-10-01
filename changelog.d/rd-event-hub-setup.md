## 2026-10-02 · feat(maker): "Finish your Event Hub" — the Event Hub setup (B) is the first round of What's left (Lane 3)

The owner-approved wedding flow's middle part (spec
`WEDDING_ONBOARDING_HUB_SETUP_EVENT_DETAILS_BUILD_SPEC_2026-10-01.md`, THE MAP
B1–B7; design `finish_your_event_hub_v2_2026-10-01_fable`). Built by extending the
Maker's What's left (`lib/details-guided-flow.ts`) — no new screen, no new field,
no setup-only table, no new server action.

**The steps** (`lib/hub-setup-steps.ts`) are round 0, "Finish your Event Hub",
first in What's left for a wedding. Each step IS a Maker Details item and writes
what that item already writes, so the Maker opens filled in:
B1 When should guests arrive? → the Schedule's public "Guests arrive" moment ·
B2 Parish and reception → the LOCKED venue bookings (not drawn when both are
locked) · B3 Your Love Story → `love_story` moments · B4 What everyone wears →
the Mood Board's `dress_code_config` · B5–6 What to ask guests · reply-by →
`rsvp_ask_config` questions + `guest_list_edit_deadline` (guest-list paths only) ·
B7 Your guests' names → the Guest list's template import (guest-list paths only;
listed on the round's Ready screen). Nothing onboarding asked is a step
(`ONBOARDING_A_FIELDS`). Every step says what it unlocks ("Unlocks: … / ✓
Unlocked: …"); the Maker's empty Love Story, Venue and Schedule scenes read
"Locked — finish ___".

**Three doors, one set of steps:** offered ONCE right after onboarding — Home's
Next card reads "Start / Later" (Later posts the shipped `completeTour`; Start's
"Before we start" tour in the Maker marks the same key) · Home's slim card
"Finish your Event Hub — n of m · Next: … · then … · Continue" · the Maker's What's
left. All three open `?tool=details&guide=1`, counted by one derivation
(`hubSetupFactsFrom`, read by the Maker and by Home).

**Love Story:** a fourth anchor chapter, `together` ("When did you become
together?"), between How we met and Falling; `together_since` moves under it.

**Rename:** the Maker's "Details" tab is "Your info" (label only — keys and
addresses unchanged).

Guards: `lib/hub-setup-steps.test.ts` (the prefill guard, A-asked-never-asked,
three doors, the unlock labels), each sabotage-checked.

SPEC IMPACT: None
