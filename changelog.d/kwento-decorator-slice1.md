## 2026-07-08 · feat(papic): Kwento Decorator (slice 1) — stickers/effects on a photo → couple's gallery

Owner reframed the retired "Thank You" as Kwento's decoration layer ("this is ideally
kwento"), persisting to the couple's gallery. Slice 1 = a client-side photo decorator.

- New session-backed route `/papic/decorate` + `KwentoDecorator` component: pick a device
  photo → layer the 5 shipped Papic filters + emoji stickers + draggable text → bake to a
  canvas on-device (₱0) → upload via the EXISTING `/api/papic/guest-capture` pipeline (R2 +
  NSFW screen + quota + wall + Drive), so it lands as a first-class, moderation-gated capture.
- "Decorate a photo" entry link on the guest gallery (`/papic/me/[token]`).
- Decorates a device-SELECTED photo (local object URL) → no cross-origin canvas tainting;
  overlay positions are stage fractions so the edit stage and export canvas agree.

⚠ VISUAL — held for owner review on the Vercel preview (a canvas editor can't be verified by
typecheck). `tsc --noEmit` → 0 new errors.

Next slices: Kwento text on the decorated photo (chain `/api/papic/kwento` on the returned
`captureId`); larger sticker set / more text styles / undo.

SPEC IMPACT: Applied — `0012_papic/Kwento_Decorator_Build_Plan_2026-07-08.md`; DECISION_LOG 2026-07-08.
