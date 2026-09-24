## 2026-09-24 · feat(event-hub): the stage asks who, and when — one frame, two switches, the four stage cards folded in

Owner, pointing at the Event Hub Controller's "View as" row and the "Your public site — the four
stages of your one link" cards: *"this 2 can integrate to each other"*.

- **One stage, two switches.** `/dashboard/[eventId]/launch` now carries a **When** switch
  (Save the Date · Invitation · On the Day · Post Event, "Active now" on today's stage, opening on
  it) beside the existing **View as** switch (You · Coordinator · Supplier · Guest · Stranger,
  semantics unchanged). The live frame asks `/{slug}?phase=<picked>` — the host-gated preview the
  public route already honours — so WHEN is the real page; today's stage stays the bare address
  (pin and all). WHO is still the description under the frame (the frame is always the host's own
  signed-in page), and each role's read is now resolved **per stage** so its door and eyebrow
  follow the picked stage.
- **The four bordered cards are gone; nothing they did is.** Their per-stage Preview ↗ is ONE
  Preview door for the picked stage (new tab); Editorial's "Open the workroom →" appears when
  Post Event is picked (same tab, `/story`). `lint:port-controls` passes with **no baseline change**.
- **Shared component:** `app/_components/site-stage/site-stage.tsx` (client; plain-data props only,
  no functions or icons cross from the server). Seams for the site editor to adopt it later:
  `frameQuery`, `frameRef`, `interactive`, `initialDevice`. Phone / Desktop toggle added.
- **One label record:** `lib/public-site-stage-labels.ts` (`PUBLIC_STAGE_LABELS`) — the owner's
  chosen words; `PUBLIC_SITE_PAGES.name` and the "Stage" fact cell read from it.
- **Linkable, no refresh:** `?stage=` deep-links a stage (`resolveHubStageSelection`, checked against
  the four phases, falls back to today's); picking a chip updates the address with
  `history.replaceState` — no navigation, per the 2026-09-23 "only refresh the lower part" ruling.
- `resolveHubRoleView` takes an optional `stage`; omitted is byte-identical to before.
- House style: chips are pressable fills (no borders), motion on every control, helper sentences
  behind an (i). The "View as" helper no longer claims "the stage above becomes their page" —
  the frame never did; it now says the read under the frame becomes theirs.
- Tests: who×when both reach the render, "Active now" marks exactly the right chip, the Preview
  href carries the picked phase, the workroom door exists only for Post Event; `armedCard` now
  stops at the fieldset (it ran to end-of-page for the last card).

Not done here, reported to the controller: the site editor's preview adopting this stage (and the
owner ribbon's nested phase links inside it), and "RSVP'd" as a View-as "Guest who replied" —
the model has it as the flag-dark `named_guest` role.

SPEC IMPACT: None — the controller records the ruling.
