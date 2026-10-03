## 2026-10-04 · feat(look): every theme's fonts reach every role · Look › Buttons — shape, fill, colour

**(A) B5 — theme fonts, all four roles.** Each `[data-hub-theme]` block in `globals.css` now sets
`--font-body` (and points `--font-sans` and the inherited `font-family` at it), `--font-theme-script`
and `--font-mono`, so paragraphs, RSVP questions and buttons wear the theme's body face instead of
Hanken Grotesk. Every variable is one `<html>` already declares with `preload: false`
(`app/layout.tsx`, `app/_fonts/choice-faces.ts`) — no new font declaration, no JavaScript, a file
downloads only on a page that sets text in it. The family → variable table is
`lib/hub-theme-faces.ts`; ten spec families that are not in the repo (Lora, Libre Baskerville,
Crimson Pro, Josefin Sans, Kaushan Script, Alex Brush, Parisienne, Cookie, Mrs Saint Delafield,
Monoton) are worn through the closest shipped face, each named with its reason, pending the owner.
Not `--font-script`: that is Great Vibes' own variable, which a host's font choice resolves through
— Tailwind's `font-script` reads `var(--font-theme-script, var(--font-script))`. The host's
Look › Font still wins for the heading it sets. Guard: `lib/invite-themes.test.ts`.

**(B) Look › Buttons (new).** One host choice for every Event Hub button, a fifth Look section:
Shape ▾ (Theme's · Square · Rounded · Pill) · Fill ▾ (Theme's · Solid · Outline) · Colour ▾
(Theme's · the event's palette colours), with the Reply button drawn as it will look.
- Stored as `events.site_button_style` (`<shape>-<fill>`, NULL = the theme's; migration
  `20271263199306`, SELECT+UPDATE to authenticated, `events_host` rebuilt) + the existing
  `site_button_color` — the button colour MOVED from Look › Colours to here (one field, one place).
- Drafted (`HUB_DRAFT_LOOK_COLUMNS`), live on the canvas at once through the bridge
  (`buttons-preview.ts`), to guests at Apply. Opening Look writes nothing. FREE
  (`HUB_FREE_LOOK_EVENT_COLUMNS`), like the colours.
- Rendered by `guestLookFrom` → `resolveHubButtons` against the page as it paints → two scope
  attributes + `--hub-btn-*` → `globals.css` rules for `.button-primary`, the arrival's Reply action,
  the RSVP answers (shape; a picked answer wears the solid pair) and `.button-secondary` (shape).
- Legibility: a fill's label is `hubLegibility`'s ink (AA); an Outline is drawn only where its
  colour clears AA on the page's paper and plates, else Solid; the Maker offers neither otherwise.
- Guard: `lib/look-buttons-reach-every-button.test.ts` (CHECK = app vocabulary · the choice reaches
  the rendered Reply button's CSS · a sweep of 10 themes × 3 grounds × 300+ colours × every
  combination never puts a label under AA · opening Look writes nothing · drafted + free).

SPEC IMPACT: yes — DECISION_LOG.md rows 2026-10-04 "LOOK › BUTTONS — THE HOST STYLES THE EVENT HUB'S
BUTTONS" (built as specified; adds: the button colour moves from Colours to Buttons, Buttons is free,
the stamp RSVP style keeps its stamp) and a new 2026-10-04 build row for B5's ten stand-in faces;
INVITATION_RSVP_GUEST_FLOW_REMAINING_2026-10-04.md § B5 marked built.
