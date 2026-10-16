# HANDOVER — rd/vintage-art-kit (the Vintage art kit)

Spec: corpus DECISION_LOG "APPROVED — THE VINTAGE ART KIT, AS THE PROOF SHOWS" (pricing: Pro, recorded there).
Prototype: corpus prototypes/art_kit_cale_ice_2026-10-16.html (+ folder; after/ renders).

## Done
- Registry `apps/web/lib/art-kits.ts` (slots, scenes, placements, stylesheet) + price switch `lib/art-kit-pro.ts` (`ART_KIT_IS_PRO = true`).
- Mounts: veil seal (reveal-overlay), cover (pahina-masthead `kitSlot`), countdown, gift card + divider (guest-welcome → pabuya list), reply card, closing (invitation-shell `kitClosing`). One decision in site-body (`artKitShows`).
- Storage: `events.site_decorations` (migration 20271270281258), drafted; Studio › Look › Elements "Decorations" switch (◆).
- Apply sheet: "Decorations · Whole Event Hub"; theme line "Theme · Vintage, with its Decorations".
- Assets re-cut dark-safe (script: controller-2026-10-12/art-kit-build/darksafe.py).
- Guard `lib/the-vintage-art-kit.test.ts` (8 tests). Lab `/dev/art-kit-lab`.
- Preflight run 1: 10 fails → all fixed (anchors, wedding word, logo still-list, screens map, root-map baseline).

## Left
- Walk: WebKit iPhone 13 @375, light+dark, switch on/off + side-by-side vs prototype after/ (controller-2026-10-12/art-kit-build/).
- Draft PR + label do-not-auto-merge, CI green.
- Before push: `git -C ~/Documents/Claude/Projects/wt-cover-scene diff origin/main --stat` (they touch pahina-masthead.tsx; mine is one prop + the ground fragment).
