## 2026-09-28 · feat(maker): the hero's "the day, the place, the story ↓" link is a part — its words are the couple's

Owner, tapping the link in the Maker: *"why can't i update the text"*. Every
other word on the hero was a part (tap → its sheet), but the link was drawn as a
fixed string outside the `el()` / `txt()` helpers in `PahinaMasthead`, in The
Card and in Designs 2–4.

- **`link`** is now a hero part (`HUB_HERO_ELEMENT_KEYS`, label "Details
  link"): tap selects it; the Text tab gets a words row (the card's words as
  the hint) plus the same font · colour · size · spacing rows, runs, Animate
  and Arrange → Hidden as every other part. Free vs Pro unchanged
  (`HUB_ELEMENT_PRO_FIELDS`: font and motion Pro; words, colour, size free).
- The words ride the EXISTING `HubElementStyle.word` (the joiner's field), in
  the hero row's `canvas.elements` — no migration, no new action.
  `sanitizeHubPartLine`: one line ≤ 60 characters, no control characters.
  Cleared → the card's own words (an absence — the joiner's rule).
- The part is a wrapper around the `<a>`, so the colour and face reach the
  words and the ↓, and the hero's alignment moves it. The href (`#details`) is
  untouched. The canvas preview rewrites the words at once
  (`applyPartWords`, was `applyJoinerWord`).
- **`venue`** (the plain / hero-photo masthead's venue line) is a part for
  STYLE only — its words are the event's venue from Details.
- The Part ▾ and "Style a part" list only the parts this hero draws
  (`heroPartsFor`: the card draws line · time · link, the plain masthead the
  venue).
- New guard `lib/every-hero-word-is-a-part.test.ts`: every word a guest can
  read in the masthead (every design, card and plain) sits in a registered
  part, and nothing between a part and its words carries its own colour or
  face. It found two more: the **Date**'s inner span carried its own face and
  colour (`font-pahina … text-ink`, The Crest's `text-ink/60` and tracking),
  so a colour or font chosen for the Date never reached the words — FIXED here
  by moving them onto the part, in The Card and Designs 2–4; and the photo
  caption repeated the venue outside any part.
- **`caption`** (the small line under the hero photo) is a part too — owner,
  on that finding: *"make it editable"*. Its own words (the same one-line rule,
  `sanitizeHubPartLine`), the venue by default, cleared → the venue again;
  listed in Part ▾ only when there is a hero photo/video. The guard now has no
  exemptions and no known-blocked parts.

SPEC IMPACT: None — extends the 2026-09-26/27 per-element editing decision to one more hero part.
