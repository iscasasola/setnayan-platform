## 2026-10-24 · feat(prints): passes cut cleanly at home — numbered cut lines, square corners, NFC on the back

Owner, printing Cale & Ice's passes: *"when i cut 1 side, i cannot see where to cut anymore"*, *"have the option not to
have curved edges"*, *"the sticker exceeds"* (a 25 mm NFC sticker covered the venue), *"a back to back print … it needs
to align properly. back part does not need cut lines"*, *"the qr code will not be cut out"*, *"color code cut 1"*.

- Ganged pass sheets (`lib/print-render-pdf.ts`): every trim edge is a line across the whole sheet (through the
  gutters), so each strip keeps its next cut. Cut 1 (across) is red and numbered 1, cut 2 (down) black and numbered 2;
  the numbers sit where home printers print; a legend says the order. The die line is a soft paper tone, not magenta.
- Print settings › Passes › Corners: Rounded / Square (`include.passCorners`, default rounded; square → `rect` die).
- NFC on: the 25 mm sticker spot moves to the pass's BACK, behind the QR (mirrored), with the couple's own mark, the
  date and the Event Hub address. Ganged sheets print a backs page after each fronts page, cells mirrored, no cut
  lines; one guest's pass is a 2-side PDF. The front says "Scan or tap" (phone card: "Scan or tap at the door").
- The pass's dashed tear line is gone — the QR is the guest's entry and is never cut off.

SPEC IMPACT: Prints — pass imposition (cut lines, backs), pass corners setting, NFC spot placement on passes.
