## 2026-09-14 · feat(invite): Abaca — the Rugged invite theme, the last of the four

The fourth and last Event Hub Pro invite theme ships as a skin on `DoorShell`:
a letterpress show-card on kraft, with the couple's reveal background PRINTED
INTO the paper (`mix-blend-mode: multiply`, so the bare sheet is always the
white point and no photo can make a patch of ground lighter than the paper),
their date struck as a rubber stamp, their mark pressed as a wax seal beside
their name, and their colour as the twine DoorShell's own step rail hangs from.
With Abaca live, every theme the owner named on 2026-09-10 is shipped and the
Invite group closes.

A skin file, one `case` in `invite-skin.tsx`, and `ready: false` → `true` — the
`abaca` row itself was already in `lib/invite-themes.ts`. No migration, no
table, no SKU.

**Measured, and one expectation it disproved.** Both 40px themes before this one
had to come down for door 01's fold, so this one was expected to as well — it
does not. Abaca's head hangs no ornament above the name (the seal is beside it),
so it starts 66px higher up the card than Velvet's and "Continue" clears the
640px bar at the design's own size: y=529 at 10 characters, **605 at 27**, **599
at 45**, all at 375×812 with the date and venue on the line. Its six cells and
its model entry are in `the-door-keeps-its-action-on-screen.test.ts` (30 measured
cells now, all within 4px), which grew ONE per-theme term — `venueLine`, because
Abaca's stamp is `line-height: 1` at 12px and a second meta line costs it 12px,
not 16.

**A new guard: `the-print-never-reaches-the-wordmark.test.ts`.** The wordmark is
the only lettering that sits on the ground and the only control on a dead link,
and multiply only ever darkens — so a couple's night shot would put ink at 1.0:1
under it. The photo layer is masked out of the crown of the page, and the mask is
a PERCENTAGE because from `sm` DoorShell centres the column: across 21 viewports
the wordmark's foot ran 16px → 823px, a 17× spread in pixels, but never past
38.1% of the page. The guard re-reads the mask's stops out of the stylesheet,
works out how far open it is at 38.1%, and computes the contrast over a pure
black photo — 5.91:1 today, against a 3:1 floor for 24px/800.

**Type:** two faces, latin-subset woff2 with their SIL OFL 1.1 licences —
Alfa Slab One 400 (`ofl/alfaslabone`, 18.6 KB) and Oswald 500 (`ofl/oswald`,
instanced from the variable font, 12.4 KB). The design names Oswald 600 and a
third family, Bitter, as well; both dress the wordmark, the buttons and the body
copy, none of which a skin owns — so neither is downloaded. Declared in the
theme's own module, never in `app/layout.tsx`.

**Bundle:** shared client bundle 201.5 KB gzipped before and after (0.5 KB of
headroom kept). The three invite doors' own route chunks grow ~0.2 KB each
(`/[slug]/invite` 7.86 → 8.05 kB); no other route moves.

SPEC IMPACT: None. `lib/invite-themes.ts` already carried the Abaca row with
`opening: 'four-flap'` from the owner's 2026-09-10 decision; this only flips
`ready` now that the skin exists.
