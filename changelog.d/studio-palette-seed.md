## 2026-06-20 · feat(studio): mood board pre-fills the palette from the couple's onboarding "feel"

2-step-down program (Wave 2, studio) — "draft, don't blank." A couple opening the Mood Board with no palette saved yet now sees the editor pre-filled with a starter palette derived from the wedding "feel" they picked in onboarding (timeless / boho / glam / …), instead of empty swatches.

- **`lib/feel-palettes.ts`** (new) — `FEEL_PALETTES` (feel → colours; mirrors the onboarding wizard's inline map) + pure `seedPaletteFromFeel(feelKey, visibleKeys)` that fills only the visible venue-family keys (reception + ceremony), clamped to each slot's max.
- **`mood-board/page.tsx`** — selects `events.mood_feel_key`; when `role_palette` is empty AND a feel is set, passes the seeded palette as the editor's `initial` plus a `seeded` flag.
- **`palette-editor.tsx`** — a `seeded` hint: "Starting colours from your wedding feel — tweak them, then Save palette to keep. Nothing is saved until you do."

**Footgun avoided (verifier-flagged):** DISPLAY-only — it seeds the editor's `initial` state; the existing explicit Save action remains the ONLY path that writes `events.role_palette`. No auto-persist on seed/edit. (The `FEEL_PALETTES` map is duplicated from the onboarding wizard's inline copy for now — flagged for a future dedup; the critical onboarding file is left untouched.)

SPEC IMPACT: iteration 0010 mood board UX. Logged in `DECISION_LOG.md`.
