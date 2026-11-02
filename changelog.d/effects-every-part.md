## 2026-10-17 · feat(effects): the six new effects on every text and picture part

Owner, 2026-10-17, verbatim: *"Ship #6600 and #6601. Then extend the effects to every text and picture part."* Builds on
#6601 (DECISION_LOG "APPROVED — SIX NEW EFFECTS", "ALL ANIMATE, EFFECTS, STYLES AND ACCENTS ARE EVENT HUB PRO ◆").

- **Text:** every part that offers Shimmer now offers **Words ▾** (All at once · Word by word ◆ · Spread ◆) and
  **Glow ◆** — a scene's label · heading · words on every stage, and Post Event's. The joiner is the one named exception
  (one word inside the Event title, cut with the title). A scene's words are drawn by widgets that never know the
  canvas, so they are cut in the browser (`HubSceneFx`, the same `lib/part-fx.ts` cutter) from the scene's own style
  (`data-hub-word-fx`), **as the scene nears the screen** (`.pahina-in`) — a scene already on screen at load is cut at
  rest, never shown → taken away → brought in.
- **Pictures:** every scene that draws pictures — the Love Story's photos, the gallery, the photo moments, the venue's
  picture (`MAKER_PICTURE_SCENES`), and any scene with a photo behind its words — offers **Reveal ▾** (Plain · Develop ◆
  · Curtain ◆, Build in row 4) and **Light leak ◆** (Action, beside Still · Slow lift). Develop/Curtain play on every
  picture the scene draws as it nears the screen; Light leak is the shipped ambient leak's own drawing laid over each
  picture that is its box's only child (`contain: paint` clips it). The cover photo had them already (#6601).
- Same rules as #6601: pure CSS (transform · opacity · filter · clip-path), reduced motion and Save-Data show the
  finished state, Pro ◆ tried free and named at Apply (scene effects by name: "Develop", "Curtain", "Light leak").
- Guard: `lib/the-effects-reach-every-part.test.ts` (every Shimmer part offers Glow + Words; every picture widget is a
  picture scene; the scene payload reaches w: and Post Event frames; the scene pictures' gate, drawing and Apply names) —
  5 sabotages caught.

SPEC IMPACT: None — extends the approved six as the owner asked. Not reached (named in the PR): fixed blocks (their
Action is Still · Drift, no Shimmer), Post Event scenes' pictures (no Animate there), a picture that shares its box with
another (Light leak), the photo behind a scene while it Slow-lifts (Reveal).
