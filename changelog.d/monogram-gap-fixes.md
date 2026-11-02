# Changelog fragment — claude/monogram-gap-fixes

## 2026-07-17 · fix(monogram): gap audit — build-verify + 9 correctness/consistency fixes across the merged studio

A production build + a 3-auditor gap sweep over the day's merged monogram work (~14 PRs). The build passes clean; the audit surfaced the fixes below (reference integrity + player dispatch + layer-group export all audited clean).

**HIGH — correctness:**
- **Studio save now reclaims precedence from an upload.** Every surface resolves `uploaded ?? custom`, so re-designing in the Vector Studio while an earlier `monogram_uploaded_svg` existed was a silent no-op — the hero/QR/save-the-date kept the OLD upload while the UI said "your mark everywhere," and the "everywhere" celebration showed the old upload too. `saveStudioAction` now nulls `monogram_uploaded_svg` (hitting Save on a studio design is unambiguous intent). Fixes the no-op save AND the wrong-mark celebration in one.
- **Reduced-motion reveal preview auto-dismisses.** Under `prefers-reduced-motion` the gold/molten preview opened the overlay with no `animInfo`, so the timer (which required `previewAnim`) never fired — the overlay stuck open with only the ✕. Both hosts now key the dismissal on `previewKind` with a fixed fallback.

**MEDIUM:**
- **Clearing the studio no longer destroys a live upload's reveal.** `clearStudioAction` wiped `monogram_studio_config`, but the uploaded mark reads its chosen reveal from `config.anim`. Now, when an upload is live, a minimal config preserving only the reveal is kept.
- **Upload reveal picker gains the §5.3 paid-gate honesty line** (matching the studio): "Previewing is free — guests see it play live with Animated Monogram · ₱X". Owns → "plays live on your website."
- **JPEG scans are accepted.** The tracer has a luminance branch built for opaque scans ("dark ink on light paper"), but `upload.ts` only accepted PNG/WebP, making the common "photograph your paper monogram" case unreachable. JPEG now routes through it (both hosts' `accept` + copy updated).

**LOW:**
- **Illustrator SVGs no longer rejected.** `sanitizeStudioSvg` stripped only the `<?xml?>` prolog, so Adobe's default `<!DOCTYPE svg>` export was rejected with a misleading "scripts/images" error. A leading DOCTYPE (internal-subset-free) is now stripped — the XXE `[...]`-entity form still refuses (`[^[>]` won't consume `[` → fails the `startsWith('<svg')` check → rejected). Runtime-verified: Illustrator passes, XXE rejected, studio export unaffected.
- **Upload errors surface in the Upload section.** Upload actions redirect to `#upload-mark` but errors rendered inside the Vector Studio card far above. Upload errors now use a distinct `upload_error` param routed to the Upload section.
- **Stale menu copy/comments after the 7→5 merge:** the Molten degrade note said "older ones see Gold Turn instead" (a reveal that no longer exists) → now "the Medallion Turn"; two `animated-monogram-upgrade.tsx` comments corrected likewise.

Non-fixes (audited, intentional): the dashboard renders real WebGL Molten while the public studio degrades it (one-WebGL-context budget for anonymous visitors — a deliberate fidelity/safety trade, comments made honest); UploadMark/MarkEverywhere render independent of the studio flag (upload works on v1 too, by design).

SPEC IMPACT: None — all fixes align existing behavior with the shipped specs.
