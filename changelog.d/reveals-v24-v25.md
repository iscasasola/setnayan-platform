## 2026-11-23 · feat(reveals): v24 designs and the v25 gift box, the tenth reveal

Owner 23 Nov (specs DECISION_LOG "Approve both" · "ten reveals approved"), built from the approved drawing's source
(v24 `env2.js` + `drape.js`, v25 `gift3.js`).

- **Envelope · classic:** seven flap shapes (Scalloped, the default · Deep V · Pointed Euro · Rounded · Square · Double
  scallop · Deckle edge). The front flap is 1.34× the screen wide (`FLAP_BL`), so no shape shows an upright side.
- **Envelope · gatefold:** six more panel designs drawn in code and pressed into the paper (Art deco · Botanical line ·
  Lace · Geometric · Monogram field · Pressed florals), each with the seal or the ribbon, laid outward from the seam on a
  wide screen.
- **Fabric:** six more cloths over the shipped satin (Chiffon · Velvet · Linen · Organza · Tulle · Lace), each with its own
  roughness and sheen; the same crumple and palm grab.
- **Gift box (new, `gift-box`):** a wrapped box on a floor. The bow comes undone, four ribbon arms open like a flower and
  settle on the ground (the ribbon never passes under the box), the lid lifts, light comes up from inside and the camera
  comes down onto the card, which is a window onto the guest's own page. Breeze on flowers, petals and ribbons (a force,
  never a drawn wiggle); a slow glint wave on diamonds and gold stars (never a strobe); key, fill and rim light, a contact
  shadow, a post pass (slight depth of field, film curve, grain). Six linings, nine floors (three cotton floors the box
  sinks into), eight arrangements. Reduced motion: still.
- **One list of designs** (`REVEAL_LOOK_OPTIONS`, stored sparse in `events.std_reveal_effects.looks`, Event Pro like the
  rest of the reveal) read by the Maker's Reveal step AND the Save the Date's Step 5; the guest page and the previews pass
  the picks to the stage.
- Guards: `every-reveal-design-is-offered.test.ts`; the "gift box is held" guards now hold the tenth reveal.

SPEC IMPACT: None. DECISION_LOG 23 Nov already records "Approve both" and "ten reveals approved"; this builds them.
