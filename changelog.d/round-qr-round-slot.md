## 2026-09-30 · fix(qr): a round QR sits in a round slot — on every print, ticket and screen

Owner, verbatim: "Custom QR when shape is changed the slot for the QR should
also be round on the prints if the QR is round and not have a square frame with
round QR".

When an Event Hub Pro couple picked **Circle** for their QR, the code turned
round but everything it sat on stayed square: the white plate behind the corner
QR on every card, the Finer Details hub code, the poster's panel, the Printed
ticket's stub, the Digital ticket's rounded tile (all three designs), and the
free QR sheet's cut line.

- **Prints and the Digital ticket** (`lib/print-layout.ts`): every white plate a
  code sits on is now drawn by ONE helper, `qrPlate`, which reads the set's new
  `PrintSetData.qrShape` (filled from the event's `QrLook.shape` in
  `lib/print-set.server.ts`). A round code gets a round plate, concentric, with
  the same white margin. On the Poster ticket the facts (Arrive) move off the
  old tile and onto the card's own paper, in the card's own ink. On the free QR
  sheet a round code is cut out as a round token, with the name inside the
  circle. Square codes and free events draw exactly what they drew before.
- **On screen**: every plate that holds a guest QR (the guest's pass on the
  Event Hub, the Me panel, the My QR modal, the invite door, plus-one passes,
  the find-seat door pass, the dashboard invitation page, the shared join QR)
  carries a new `qr-slot` class. One CSS rule in `app/globals.css` rounds the
  plate when the code inside it is round (the code's root already says
  `data-qr-shape`). Nothing had to be threaded through the pages. The Maker's
  two QR previews wrap the picture in a plate that follows the saved shape,
  so a square code is never clipped.
- The two plus-one pass plates (`your-guests.tsx`, `plus-one-door.tsx`) now
  size the code to the plate: the 256 px code used to spill past its 192 px
  plate.

Held by `apps/web/lib/a-round-code-sits-in-a-round-slot.test.ts`. It sweeps
every piece, format and theme, and checks the drawn shapes and the rendered
SVG: for a round code, no rectangle hugs it and a circle holds it; for a square
code, the square plate is unchanged. It decodes the round code where it sits,
in every Digital ticket design and on 300-dpi printed cards on dark paper. It
also requires every on-screen QR plate to carry `qr-slot`. The guard was
sabotaged three ways, and each failed.

Not covered: two dashboard thumbnails that show the guest QR as a PNG, where
the page does not know the shape (`guest-detail-body.tsx`, `send-run.tsx`),
and the seating pack's place cards (a card with a name, not a slot for the
code).

SPEC IMPACT: None.
