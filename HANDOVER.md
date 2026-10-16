# HANDOVER — rd/vintage-art-kit (the Vintage art kit)

Spec: corpus DECISION_LOG "APPROVED — THE VINTAGE ART KIT, AS THE PROOF SHOWS" (pricing: Pro, recorded there).
Prototype: corpus prototypes/art_kit_cale_ice_2026-10-16.html (+ folder; after/ renders).

## Done
- Registry `apps/web/lib/art-kits.ts` (slots, scenes, placements, stylesheet) + price switch `lib/art-kit-pro.ts` (`ART_KIT_IS_PRO = true`).
- Mounts: veil seal (reveal-overlay), cover (pahina-masthead `kitSlot`), countdown, gift card + divider (guest-welcome → pabuya list), reply card, closing (invitation-shell `kitClosing`). One decision in site-body (`artKitShows`).
- SUPERSEDED by owner ruling 2026-10-16 "AN ACCENT BELONGS TO ITS SCENE…": the event column + Look switch are REMOVED. Now: `lib/art-kit-accents.ts`, picks in `style_preferences.scene_accents`; Accent ◆ ▾ (`website/editor/_components/accent-row.tsx`) under Style on cover (hero), countdown, gifts, rsvp.
- Apply sheet: "Decorations · <scenes>"; theme line "Theme · Vintage, with its Decorations".
- OPEN: the sign-off (closing oval) has no Maker scene → no Accent ▾ yet; it follows the look default. The seal/flourish/divider follow the Vintage look.
- Assets re-cut dark-safe (script: controller-2026-10-12/art-kit-build/darksafe.py).
- Guard `lib/the-vintage-art-kit.test.ts` (8 tests). Lab `/dev/art-kit-lab`.
- Preflight run 1: 10 fails → all fixed (anchors, wedding word, logo still-list, screens map, root-map baseline).

## Left
- Walk DONE (WebKit iPhone 13 @375, light+dark, on/off, picks) — pictures in controller-2026-10-12/art-kit-build/.
- Draft PR + label do-not-auto-merge, CI green.
- Before push: `git -C ~/Documents/Claude/Projects/wt-cover-scene diff origin/main --stat` (they touch pahina-masthead.tsx; mine is one prop + the ground fragment).
