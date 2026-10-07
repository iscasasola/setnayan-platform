## 2026-10-07 · chore(fonts): ship the upstream OFL.txt beside every bundled OFL face that lacked one

Fourteen self-hosted font folders under `apps/web/app/_fonts/` (Bodoni Moda,
Cinzel, Cormorant Garamond, DM Mono, Fraunces, Great Vibes, Hanken Grotesk,
Libre Caslon Display, Luxurious Script, Manrope, Playfair Display, Space Mono,
Tangerine, Vidaloka) shipped their `.woff2` files with no licence beside them.
Each now carries its family's `OFL.txt`, copied verbatim from the official
`google/fonts` repository (`ofl/<family>/OFL.txt`) — the upstream these faces
were served from when they were `next/font/google` (see `app/layout.tsx`).
`apps/web/lib/social/fonts/` (Cardo, Cormorant, Great Vibes, Poppins) gets one
`OFL.txt` carrying all four families' upstream copyright lines above the
OFL 1.1 text. No font file, CSS or code changed.

Folders already covered by a `LICENSES.md` (`assets/cipher-fonts`,
`public/logo-fonts`, `public/monogram-studio/fonts`) were left alone.

The "Settle a payment" title + badge item from the same queue was NOT done
here: both the label (`serviceLabel`) and the badge (`payItems.length`) live
in `app/dashboard/[eventId]/_components/event-dashboard.tsx`, a Home file
another builder owns tonight.

SPEC IMPACT: None
