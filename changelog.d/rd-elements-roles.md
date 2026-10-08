## 2026-10-08 · feat(studio): Elements by role — Pairing ▾, four role rows, AA badges (restudy 3/9)

Owner, verbatim (2026-10-08): *"colors here is not color of the background but
the colors of the different fonts, and buttons and highlights"* · *"fonts will be
multiple fonts like, details, button font, header font, etc."* → *"restudy is
good"* (DECISION_LOG "APPROVED — THE LOOK RESTUDY"; contract
`BACKGROUND_RESTUDY_2026-10-08_fable.md` § 2.2, § 3.5, § 6 row 3). Stacked on
restudy 2/9 (`rd/background-source-cards`) with the column
(`rd/site-roles-column`, its own PR) merged in.

The new Maker's Studio only. Every pick goes to the draft through the one draft
door; only ✓ Apply publishes; no Save button; no new server action.

- **`events.site_roles`** (`lib/site-roles.ts`) — a role's own font and colour:
  `{heading:{color}, body:{font,color}, button:{font}, highlight:{font,color}}`,
  sanitised (known roles and fields, a real font key, a plain hex; empty = null).
  The Headings font stays `site_font_key`, the Buttons fill `site_button_color`
  and their shape `site_button_style` — one fact, one column.
- **The draft** holds it (`HUB_DRAFT_LOOK_COLUMNS`), counts a real change once
  (compared through the sanitiser, key order ignored), never asks Event Hub Pro
  for it (`HUB_FREE_LOOK_EVENT_COLUMNS`), and names it "Look · Elements".
- **The guest page** (`guestLookFrom`) layers a role's pick LAST — over the
  palette, the couple's colours and an ombré: Details → `--font-body` ·
  `--color-ink`, Highlights → `--font-mono` · `--color-terracotta*`, Buttons →
  `--hub-role-button-font`, Headings → `--hub-heading`. The look scope wears
  `data-hub-roles`, and four rules in `globals.css` reach what no variable did —
  each ONLY under its mark. A heading with a colour of its own, and a heading
  inside a scene that re-inks itself over its photo, keep theirs.
  **Nothing stored → no variable, no mark: a page nobody changed is exactly what
  it was** (held by the guard, on the page's own look resolver).
- **Studio › Look › Elements** — Pairing ▾ (the shipped theme pairings applied as
  a set: fonts from the theme, colours back to the Mood Board's) and four rows,
  Headings · Details · Buttons · Highlights, each showing the role in its own
  font and colour ON the page colour, its swatch, and an AA badge (amber when it
  does not read, with the ratio said under the colour). A row opens in place to
  Font ▾ (the one font dropdown) and Colour (the Mood Board's one picker).
  The Headings font is the shipped typeface control and the Buttons row holds
  the shipped Buttons control — the same nodes, placed in their role, never
  drawn twice. The shipped Maker (flag off) is unchanged.

Not built, each said in the PR: a Buttons LABEL colour (the shipped rule is
"the label is never chosen" and #6437 is changing that rule now); the
prototype's three extra colour presets (Deep & gold · Soft · Garden); Stages ›
Aa "Event Hub font (role)" (plan row 4); the picker's "Against the background"
shelf (the picker is #6427's).

Guard: `lib/elements-are-roles.test.ts` (7 tests) — ten sabotages seen red (an eleventh, on a rule no fixture can make differ, was re-aimed);
`the-look-is-one-panel` and `hub-font-shelves` re-aimed. The four CSS rules were
also run in a real browser against the shapes the guest page draws.

⚠ Until `events.site_roles` exists in production (PR `rd/site-roles-column`),
this branch's preview cannot load an event: its events selects name the column.

SPEC IMPACT: None beyond the approved contract — the narrower column shape and
every deviation are recorded in the corpus at
`LOOK_RESTUDY_BUILD_STATUS_2026-10-08.md`.
