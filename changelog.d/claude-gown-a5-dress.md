## 2026-11-27 · feat(gown-maker): the gown on her body (step A5)

- The dress engine, ported from prototype v189 as plain three.js maths (`apps/web/lib/gown/dress/*`):
  - the body's envelope;
  - the gown's lines: neckline with front and back depth, the five waistlines, hem presets and lengths between
    them, and the train;
  - the bodice wrapped from her body with an even ease;
  - the skirt lofted from the fullest point, so a full belly or seat never makes a ridge;
  - a hem that keeps its length where the body pushes the cloth out, and slits that part;
  - the cloth's swing and pleats;
  - the gown laid flat and its fabric metres.
- Fabrics (`apps/web/lib/gown/fabric/*`):
  - each stock fabric's weight, stiffness, shine and sheer;
  - how the cloth hangs and swings by fabric and skirt layers;
  - the shine table, and colours true to the swatch;
  - the cloth's shader patch, re-made for three 0.184 and checked by a test.

  A fabric type the code does not know draws as its registry `renderAs`, never as satin.
- The stage dresses her when a design is given. The lab shows the gown with silhouette, neckline, fabric, colour,
  length and train, and the four silhouettes on a thin, a default and a severe body.
- Held to v189 itself: five gowns built the same, with every sampled point within 1 mm and the same fabric metres.
  The cloth never sinks into her on 10 bodies × 4 silhouettes.

SPEC IMPACT: None (implements WHATS_NEXT_Gown_Maker_Port_2026-11-27.md §4 step A5). The fabric weave and the lace print
(shader maps on the same cloth) arrive with the parts in A6.
