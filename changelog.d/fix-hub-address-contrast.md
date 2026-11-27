## 2026-11-27 · fix(hub): the Event Hub address box is readable

The Apple build 10 screenshots showed "Address" and "This is your address now" as dark words on a dark box in the Event Hub controller (`/dashboard/[eventId]/launch`, the `HubStage` card a helper or coordinator sees).

Cause: `HubStage` is obsidian in both themes and paints its own words from the `OB` literals. The address editor inside it is the shipped `SlugField`, which paints with the house tokens (`text-ink/55`, `.input-field`, `.button-secondary`). In Light those are dark words, and on `OB.card` they read at 1.27:1.

Fix: the address editor now sits in a house frame (`.sn-frame`) instead of the `OB.card` box, so ground and words pair in Light and Dark. No new UI and no change to `SlugField`. Guard: `app/dashboard/[eventId]/launch/_components/the-address-box-is-readable.test.ts` renders the stage and fails without the fix.

SPEC IMPACT: None
