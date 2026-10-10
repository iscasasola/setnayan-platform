## 2026-10-10 · perf(maker): code only the lazy Logo screens use leaves the files the Maker loads first

A pure move, no behaviour change. `lib/logo-layers.ts` is on the Maker's first load (it holds the
sanitiser, `logoHasMotion` and `centreLogoOnItsInk` that first-load modules call), but most of its
bytes are only used by the lazily loaded Logo page and its player. Those halves now sit in modules
that only the lazy files import, so the Maker's first download no longer carries them.

- **Move 1 — the editor half → `lib/logo-layers-edit.ts`** (40 declarations: the editor's labels
  and inks, placement/rails/snapping, the stack, the frames drawn, composing and reading back the
  saved file). Imported by `launch/_components/maker-logo.tsx` only (plus tests). Code and comments
  unchanged; no re-export left behind. `R`, `resampleWrite` and `penAlong` stay in `logo-layers.ts`
  (now exported) because the player half needs them too. Source gz: `logo-layers.ts` 18,830 B →
  13,468 B; new file 6,957 B.

SPEC IMPACT: None
