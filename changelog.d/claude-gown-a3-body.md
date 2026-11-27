## 2026-11-27 · feat(gown-maker): the bride's 3D body, solved without a browser (step A3)

- The faceless mannequin (`apps/web/public/gown/female.glb`, CC0 base mesh by Innerscene, credited in
  `public/gown/LICENSES.md`) and its engine, ported from prototype v186 as plain three.js maths in
  `apps/web/lib/gown/body/*`:
  - the rig;
  - bones and lengths;
  - the girth profile, soft fullness and a fuller cup;
  - CPU skinning and feet in heels;
  - the tape;
  - the solver, the weight from the body's volume, and her weight kept true;
  - the gown measurements estimated on the body.

  Her choices are passed in, not read from globals.
- Owner, 27 Nov (v187): the trapezius fill is not ported; it built a hood each side of the neck base, and the body
  structure stays female.
- Held to the prototype's own numbers: the v164 sweep (10 bodies × bust Higher / Average / Lower) was run in the prototype
  itself (with the v187 body change) and saved as a fixture. The port fits every tape within 0.1 cm, matches the prototype within 0.1 cm, weighs the
  same within 0.5 kg, and estimates the same measurements. The bust stops at underbust + 28 cm with the ribcage
  unchanged.
- Nothing loads it yet: the stage arrives in A4, lazily, outside the shared bundle.

SPEC IMPACT: None (implements WHATS_NEXT_Gown_Maker_Port_2026-11-27.md §4 step A3). One v186 quirk kept as is and
reported to the coordinator: v186's hip-line "waist to hip" estimate sits inside a code comment, so v186 (and this
port) uses its fall-back, the hip joint.
