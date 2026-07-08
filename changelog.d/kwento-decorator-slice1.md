## 2026-07-08 · feat(papic): Kwento Decorator (slice 1) — stickers/effects on a photo → couple's gallery

Owner reframed the retired "Thank You" as Kwento's decoration layer ("this is ideally
kwento"), persisting to the couple's gallery. Slice 1 = a client-side photo decorator.

- New session-backed route `/papic/decorate` + `KwentoDecorator` component: pick a device
  photo → layer the 5 shipped Papic filters + emoji stickers + text. Each overlay is
  **draggable (body) + resizable & rotatable (corner handle)** — the standard transform model;
  rotation is baked into the canvas export. Bake on-device (₱0) → upload via the EXISTING
  `/api/papic/guest-capture` pipeline (R2 +
  NSFW screen + quota + wall + Drive), so it lands as a first-class, moderation-gated capture.
- "Decorate a photo" entry link on the guest gallery (`/papic/me/[token]`).
- Decorates a device-SELECTED photo (local object URL) → no cross-origin canvas tainting;
  overlay positions are stage fractions so the edit stage and export canvas agree.
- **Slice 2 (same PR): the Kwento caption.** After a successful save, if the event has Kwento
  on (`eventKwentoEnabled`), a caption composer appears — anchors a Kwento *story* (≤280,
  explicit RA 10173 consent) on the returned `captureId` via the shipped `/api/papic/kwento`
  contract. Words + decoration together.

⚠ VISUAL — held for owner review on the Vercel preview (a canvas editor can't be verified by
typecheck). `tsc --noEmit` → 0 new errors.

Next: larger sticker set / more text styles / undo / mood-board-themed stickers (slice 3).

SPEC IMPACT: Applied — `0012_papic/Kwento_Decorator_Build_Plan_2026-07-08.md`; DECISION_LOG 2026-07-08.
