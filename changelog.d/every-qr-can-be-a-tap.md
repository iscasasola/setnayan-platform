## 2026-09-20 · feat(qr): every link-QR carries Download · Write to NFC · Copy link — the same link, as a tap

Every QR on the site that is a LINK now carries one control strip
(`app/_components/qr-actions.tsx`): **Download**, **Write to NFC**, **Copy
link**. "Write to NFC" (`app/_components/nfc-write-button.tsx`) writes the QR's
own URL onto a blank NFC sticker as one NDEF URL record, so a phone can TAP
the sticker instead of scanning the code — iPhone and Android both open the
page from a tag; only the writing is platform-bound.

Surfaces (held by `app/_components/every-qr-carries-the-strip.test.ts`, which
pins the mount COUNT per file): the supplier's Shortlist QR on My Customers
and on the invite page, the just-issued and pending Locked QRs, the On-the-Day
review QR; the couple's per-guest invitation QRs (table + list), the branded
custom QR cards, the guest join-link QR, and the website editor's scan-to-view
popover. The guest's own code keepers (`guest-code-keepers.tsx`) gain the NFC
button alone, beside their existing Save + Copy. Two vendor surfaces had
Download and Copy already; several had one or neither — the strip is one
component so the next QR cannot grow a fourth subset.

Deliberately NOT on the strip: the three payment QRs (checkout drawer, pay
panel, Pabuya) — a bank payload is not a link — and the crew pairing QR, whose
`setnayan://` scheme iPhone ignores on a background read (and which has no
https receiver yet). `lib/nfc-tag.ts` refuses both by eligibility even if
mounted; the guard forbids mounting.

The sheet has one waiting state and four exits, each named: **Tag written** —
decided ONLY by reading the tag back and matching the link exactly, never by
`write()` resolving (the guard asserts every transition to success sits behind
`readBackMatches`); **Not confirmed** — the write returned but the tag left
before read-back, with a Check tag button; **Write failed** — every
DOMException mapped to one plain sentence (permission, NFC off, tag moved,
locked, too small, wrong tag type, 30 s timeout, browser cannot write);
cancelled closes quietly. Byte budget is computed BEFORE the tap: a real
per-guest link (32-hex token, nested /u/ path) fits an NTAG213; longer links
name the sticker they need.

**Flag: `NEXT_PUBLIC_NFC_WRITE_ENABLED`, OFF.** `lib/nfc-write-flag.ts`,
registered in `flag-chokepoint-scan.test.ts`. The button is built to the Web
NFC spec (Chrome on Android; the installed PWA included) but a session cannot
produce a tap — the owner flips it after one confirmed write on a real
sticker. Download + Copy are not behind the flag. Where the browser cannot
write (iPhone, Safari, desktop, today's iOS shell), the button opens the same
sheet, says "Android only, for now", and offers the link to copy into a free
NFC app.

Follow-up (separate PR): CoreNFC via a Capacitor plugin in `apps/mobile`, so
the same button writes inside the iOS app; needs an entitlement and an App
Store re-review.

SPEC IMPACT: `DECISION_LOG.md` — new row 2026-09-20 superseding, for the
web strip, the 2026-07-01 "NFC vendor tags → DEFERRED TO V2" and the
2026-06-12 "NFC table tags = QR-only for now" entries (owner "go",
2026-09-20). No schema, no SKU, no price.
