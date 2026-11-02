## 2026-09-29 · feat(dress-code): the palette wears a person — every role drawn in its exact colours, on the Dress code scene and the Mood Board

Owner, 2026-09-27 (DECISION_LOG "OWNER: 'YES TO ALL' — PALETTE, DAY-OF
SCHEDULE…", item 1): the dress code shows the palette three ways — swatches, an
**illustrated person in the exact role colours** (*"not AI — exact colour,
free"*), and Mood Board photos. Stage E of `EVENT_HUB_BUILD_PLAN_2026-09-28.md`
("palette's illustrated person").

- **Reused, not redrawn.** The gown and suit people the reception scene already
  draws (`lib/reception-scene.ts`) moved verbatim into `lib/role-figure.ts`;
  the scene imports them back and renders byte-for-byte as before (sha-256 of
  12 rendered venues identical before/after). The one addition is an optional
  accent — a sash on the gown, the tie on the suit — following the Mood Board's
  rule "colour 1 is the main piece, the rest accents".
- **Exact colour**: the garment's fill is the role's hex as stored. (The Mood
  Board's photo recolour, `RecolorStudio`, keeps the photo's lightness — a navy
  gown comes out light blue — so it was not used for this.)
- **Who wears it** (`roleFigures`): the bride, groom and gendered attendants are
  one person; a shared role (sponsors, parents, the party, custom roles) is a
  gown-and-suit pair; the guests — whose colours are OPTIONS — are one person
  per colour, never combined. A reader's own panel is their own person (a
  ninang sees one woman, not the sponsors' pair).
- **Where**: every role row of the Event Hub's Dress code scene and the "You
  are …" panel (`dress-code-widget.tsx`), and every role card and custom role
  on the Mood Board palette (`palette-section.tsx`), redrawn as the couple
  picks. Shown as an `<img>` of an SVG data URI (`app/_components/role-figure.tsx`)
  — no markup injected; no new route, action or column.
- Held by `lib/the-palette-wears-a-person.test.ts` (renders the scene and reads
  the colours each person wears).

⚠ Owner to see: these are the reception scene's simple figures — exact colour,
free, instant — not a detailed illustration. If a richer figure is wanted, that
is a new drawing (the owner's 2026-05-23 note on the old SVG silhouettes), not a
reuse.

SPEC IMPACT: None — implements the 2026-09-27 DECISION_LOG row item (1).
