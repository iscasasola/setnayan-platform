## 2026-09-18 · feat(service-cards): copying a card also copies its ★ options (SUP-40)

"Start from one of your cards" carried everything the supplier authored except the "What couples get" lines. The maker told them the options "don't come across yet". `lib/vendor-card-copy.ts` said this was because the one-service package had no link back to its card. That link has existed since migration `20271159436100` (2026-08-24): `vendor_packages.vendor_service_id` is stamped by `commitVendorService` on every card. Nothing read it for a copy.
- `buildCanvasInitialFromCard` finds the source card's package **through that link only**, owner-scoped. It reads the package with the shipped `loadPackageDraft` and re-keys it (`rekeyCopiedItems` in `lib/service-customization-draft.ts`). The new card carries no id belonging to the old one, follow-ups keep their parent, and every line sits under the new card's category.
- The ★ step (`CustomizationStep`) takes optional `initialItems`. The canvas maker passes them only when the outcome is `copied`.
- The banner states what happened in each outcome's own words: copied ("came across too — check them before you save"), none linked (including every card made before the link existed; still never guessed by name or category, and never one of two), or unreadable (a failed read is never shown as "no options").
- New guard `lib/card-copy-carries-its-options.test.ts` executes the re-key and pins the link-only read, the no-guess and failed-read branches, and the seeding. `lib/vendor-card-copy.test.ts` now counts 3 owner-scoped reads (was 2) and checks the three disclosure sentences. `kind-is-a-field-on-the-card.test.ts` only accepts `\s+` between the tag and its first prop.

Flags: `NEXT_PUBLIC_CANVAS_MAKER_ENABLED` and `NEXT_PUBLIC_PACKAGE_AUTHORING` are both `"true"` in production (vercel env pull).

SPEC IMPACT: None. (Closes register row SUP-40 / CARD-COPY.)
