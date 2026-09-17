## 2026-09-17 · feat(pabuya): we redraw the couple's payment QR from its own payload

⚖ **Owner ask 2026-09-17:** *"if we upload a QR Code, you will redesign a qr code
for us"* — using the same render already produced by hand for his own event.

A couple does not upload bare QR modules. They upload what their banking app
hands them: a screenshot wrapped in the bank's logo, their name, a masked
account number and a footnote, sometimes photographed off a second screen.
Measured on the owner's own event — a 1194×1565 JPEG whose actual code was about
a third of the frame, so the card's QR slot held roughly 25px of real modules.

🔑 **THE PAYLOAD IS THE VALUABLE PART, NOT THE PIXELS.** The upload check already
decodes and validates the image, so by the time we accept it we hold the
couple's payment instruction — merchant identifier, bank BIC, account number,
currency, CRC. Everything else in their screenshot is packaging. We redraw the
code from that payload at 1400px, margin 4, true black on true white, and store
that instead.

⚠ **Nothing is invented.** This cannot mint an account identifier; it re-encodes
one the couple proved they hold by uploading it. The bytes change, the
instruction does not.

### The round trip is the safety property

Every redraw is decoded again — through the SAME shared decoder the upload check
used — and compared to the source payload byte for byte. Anything other than an
exact match returns null and the couple's original stands. An image that looks
like a QR code is not evidence that it encodes the same instruction; only
reading it back is.

### Three deliberate choices

- ⚠ **Error correction stays `M`. Higher would be WORSE.** `H` adds modules, so
  at a fixed pixel width each module gets SMALLER — the opposite of the problem
  being solved. Nothing is overlaid here that needs the redundancy (the
  invitation QR carries a monogram and is a different case).
- ⚠ **True black on true white, not the brand palette.** A scanner thresholds
  luminance, and cream + mulberry narrows that margin for a code most guests see
  for four seconds on somebody else's phone. Brand the CARD, never the code.
- 🔒 **We redraw only what we understand.** A PayPal link QR, an unknown rail, or
  an EMV-shaped string with a bad CRC is refused and the original kept —
  re-encoding a corrupt instruction would launder it into something that LOOKS
  freshly generated.

### The redraw displaces a second object

The couple's own upload is now superseded, and it is a payment identifier like
any other. Both write paths (insert and update) retire it; a guard asserts
exactly 2, because otherwise the feature quietly doubles the number of bank
screenshots we hold instead of replacing one. The redraw is written to the same
home an upload uses (`pabuya-qr/<eventId>/`, private bucket) so every reader,
cleanup scope and the serving route's policy treat it identically.

Guarded by `lib/pabuya-qr-render.test.ts` — 9 executed redraw decisions, count
printed, including that every EMV tag survives and that a broken CRC is refused.

⚠ One existing guard had to be corrected: it pinned the literal
`if (!verdict.ok) return verdict;` and went red when the checker began returning
`{ verdict, payload }` so the payload could feed the redraw. It asserted a
SPELLING; it now asserts the PROPERTY (a not-ok verdict returns), and was
sabotage-checked to confirm it still bites.

SPEC IMPACT: None — no ruling changes; this is a rendering improvement on an
already-validated upload.
