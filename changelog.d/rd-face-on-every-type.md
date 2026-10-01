## 2026-09-30 · fix(papic,seat): face tagging on for every event type · the seat pass stops celebrating at a wake

- **Face tagging on by default, every event type** (owner 2026-10-01, DECISION_LOG "ELEVEN OWNER ANSWERS" #8:
  *"Face Tagging is on by default but they can always turn it off."*). `resolveFaceMode` in
  `lib/papic-face-mode.ts` no longer holds christening and debut OFF when Papic is active. The minor-heavy
  list and its helpers (`MINOR_HEAVY_EVENT_TYPES`, `FORCE_MODE_B_EVENT_TYPES`,
  `eventTypeNeedsDeliberateFaceOptIn`, `eventTypeForcesModeB`) are retired — gone, and a test pins that they
  stay gone. The host's `face_tagging_declined_by_couple` still wins; consent, 18+ attestation, per-guest
  exclusion and selfie erasure are unchanged. The admin confirm copy keeps its own local children warning.
- **Wake leak:** the seat pass's arrival bloom said "So glad you made it!" and bloomed at a funeral. At the
  solemn register it now reads "Thank you for being here." with no bloom and no replay button;
  `the-wake-never-celebrates.test.ts` pins both arms and the page passing `words.solemn`.

SPEC IMPACT: None — decision already logged.
