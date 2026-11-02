## 2026-09-27 · fix(maker): the Logo page never saves on open, opens on the couple's own logo; the Hero page is the hero alone

Measured on the owner's own event: opening the Event Hub Maker's **Logo** page drew the studio's
sample "M & J" over his uploaded logo, and the draft got that design without any edit from him —
then the Hero page previewed it.

- **Cause 1 — save on open.** The logo autosave saved any canvas that differed from "the last
  thing saved", and on open nothing had been saved, so leaving the page, hiding the tab, or a
  tap that changed nothing all wrote the untouched starting design into the draft. Now
  `lib/maker-logo-save-gate.ts` takes the canvas as it stood when the couple FIRST reached for it
  (their own pointer / key / typing, capture phase, `isTrusted`) as the baseline and saves only a
  canvas that differs from it.
- **Cause 2 — "M & J".** His event holds an uploaded logo plus a studio config with only reveal
  settings and `text: ""`. The Maker treated that config as a design; the studio read the empty
  names as none and fell back to `['M','&','J']`. `lib/maker-logo-opening.ts` now applies the
  Monogram Maker page's own rule (a config is a design only beside a composition); an uploaded
  logo with no composition is shown **as it is**, with "Upload a different one" / "Design one
  instead". The studio's Names box is the couple's initials; the engine's empty-names fallback is
  the event's own initials, then the neutral "S" (`deriveMonogram`'s own) — never a sample couple.
  The sample "Maria & Juan" is gone from both editor DOMs: the Names box starts empty and says
  "Add your names" (owner 2026-09-27: *"each editor of each event will adapt to their event"*).
- **Hero page = the hero alone.** Its canvas asks `?only=hero`; `canvasOnlyScene`
  (`app/[slug]/_lib/editor-canvas.ts`) honours it ONLY on the host-verified canvas, and one
  guarded `<style>` in `site-body.tsx` hides everything but the hero scene (fail-visible: no hero
  marker → the page stays whole). A guest's `?only=hero` is ignored. Keyed by scene, so a
  logo-alone page is one row.
- **No "Back to Invitation"** on the made-once pages (owner: "no need for this") — the Logo
  page's button and `MakerPage`'s close are gone; the Maker bar already navigates.
- Held by `lib/the-logo-never-saves-on-open.test.ts` (sabotage-checked).

SPEC IMPACT: None — restores the owner's stated behaviour (draft-only, never a sample mark); no
decision changed.
