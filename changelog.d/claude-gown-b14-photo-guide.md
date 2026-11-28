## 2026-11-28 · feat(gown-maker): guided fabric photos → slider starts, data side (port step B14)

Gown maker port, step B14, **data side only** (corpus INTEGRATION-PLAN v189 "6.4c, guided photos"; coordinator, 28 Nov). The prototype never built the screens. They come from a drawing the coordinator is making, then the owner's OK, then the port.

- **`lib/gown-swatch/guide.ts`** is pure and runs in the designer's browser. It makes no network call and uses no AI. Each photo only **suggests** where a slider starts; her own slider always wins.
- **The readings:**
  - **Shine**, from the photo tilted to the window: the brightest 2 % against the cloth's median tone, as a share of the headroom above it.
  - **See-through**, from the photo over the hand against the flat one: how far the cloth's colour moved toward the hand behind it. A skin-coloured cloth says nothing rather than guess.
  - **Body**, from the bend test, asked as three pictures to tap (stands · folds · falls), never read from a photo.
- **`gownTuneFromPhotos`** turns the readings into the shop sheet's `tune` offsets from the cloth type's own values, within ±1. Whatever was skipped is left out, and an exact match stores nothing.
- **Guards:** `lib/gown-swatch/guide.test.ts` (4):
  - generated satin, mikado and chiffon photo sets land near their type values, in order. Sabotage-checked: inverting the see-through reading turns it red;
  - every photo can be skipped;
  - offsets are bounded;
  - the module imports nothing but types: no network, no AI.
- The thresholds are this port's own judgement, stated in the module, because the prototype never built 6.4c.

SPEC IMPACT: None. This is B14's data side as planned; its screens wait for the coordinator's drawing.
