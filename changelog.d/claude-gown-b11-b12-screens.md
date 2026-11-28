### Attire Maker B11 + B12: seam allowances, cutting list and 1:1 pattern pages (drawing v205)

- Shop › Attire Maker › price list has a new "Patterns and printing" section:
  - her default seam allowances in cm (seams 1.5, hem 2.5, zip 2.0, necklines and armholes 1.0);
  - − / + controls, held to each kind's range, plus "Back to the usual";
  - the paper her patterns print on (A4 or US Letter).
- On an order (Clients › the event), the cutting blocks now show:
  - a "Seam allowance" row, on by default, from the shop's own; the order may set its own or "Use my shop's allowances";
  - a "Net pattern" switch.
  - Both save by themselves into the designer's own fitting row (the shop only).
- The blocks are drawn as the prototype draws them:
  - stitching line solid, cut line dashed and mitred;
  - notches, PLACE ON FOLD, the bodice front dart drawn as a dart.
- A cutting list:
  - grouped by fabric (outer, lining, each tulle layer);
  - piece, how many, fold, grain, size with the allowance;
  - metres checked against her quote, with the reason when they differ by more than 10 %;
  - what has no block yet named.
- **Export 1:1** opens the pattern pages:
  - the page map first, a 5 cm test square and "Page n of N" on every page;
  - a piece over 40 pages comes as a measured diagram;
  - **Print** and **Save the pages** use the real PDF; **Plotter sheet** is one large SVG.
  - No prices on any sheet.
- Supersedes the pure allowance, cutting-list and export parts of #8489 with exact ports of the prototype, held to it by golden tests.
- Lab: `/dev/gown-shop-lab?view=order` (also `order-own`, `order-net`) and `?view=covers`.

SPEC IMPACT: None. This ports the drawn v205 screens and applies owner decisions D28–D30 (28 Nov), which are already in the corpus.
