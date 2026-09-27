## 2026-09-27 · feat(maker): the Logo page is a full-screen layered editor — Text · Image · Frame, each with its own motion

Owner (DECISION_LOG 2026-09-27 "THE LOGO MAKER IS A FULL-SCREEN LAYERED EDITOR"): *"remove these
maximize the whole screen make the toolbar run like the editor toolbar. on the left navigator is
where they can add a letter, word, text or image"* · *"on left they can add a text or upload an
image, or frame"* · *"image will act as a single element. so uploading to layers of image will
create an exact top on top effect"* · *"i want to be able to upload my 2 layer image so each letter
gets its own animation. to make our exact logo"*.

- **No header bars.** The made-once header and the studio's "SETNAYAN · MONOGRAM STUDIO" bar are
  gone; the Logo page fills the body under the Maker bar. The draft status ("Saving…", "Saved to
  your draft", or the error in words) now sits in the Maker toolbar's Apply area
  (`lib/maker-save-status.ts` → `HubDraftToolbar`).
- **Left: the layers** (top of the stack first) with "+ Add": Text · Image · Frame. Select, move
  up/down, remove. **Centre:** the logo's square frame — drag a layer; rails on (it never leaves
  the frame) and it snaps to the centre and edges. **Right:** the selected layer's tools — words +
  typeface (the studio's eight faces), "Remove white background", frame shape (a closed set of
  seven), colour, size and place, and motion. **Phone:** both panels are bottom sheets; the frame
  sits at the top so the sheet never covers it.
- **Image layers use the repo's own tracer** (`fileToMarkSvg` / `trace.ts`, no new library):
  black ink on white comes back as vector shapes with the white knocked out. Uploads fill the frame
  identically, so the owner's two 2000×2000 files (the I, then the C) rebuild his monogram with zero
  positioning — held in pixels on those exact files (`scripts/fixtures/logo-layer-*.jpg`).
- **Each layer moves on its own**: In (Draw on · Rise · Fade · None), During (Still · Drift), and a
  delay; default delays follow the stack so letter 2 arrives as letter 1 finishes. **Draw on follows
  how the letter is written** (owner, of his C: *"it loops to the left goes up makes the c and ends
  with a curl"*): "Show how it's written" records one traced stroke as the layer's writing path, and
  a mask brush drawn along it reveals the real letterform in that order. Without a path a layer
  Fades.
- **One composed file** (`lib/logo-layers.ts`): pure paths, one `<g data-logo-layer>` per layer in
  stack order, motion as data-* — passes the studio SVG gate and fits the draft; the config stores
  layer metadata (`monogram_studio_config.layers`) and reads each layer's shapes back from the file.
- **Guests see what the editor showed**: `HeroMonogram` and `StudioRevealPlayer` hand a layered logo
  to `LayeredLogoPlayer` — the same player as the editor's ▶ Play — behind the existing
  Animated Monogram gate (Event Hub Pro includes it).
- **Never saves on open** (#6023's gate): the logo as it stood at the couple's first real touch is
  the baseline; only a different logo is saved. The Monogram Maker page (`/monogram`, the paper.js
  studio) is unchanged.
- Held by `lib/the-logo-is-layers.test.ts` + `lib/the-logo-never-saves-on-open.test.ts`
  (sabotage-checked).

SPEC IMPACT: None — implements the 2026-09-27 DECISION_LOG row as recorded. Flag for the owner: a
logo re-saved from this page is stored as layers; the `/monogram` studio then opens its own editor
fresh (the layered logo itself is kept and shown everywhere).
