# Reveals round 3: build handoff · frozen 23 Nov 2026

**Status: frozen by the owner.** On version 10 he said *"this will do for now"*. On version 12 he said
*"gift box still need improvement so remove it until we fix it"*, then *"but the rest can stay"*.
The published page is version 25 (25 = gift box breeze, sparkle, photographic light, cotton floors; 24 = more flap, panel and fabric designs, gatefold seal whole; 23 = gift box linings; 22 = gatefold seal OR ribbon, gift ribbon blooms, arrangements; 21 = gift box: solid to its ribbon, six floors; 20 = gift box redrawn; 14 = gift box rebuilt, 15 = doors finish pass, 16 = gift box motion pass and a
wax seal on the gatefold, 17 to 19 = every reveal's own options): **nine reveals ship, the gift box is held.** The controller then asked (owner:
*"maximize the time because we want to continuously build"*) for the two weak ones to keep improving while the nine
are built: the gift box and the doors finish. Version 14 carries a rebuilt gift box as a "new try"; it is still held.

- Live page: https://claude.ai/artifact/U4pTTfGDn6TBxA3PixFPLq (`index.html` here is the same page).
- It needs scripts (three.js r128 from cdnjs). With scripts off it shows frame strips only.
- This is a drawing, not app code. Nothing here is wired to the app.

## The nine reveals that ship

| # | Reveal | Key | Where it is built |
|---|---|---|---|
| 1 | Veil | `veil` | `src/drape.js` |
| 2 | Beach curtains | `curtains` | `src/drape.js` |
| 3a | Envelope · classic | `envelope` | `src/env2.js` |
| 3b | Envelope · gatefold, with the ribbon untie and a wax seal | `gatefold` | `src/env2.js` + `src/ribbon.js` |
| 4 | Fabric | `fabric` | `src/drape.js` |
| 5 | Scratch | `scratch` | `src/fx.js` |
| 6 | Smoke | `smoke` | `src/fx.js` |
| 7 | Cathedral doors | `doors` | `src/rigid.js` + `src/aisle.js` |
| 8 | Petals | `petals` | `src/round3.js` |
| 9 | Fireworks | `fireworks` | `src/round3.js` |

The envelope counts once, in two styles (owner: *"we want both styles"*).

**Gatefold wax seal (owner, 23 Nov: *"envelope gate fold needs to be a wax seal as well"*).** The bow is now tied on
the seam (it was left of it) and a gold seal with the monogram sits over its knot. It rests on the ribbon, settles
onto the paper once the ribbon has gone, and breaks down the seam when the panels part, one half on each panel
(`makeSeal(..., vertical)` in `env2.js`). Frames: `gatefold-wax-seal-frames.jpg`.

**EVERY REVEAL HAS ITS OWN OPTIONS (owner, 23 Nov, drawn in versions 17 to 19).** Owner, verbatim: *"our reveal
should all have their own and each customizations."* · *"veil logo patterns need to be small. and possible bottom
patterns."* · *"beach curtains need to have different fabrics"* · *"envelopes must have different designs and can
color change also"* · *"fabric should have different fabric silk/mulberry designs."* · *"scratch should have
different scratch colors"* · *"Cathedral doors needs to look better than the doors i sent you."* · *"petal style and
pick 2 colors."* · *"fire works different colors and explosion style."* · *"gift box needs to have a different wrap
and ribbon style."* · *"they should all be customizable. and can pick from the different options, styles."*

- **Engine:** `RV.options(name, list)` declares a reveal's options, `RV.opt(name, key)` reads the pick, `RV.opts`
  holds the picks (`src/core4.js`). A change rebuilds the reveal closed. The page shows one dropdown per option.
- **Exists in the app:** the veil already has this model (`RevealStudioConfig.veil`, `DEFAULT_VEIL_LOOK` in
  `apps/web/lib/reveal-config-pure.ts`). **Missing:** a look for every other reveal. **Delta:** one small set of
  picks per reveal, stored beside the veil's.
- **The first sets (the owner has not yet said which to keep, add or drop):**

| Reveal | Options |
|---|---|
| Veil | Logo pattern: small (new default) · tiny · large · none. Bottom edge: plain · lace scallops · embroidered vine · pearl beads |
| Beach curtains | Fabric: sheer voile · linen · lace · striped gauze. Colour: ivory · white · blush · sand · sage |
| Envelope · classic | Flap design: damask · lilies · plain with gold edge. Paper: ivory · blush · sage · dusty blue · burgundy · navy. Seal: gold · rose gold · silver · burgundy wax · sage wax |
| Envelope · gatefold | Panel design: sculpted lilies · damask · plain with border. The same papers and seals. Ribbon: blush · ivory · sage · dusty blue · burgundy · gold |
| Fabric | Silk: plain satin · damask jacquard · raw mulberry silk. Colour: champagne · ivory · blush · mulberry · emerald · midnight |
| Scratch | Foil: gold · silver · rose gold · emerald · midnight |
| Smoke | Colour: white · blush · gold · twilight (not asked for; added so that every reveal has one) |
| Cathedral doors | Doors: carved wood · midnight blue · gold leaf. Flowers: white · blush · peach · lilac |
| Petals | Petal: rose · sampaguita · cherry blossom. Two colours from eight; the petals are those two and the shades between |
| Fireworks | Colours: gold · rose gold · silver white · gold with pink and blue. Burst: round · willow · rings · hearts |
| Gift box (held) | Wrap: emerald · ivory · blush · navy · burgundy · kraft. Print: monogram · gold dots · gold stripes · plain. Ribbon: six colours. Bow: classic · double |

- Frames of some picks: `options-first-sets.jpg`, `doors-options-frames.jpg`.
- Doors, to beat the owner's clip: candles along the aisle (mirrored in the floor) and petals drifting down, for
  every door style.
- Not checked: only a handful of the combinations were rendered, each as one still. No combination was watched
  opening. The door finishes are the same carved doors repainted, not new carvings.

**Held: Gift box** (`gift`). Not one of the nine. Do not build it until the owner accepts it.
- **Page version 25, 23 Nov: the gift box in motion, with photographic light.** Owner, verbatim (relayed by the controller): *"around the box flowers, rose petals, must be moving via breeze · Pearls and diamongs golden stars need to sparkle · Gift Box needs better lighting we want to achieve a more realistic look. use fable 5.2 extra to design this better. the most realistic look"* · *"floor can be cotton/clouds, egyptian cotton"* · *"ribbons should move with the soft breeze"* · *"like veil and curtains"*.
  - **Breeze (`src/gift3.js`, `step`):** every petal, bloom and leaf remembers its place and is moved each frame; the swells keep to the motion standard's 1.4 s loop and its multiples (2.8, 4.2, 5.6, 8.4 s). About one petal in nine drifts a little and tumbles, only where it cannot reach the box or a ribbon lane. `prefers-reduced-motion`: everything holds still.
  - **Ribbons as cloth:** the breeze is a FORCE on the loose parts of each ribbon chain (`Band.step`, `wind`, `wtip`, `wlift`, gusts from `RV.GUST`), with weight, damping and a soft pull back to where it lay; no drawn wiggle. Closed: the bow's loops and tails. Open: the four arms, once down, are let go and their free ends lift and ripple. Wrapped ribbon is pinned and does not move. The same force moves the gatefold's ribbon tails (`src/ribbon.js`; its old sine wiggle is removed).
  - **Sparkle:** diamonds and gold stars carry four-point glints that come and go, a few at a time, in a wave that crosses the picture every 5.6 s (rise about 0.3 s, fall about 0.7 s, never a strobe); none sit behind the box. Pearls, satin and foil take a moving sheen from one small light that travels slowly.
  - **Light:** a key whose hot spot sits up-left of the lid and falls off across it, a soft cool fill, a warm rim; a tight ambient-occlusion line and a soft contact shadow where the box meets the ground (on the cotton floors the shadow is in the cloth itself); the glow from inside now also falls on the lid, the rims and the ground (`spill`). A hand-written post pass (`render` on the reveal, hook added in `src/core4.js`) draws the scene to a target, softens the ground toward the edges of the picture (a slight depth of field that fades out before the cover fills the screen), and adds a light film curve and grain.
  - **Three more floors (nine in all):** Cotton clouds, Egyptian cotton, Ivory clouds. These have a shape (`HF`): the box sits slightly sunk, arrangements and ribbons rest on the surface.
  - **Clips (animated images, also in this folder):** `v25-clip-flowers.webp` (breeze on flowers, petals, bow and tails), `v25-clip-diamonds.webp`, `v25-clip-stars.webp`, `v25-clip-open.webp` (the arms settling and the lid opening), `v25-clip-gate.webp` (gatefold ribbon tails). Made with `src/clip.sh` (24 frames in one browser run). On the page they stand still under reduced motion.
  - **Checked:** all nine floors and all eight arrangements render (`v25-gift-frames-and-floor-arrangement-checks.jpg` and the cotton frames on the page); the gift section at 390 px light and dark and on desktop (dark).
  - **Removed:** the fixed white points on the diamonds; the gatefold tails' drawn wiggle.
  - **Still short / not checked:** judged from 24-frame clips at about 8 frames a second, not at full speed on a phone; the cotton billows are soft and low under the overhead key; diamonds read as cut stones only when they glint; the linings' three frames are from version 23 (before the new light); the depth of field is a screen-space softening, not a true lens; a ribbon arm swings up toward the camera as it opens and crosses in front of the lid for a moment (in the air, not through it).
- **Page version 24, 23 Nov: more designs on three of the nine, and the gatefold's seal stays whole.** Owner, verbatim (relayed by the controller): *"Envelope flap must have more designs. And the upper part must not cut vertically. We want the illusion that it is larger than the screen. · Ecvelope gatefold must have more designs · Fabric must have more fabric styles"*. Owner, typed in the drawing session: *"evnelope gatefold is still cutting the wax seal to 2 parts"* and *"if i send you a pattern for the envelope can you mimic it and make it look better?"* (answered yes; nothing received yet).
  - **Classic envelope (`src/env2.js`):** new option `flap`: Scalloped (kept, the default) · Deep V · Pointed Euro · Rounded · Square · Double scallop · Deckle edge. The front flap is now 1.34 times the width of the screen (`BL`), so its shoulders and upright sides are never in view; only the lower edge crosses the screen. The art on the flap is drawn at its old size. Frames: `v24-classic-flap-shapes.jpg` (the last frame is the flap lifting, still past both edges).
  - **Gatefold:** six more panel designs, drawn in code and pressed into the paper (`PROC` and `press()`): Art deco · Botanical line · Lace · Geometric · Monogram field (the event's own monogram) · Pressed florals. Each works with the wax seal or with the ribbon. **The wax seal is ONE whole seal now**: it is never cut in two; it is fixed to the left panel and lifts away with it (`v24-gatefold-seal-stays-whole.jpg`). This replaces version 22's "breaks cleanly down the seam".
  - **Fabric (`src/drape.js`):** option renamed Silk to Fabric, six more: Chiffon · Velvet · Linen · Organza · Tulle · Lace. Same cloth, same crumple at rest; the weave, sheen and roughness change. Frames: `v24-fabrics-and-deeper-gatefold-emboss.jpg`.
  - **On the page:** a section "More designs to choose from" with, for each of the three, the designs as frames and the settings with that menu open. Checked at 390 px light and dark and on desktop (dark): `v24-more-designs-390-light-dark.jpg`, `v24-more-designs-desktop-dark.jpg`.
  - **Removed:** the split wax seal on the gatefold; the flap's visible upright sides.
  - **Still short / not checked:** only two of the six new gatefold panels were rendered with the ribbon (Art deco, Botanical line), and those two frames were made before the embossing was deepened. The new gatefold panels are fine line embossing, quieter than the sculpted lilies. A small dark wedge shows in the top-left corner of the classic envelope's frames (it was there before this version; not fixed). At rest the fabric leaves a sliver of the cover showing low on the left edge (also there before). Stills only; nothing watched in motion.
- **Page version 23, 23 Nov.** Owner, verbatim (relayed by the controller): *"Gift box. Fabric inside can be customized too"*. New option `lining` on `gift` (`src/gift3.js`): Gold lamé (the default, the look of versions 20 to 22) · Ivory satin · Blush silk · Navy velvet · Sage linen · Plain card. The lining is the bed the card lies in AND the inside walls of the box. The light from inside (`lamp`, `glow`, `halo`) is kept on every one. Frames: `gift-box-v23-six-linings.jpg` (the open box, about 8.6 s after the tap). The page shows three of them (Blush silk, Navy velvet, Sage linen) and the settings with the Lining menu open; checked at 390 px light and dark: `gift-box-v23-picker-390-light-dark.jpg`. Removed: nothing. Still short: under the warm light Ivory satin, Sage linen and Plain card look alike; the desktop view was not re-shot; stills only. On his other notes: the floor already runs far past every edge of the screen, so no corner of it can show; the motion was not changed in this version.
- **Page version 22, 23 Nov: owner's notes typed in the drawing session, verbatim.** *"envelope gatefold is still not fixed"* · *"ribbon and wax seal never co exist together"* · *"the box needs to shadow on the ground. and make the ground look not like a floor but a beautiful arrangement. of flowers, diamonds, pearls, something that makes it look good for a wedding reveal. and also floor for other types of event."* · *"the ribbon issue on the gift still remains. it over laps on the box. and even when the ribbon pulls out"* (with two close-up pictures) · *"what if it opens and drops to the floor like the ribbon bloomed like a flower"*.
  - **Gatefold (`src/env2.js`, one of the nine):** new option `closure`: Wax seal (default) or Ribbon and bow. NEVER both: sealed, there is no ribbon; tied, there is no seal. Sealed: the tap cracks the seal down the seam, a half stays on each panel, the panels part from tau 1.0. The panels' spring is softer (`Hinge(.95, 2.3)`), so they open more slowly in both. Frames: `gatefold-v22-wax-seal-only-frames.jpg` (the last two frames there show the tied variant BEFORE the seal was taken off it; the tied variant as shipped in v22 is the last frame of `gift-box-v22-arrangements-and-gatefold-ribbon.jpg`).
  - **Gift box ribbon (`src/gift3.js`):** the pull-out is gone. The ribbon is four arms from the knot, each on the lid, over the edge, round the lid's skirt and down the base to the ground, tight to the box (the box is now two solids, lid over base, for collision and for the drawn-vertex clamp). On opening each arm's end is carried on an arc about its foot and the arm settles on the ground, "like a flower". Frames: `gift-box-v22-ribbon-blooms-frames.jpg`.
  - **Shadow:** a soft contact shadow under and beside the box, on top of the cast shadow; the ribbon now receives shadow too.
  - **Around the box (new option `around`):** Flowers (default) · Rose petals · Pearls · Diamonds · Confetti · Balloons · Gold stars · Nothing. All drawn in code. Four lanes are kept clear for the ribbon arms. The floor option stays (`petals` floor renamed `stone`; petals are now an arrangement). Frames: `gift-box-v22-arrangements-and-gatefold-ribbon.jpg`; picker at 390 light and dark: `gift-box-v22-picker-390-light-dark.jpg`.
  - **Removed:** the ribbon and seal together on the gatefold; the gift box ribbon being drawn off across the box; "Petals on stone" as a floor.
  - **Still short / not checked:** diamonds and balloons are the weakest arrangements; the bloom was checked on eight stills, not in motion; the desktop view of the new picker was not re-shot; the shadow is faint on the dark default floor.
- **Redrawn again, 23 Nov, page version 21.** Owner, verbatim: *"the ribbon on gift goes under the box. it should not go under. box is a solid material."* · *"Allow them to have design around the box. in short changeable background (the floor of where the box is placed)"*.
  - **Ribbon is solid-aware** (`Band` in `src/gift3.js`): the strip is now drawn finer than it is simulated (`SB` rows per link), and every drawn vertex is kept out of the box and off the floor, so no edge of the ribbon can cut into a face or pass under the box. The box stays one solid for as long as any ribbon is in sight (the old switch to the smaller base box is removed), and the long length leaves a little sooner, before the lid stirs. It slides off over the edges onto the floor beside the box. Frames: `gift-box-v21-ribbon-solid-frames.jpg` (closed, then every 0.4 s from 2.4 to 5.6 s at the 12-second speed). In version 20 the long length's edge cut through the front of the base between about 4.4 and 5.2 s.
  - **The floor is a choice** (new option `floor` on `gift`): Evening linen (the version 20 dark set, the default) · Warm wood · Marble · Ivory linen · Petals on stone · Sand. All six are drawn in code, no photographs. The one pool of light and the glow from inside are kept on every floor. Frames: `gift-box-v21-six-floors.jpg`.
  - **The picker** is drawn on the page under the gift box card: the gift box's five settings as dropdown rows, with the Floor menu open and a swatch per floor; beside it the same box on three floors. Checked at 390 px light and dark and on desktop: `gift-box-v21-floors-picker-390-light-dark.jpg`, `gift-box-v21-floors-picker-desktop-dark.jpg`.
  - **Not drawn: "Your own photo".** No reveal takes an upload today; each reveal's settings are fixed lists. An uploaded floor is a new function and waits for the owner's word.
  - **Removed:** nothing a person could pick. The ribbon no longer passes through the base.
  - **Still short:** on the light floors (Marble, Ivory linen, Sand) the glow from inside is less dramatic than on the dark ones. Checked from still frames, not in motion. The settings rows are my drawing of a dropdown; I did not read the shipped reveal settings screen.
- **Redrawn, 23 Nov, page version 20** (controller brief: "Redraw it to the same standard as the nine approved reveals (slow, dramatic, realistic, one tap)"). Frames: `gift-box-redrawn-v20-frames.jpg` (closed, then about 4, 7 and 9.5 s after the tap at the 12-second speed). What changed in `src/gift3.js`: the set is a dark table with one narrow pool of warm light, a low rim light from behind and a deeper vignette; the light inside the box (`lamp`, `glow`, `halo`) is stronger and the key dims as it comes up, so the glow does the reveal; the bow's loops go out high with the face up, fold over at the tip and come back low (a full tied bow seen from above), with smoother bands (`M` is now an option of `Band`); the paper is rougher and reflects less, so the stock reads deep; the table cloth is finer. Removed: the bright daylight linen table of the first rebuild. Still held until the owner accepts it. Checked from still frames only, not in motion; no gift box clip from the owner exists to hold it against.
- **Rebuilt, 23 Nov, in `src/gift3.js`** (it registers `gift` after `round3.js`, so it replaces the flat one; the
  flat one's code is still in `src/round3.js`, marked held). Frames: `gift-box-rebuilt-frames.jpg`.
- A real box on a table, seen from above and in front: a wrapped base and a wrapped lid (paper with fibre,
  gold-foil monograms through a roughness and metal map, the folded end, mitred corners, no tape), a woven cloth
  under it, a spot light that pools, a lens vignette.
- Ribbon: `Band` in `gift3.js`, a chain with weight that collides with the box and the table and carries its
  facing round the corners. Bow collapse as on the gatefold; then each length is drawn off over the edge.
- Lid: unseats, then turns up on its back edge and settles. Inside: gold tissue, a halo, and the cover as a card.
  The camera creeps in, swings over the box and comes down until the card fills the screen; the canvas then fades
  to the same cover.
- Still short: no fine weave in the satin, the lid opens in about two seconds, the drawn ribbon is stiff, and
  there is no gift box clip from the owner to hold it against. Checked from still frames only.

Retired: Golden marble, Burning paper. Not picked: Capiz window, Abaniko. Built as spares and not on the page:
Banig, Wave. Their code is still in `src/rigid.js` and `src/round3.js`.

## The shared motion rules: one file

`src/core4.js` holds the stage and `RV.rules`. Every reveal reads its timing from there; none has timing of its own.
The rules were read from the shipped veil on `origin/main`: `apps/web/lib/veil-cloth.ts`,
`app/[slug]/_components/reveal/veil-reveal.tsx`, `lib/reveal-config-pure.ts` (`DEFAULT_VEIL_LOOK`).

| Rule | Value here | Shipped veil |
|---|---|---|
| Hands-free open after a tap (`FEATHER`) | 12 s, with 9 · 12 · 16 buttons on the page | 5 s (its Speed slider tops out at 8) |
| Hands-free curve | `0.55 p + 0.45 smoothstep(.05,.95,p)`: even pace from the first moment | `smoothstep(.05,.95,p)` |
| Smoothing (`LIFT_K`) | each frame closes 5% of what is left | the same |
| "Revealed" (`DONE`) | at 98.5% of the motion | the same |
| Tap | under 300 ms and under 18 px | the same |
| Swipe | over 40 px in under 460 ms, along the way it opens; the other way closes | the same (up / down) |
| Push-in (`PUSH`) | the camera travels 36% of the way in while it opens | none |

- **One tap opens every reveal.** Scratch is the one exception: it opens at 60% rubbed.
- **Three things differ from the live veil and are the owner's asks, 23 Nov:** the slower speed, the veil lifting
  from the tapped point (`tapAt` in `drape.js`), and the push-in. None is in the app.
- The owner has not yet said which of 9 · 12 · 16 seconds he means. His reference clips run about 5 s
  (envelopes, ribbon) to about 12 s (doors).

## Engine parts

- **`core4.js`** stage, rules, touch (`RV.down / move / up`), `RV.setSpeed`, the logo helpers `RV.logo` and
  `RV.stamp`, and a wrapper that drives the older reveals from the veil's lift (`tau = lift x length`).
- **`drape.js`** the shipped veil cloth ported: 66 x 50 grid, strain-soft solver (6 relax passes, 4 clamp passes at
  1.012), hem lift, finger pinch. Modes: `veil` (lifts from the tap, then stays as a fold along the top),
  `curtain` (rings slide along a rod), `slide` (fabric dragged off by one pinched point; no gravity fall).
- **`env2.js`** envelopes with physical materials: relief normal maps made from the art, an environment map for
  foil and wax, ACES tone and sRGB, flaps on a bendable grid, shadow from flap to flap, the seal riding the flap.
- **`ribbon.js`** `RV.RibbonMesh` (a verlet strip drawn as a band with width in 3D, twist and camber) and
  `RV.GateRibbon` (collapse → one strand → drawn off sideways → panels part).
- **`rigid.js` + `aisle.js`** doors: seam of light, inward swing, one continuous glide down an aisle of cut-out
  layers at their own depths, into white.
- **`fx.js`** a small GPU fluid (smoke, in rings from the tap) and the scratch mask.
- **`old.js`, `oldcloth.js`** the round 2 cloth and strip physics that `ribbon.js`, `fx.js` and the held gift box still use.
- **`reveals_r3.py`, `reveals_r3.js`, `reveals3d.css`** build the page. `test.html`, `shot.sh`, `shotx.sh`,
  `stills.sh` render still frames in headless Chrome.

## The sample

- **Cover:** the real cale-ice cover, composed from the cover video's still and the words on the public page.
- **Logo:** the cale-ice monogram (the page's inline couple-logo SVG, flattened). It is woven into veil and
  curtains, pressed in the wax seals, and on fabric, scratch and smoke. (The held gift box prints it on its paper.)
- In the app both come from the event; nothing is tied to cale-ice.
- `index.html` therefore embeds the owner's own cover and names.
- All other art is sample art generated for this drawing.

## Below parity with the owner's reference clips

- **Doors finish: second pass done, 23 Nov** (`src/aisle.js`, frames `doors-finish-pass-frames.jpg`).
  - Floor: the whole hall is cloned upside down under the floor (`up.clone(true)`, `scale.y = -1`) and the marble is
    laid over it at 66% opacity, so every reflection is true and moves correctly. Draw order: mirror 0, floor 1,
    streak 2, shadows 3, hall 4.
  - Flowers: separate cut-out photographs with soft alpha (blended, not alpha-tested): round arrangements along the
    aisle, tall ones on gold stands, each with a shadow blob. A wider hall with pilastered walls.
  - The three flower pictures (`cl1`, `cl2`, `ped`) are generated sample art, held as data in the page; they are
    not in `src/` (the texture file is not committed).
  - Still short of the clip: reflections are sharp, not softly blurred; no dappled shadows from the flowers across
    the floor; nothing sways; the round arrangements show their oval cut when very near.
- **Ribbon:** no fine satin weave, a bow of two simple loops, tail ends that do not curl.
- **Realism pass:** only the two envelopes use the physical materials (and the held, rebuilt gift box). Veil, curtains, fabric,
  scratch, smoke, petals and fireworks have the older look.
- **Not taken from the clips:** a pearl band, a bow tied on the classic envelope, a lace band, petals drifting
  after it opens, panels going translucent as they part.
- The clips themselves are third-party. They are not in this repo and no frame of them is on the page.

## Known wrong on the page

- **The gift box still appears in the old picture files** in this folder (`eleven-reveals-frames.jpg`,
  `envelopes-and-bow.jpg`). It is not on the page.
- **The frame strips are out of date.** The picture files in this folder and the strips lower on the page were
  rendered before the last changes (speed, cale-ice cover, logo, doors glide, ribbon). The live phone at the top
  of the page is current. `src/stills.sh` re-renders them; run two WebGL Chromes at a time at most, three deadlock.
- The classic envelope's front flap reaches 56% of the screen, as in the owner's picture, not the two thirds he
  first said.

## Never checked

- A real phone. Everything ran at 300 x 520 in desktop Chrome with a software graphics chip.
- Real fingers. Tap, swipe and pinch were driven by script.
- Motion. I judged from still frames; I did not watch any reveal play.
- Speed on a phone. The fluid, the 88 x 76 fabric cloth and the 2048 px shadow maps have no measured cost.
- The speed buttons, the veil's exact tone against the live one, reduced motion, and the 12-second self-open.

## For the builder

- Build the nine. Do not build the gift box.
- Extend the shipped engine in `apps/web/app/[slug]/_components/reveal/`; do not ship these files.
- The fluid needs half-float render targets: add a capability check and a soft-fade fallback.
- Locked rules still hold: the reveal comes first, nothing behind it plays, opening it starts the music, Event Pro
  and up, once per visit, it opens itself after 12 seconds, reduce motion skips it.
