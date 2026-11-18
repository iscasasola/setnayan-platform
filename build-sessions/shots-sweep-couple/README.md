# Couple sweep — 390 px shots (16 Nov 2026)

Taken with `next dev` and fixtures (no database), at 390 × 844 @2x. The approved 16 Nov values were injected,
because the shared-layer PR sets them and this branch only reads the tokens:
`--sn-page-bg: 247 245 244` (#F7F5F4) and `--sn-frame-shadow: var(--m-shadow-md)`. Without them, the frames draw
flat white with no border on a white page.

1. Receipt page: the page reads `bg-page`.
2. Notifications while loading: five frames on the frame tokens.
3. Day-of "From your suppliers": a frame on the frame tokens.
4. Details › Pricing: a frame on the frame tokens. The radio rows are fields and keep their look.
5. Save-the-Date launch: *Launch now* is `ActionButton tone="brand" main`. The tinted box is a tone notice, so it
   is unchanged.

Shots 2–5 came from a temporary lab page that rendered the shipped components. That page was not committed.
Scan: `node build-sessions/shots-sweep-couple/scan.mjs`.
