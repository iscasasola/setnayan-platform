## 2026-09-27 · feat(maker): tap an element — its own font · colour · size · animation

Owner, 2026-09-27: *"we want the font color size and animation. that is the point we want to edit
the event hub."* In the Event Hub Maker, a tap ON an element in the canvas now opens that element's
sheet (Font · Colour · Size · Animation, each with a reset — "↺ Use the Event Hub font", "↺ Use the
theme colour", "↺ Move with the scene"); a tap on a scene's empty space still selects the scene.

- **Which elements (v1):** the hero's six parts (eyebrow · mark · names · the "invite you to…" line ·
  date · time) and every scene's label, heading and words. The RSVP form is not element-editable.
- **Where it is stored:** `invitation_widgets.config_json.canvas.elements` — the scene's existing
  canvas (the hero row's for the hero). No table, no column, no migration. Contract, selectors and
  CSS in `lib/element-style.ts`; sanitized to closed sets (fonts from `HUB_FONTS`, `#rrggbb`,
  S/M/L/XL, the four motion presets).
- **Draft → Apply, Pro at Apply:** every choice is a `hubDraftAction` save; `canvasLookChange`
  compares each element field, so adding/changing one is Pro (held at Apply for a free couple) and
  taking one off is free.
- **Guests:** the hero's parts carry the styles inline; a scene's parts get one hidden
  `<style data-hub-els>` right after the scene, addressed with `:has(+ style…)`, so no widget is
  edited. `data-el` keys are stamped only in the Maker canvas. An element-only canvas does not frame
  the scene (`hasHubCanvas` ignores `elements`).
- **Contrast:** a chosen colour under 4.5:1 on its ground shows a warning; never blocks.

SPEC IMPACT: None — implements DECISION_LOG 2026-09-26 ("ONE FONT … OVERRIDDEN PER ELEMENT",
"OWNER ANSWERS — FIVE QUESTIONS" item 1) and 2026-09-27 ("PER-ELEMENT EDITING … MOVES UP") as
recorded.
