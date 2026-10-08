## 2026-10-08 · feat(look): Elements › Buttons is the Reply button in three shapes — no "Default"; the colour is the palette's (amendment PR 5, step 1)

Owner, verbatim (2026-10-08): round 5 — *"do not need to show default button just show the 3
button styles"* · round 3 — *"button color will be taken from their 5 palette"* · round 2 —
*"Pick Button Shape (color is on the palette already so no need to add)"*. Contract:
`BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` § 2.B / § 2.E, prototype frame B05. Local commit.

- **Three cards, each the real button:** Square · Rounded · Pill — "Reply", at the guest
  button's own size, in the page's own button fill, its name under it. Shape ▾ (a dropdown
  with "Default") is gone. The picked one wears the accent ring and name and centres itself.
- **The theme's own corner is READ, never written** (`lib/hub-button-shapes.ts`): an event
  that never chose keeps its theme's corner; the row rings the one of the three that corner
  reads as (0 → Square · a pill → Pill · anything between → Rounded — so five themes ring
  Rounded, five ring Pill) and draws THAT card with the theme's real corner. A tap on the
  ringed card writes nothing; the page changes when another is tapped.
- **The colour is the palette's:** the cards are drawn with no colour of the row's own — the
  page's button fill (the couple's Accent, deepened until its label reads). A quiet "● Accent"
  says so. A Shape pick hands a colour stored before this (`site_button_color`) back to the
  palette (the note: "nulled on the couple's next Buttons write"); the stored FILL half of
  `site_button_style` is carried unchanged and still drawn (an outline stays an outline).
- No new storage, no migration: `site_button_style` keeps its vocabulary (`theme` is still a
  value a row may hold).

control → kind: the three → a Style-card strip whose picture is the real button (accent ring ·
accent name · centred). Requests: a pick = 1 draft write, held — unchanged; opening = 0.

Guards: `look-buttons-reach-every-button` (4) and (6) re-aimed, with the reason — (6) used to
hold "ONE dropdown, and a stored colour is still worn by the sample"; the owner's rounds 3 and
5 replace both. Now: the three cards rendered on every theme (order, words, one ring on the
theme's reading, the theme's real corner, the page's own fill), a stored colour makes no
difference, a stored fill is carried and drawn, a tap on the ringed card reaches no write.
`every-studio-colour-opens-the-one-picker`: its hand-kept list of files that paint a handed
colour gains three lines — this row's Accent dot, the Effects cards (Colour ▾'s dots and a
veil), and Background › Colour's two circles (L3's file; the list arrived with the new base
and was already red on it). 14 sabotages seen red.

Deviations, each with its reason:
1. **The guest page still honours a stored `site_button_color`** until that event's next
   Buttons pick. The note wants the page to stop reading it at deploy, after "the controller
   confirms the count" of events that hold one — a count I cannot take (no production reads).
   One line in `guestLookFrom` when that count is known.
2. **No way back to the theme's own corner from this row** once a shape is stored (there is no
   "Default" card by ruling) — Undo and Restore are the way back.
3. The three fit a 375-px row, so nothing peeks (the note drew four).
4. Event Details' one-line summary still says "Default" for an untouched event
   (`details/page.tsx`) — not changed here.
5. The row is one component, so the shipped Maker's Look and Event Details' Buttons row show
   the three cards too.

NOT SEEN in a browser at commit time.

SPEC IMPACT: None beyond the contract above.

## 2026-10-08 · fix(look): the buttons' colour has ONE source — a colour stored before the ruling is no longer read by the guest's Event Hub

Owner, verbatim (2026-10-08, round 3): *"button color will be taken from their 5 palette"*.
The note's condition for this step — "the controller confirms the count" — was met the same
night (controller, read-only on production): 16 events · 0 hold a `site_button_color`. No
screen has offered one since the Colour ▾ row left Look. Local commit.

- `proSiteVarsFor` builds no button colour (`buildCustomSiteColorVars(bgHex, null)`);
  `guestLookFrom` resolves the buttons with no colour of the couple's own; the main ground no
  longer spares "their own button" from a picture's tint. Studio › Look's sample and the
  Background panel are told the same (`lib/look-sample.ts`, `ownButton: false`).
- The column stays (no migration) and is still read into the row — it is only no longer worn.
- This removes deviation 1 of the entry above.

Guards: `the-look-sample-is-the-guest-look` (8, new) — the guest page's own function, run
over every swept look that holds a stored colour (1,000+), with it and without it: the same
variables, the same buttons — for a Pro event and a free one; over a picture, with and
without a Fade. Re-aimed, each with the reason written in the test (they held the OLD rule):
`look-buttons-reach-every-button` (2) · `a-dark-look-keeps-its-words` (4: "the couple's own
button colour is never moved") · `free-vs-pro-redrawn` (💎 the button colour) ·
`app/[slug]/_lib/free-bg-colour-paints` (3 tests) · `a-background-pick-shows-at-once` (8: two
pinned lines). 5 sabotages seen red.

⚠ STILL READ ELSEWHERE — not changed here, each a guest or public surface of its own:
the invitation door's button (`invite/_lib/load-invite-look.ts` → `resolveInviteButton`),
`/[slug]/recap` and `/[slug]/pabuya` (`_lib/hub-look.ts`), the Discover card
(`lib/discover-events.ts`), the print set (`lib/print-set.server.ts`), the celebration card
(`lib/celebration-card-identity.ts`), and the shipped Colours action still accepts a
`button_color` field no screen draws. With 0 rows holding a colour none of them can show one
today; whether they follow this ruling is a call per surface.

SPEC IMPACT: None beyond the contract above.

## 2026-10-08 · feat(look): Elements › Fonts is four rows — Names · Headings · Text · Labels & buttons — and Fonts ▾ fills all four (amendment PR 5, step 2)

Owner, verbatim (2026-10-08, round 5): *"i think there are more than just 2 types of fonts to
edit"*. Contract: `BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` § 2.E, prototype frames B06 ·
B06b. Controller's rulings the same night: the stored shape is fonts only; ruling **A** on the
names (below). Local commit.

📌 **THE PRE-EXISTING FACT, ON RECORD** (computed in a headless browser on the review copy's
guest page, 2026-10-08 — not read from code): the Event Hub masthead's names
(`<h1 class="… font-pahina …">`) computed to **Fraunces** while the scope's `--font-display`
was **Cormorant**. `font-pahina` is the fixed variable `--font-pahina-display`; no theme and
no couple's font re-points it. Counted in `app/[slug]`: `font-pahina` 106 uses (the masthead's
names, venue names, many small titles) · `font-serif` 160 + `font-display` 37 (these follow
`--font-display`). So the couple's one "Headings font" (`site_font_key`) moved about two
hundred headings and NEVER their own names on the hero — and Studio › Look's sample drew its
names with `font-display`, a face the page did not use for them. **Of the two, the SAMPLE
was wrong.** Measured on production by the controller that night: 16 events · 0 hold a
`site_font_key` · 0 hold a `site_roles` — so nothing below changes a live page.

- **Storage — no migration.** Names = `events.site_font_key` (as before). Headings · Text ·
  Labels & buttons = `events.site_roles.{heading,body,highlight}.font` — the column main
  already has (#6458), read as FONTS ONLY (`lib/site-roles.ts`): the colours and the separate
  button font it was first drawn for (#6442, never shipped) are dropped on read.
- **On the guest page** (`lib/site-role-look.ts`, layered last in `guestLookFrom`):
  - **Names** → `--hub-names-face`, worn by the big names on the three hero surfaces —
    the Event Hub masthead (its three designs), the private landing, the invitation's header
    where its title is the couple's names — through ONE mark (`data-hub-names`) and ONE rule
    that matches only where a Names font was chosen (`data-hub-roles~='names'`). **Names now
    reach the names.**
  - **Headings** → `--font-display` · `--pahina-face`. With no font of their own, **Headings
    follow Names** — the two variables stay `site_font_key`'s, exactly as today.
  - **Text** → `--font-body` · **Labels & buttons** → `--font-mono` (eyebrows) and the buttons'
    face. Three more small rules, each only under its own mark.
  - Nothing chosen → no variable, no mark: the page is byte for byte what it was.
  - NOT touched: the other ~100 `font-pahina` texts (venue names, small titles) stay Fraunces
    — no row reaches them, as before.
- **In the Studio** (`fonts-look-rows.tsx`, drawn by the Colours panel for the Studio's Font
  part): **Fonts ▾** — the shipped themes' pairings; one tap fills all four; "Your own mix"
  once a row is changed alone — then **Names ▾ · Headings ▾ · Text ▾ · Labels & buttons ▾**,
  each the shipped font dropdown (every face named in its own face). A row with nothing of
  its own reads "Event Hub font"; Headings reads "Same as Names". The shipped Maker keeps its
  one Typeface row (it is the Names font).
- **The sample screen** now draws its names as the hero does (`font-pahina` + the mark) and
  wears the scope's own marks, so the page's own rules apply to it; it no longer spreads the
  Names font a second time over the scope (that would have put Names back over Headings).

control → kind: five rows → Form row (ⓘ beside "Fonts"); the five ▾ → Dropdown.

Requests (read from the one write path, not counted with a stub): a font pick = **1 draft
write, held** (`makerRedrawSave`) — no whole-Maker render, no `router.refresh()`; the hidden
page redraws once when it is next shown. Opening a ▾ = 0. The Maker's own read of the event
gains one column in a read it already makes (+0 requests); the guest page's shell read gains
the same column (+0).

Guards: `lib/the-four-fonts-reach-the-page.test.ts` (8, new) — the shape; each font's
variables and marks; THE GUEST PAGE'S OWN FUNCTION run both ways over every theme × five
looks (no font → the very bag a row with no font columns gets, no mark; a font → its variable
and mark; Headings follow Names; a Headings font beats the Names font; Headings alone do not
mark the names); the mark drawn in exactly four files, the ONE names rule and the four marked
rules read out of the stylesheet, and no rule or variable that would move `font-pahina`;
the sample; the draft; the rows rendered. `the-look-sample-is-the-guest-look`: its 4,200-look
sweep now carries the four fonts and compares the marks too (11/11). 20 sabotages seen red.
⚠ What no test here does: compute a font in a browser. The rule's words and reach are held;
the computed face is a look on the review copy.

⚖ First-load weight, on record (standalone, minified + gzipped; a real bundle shares words):
the effects' sanitiser +248 B · this step: `lib/site-roles.ts` 264 B + the draft library
+45 B = **+309 B** · sum ≈ **0.56 KB** against 0.1 KB of room. (My earlier estimate for this
step was 0.15–0.2 KB — low.) The controller owns finding the bytes at bundling.

Deviations and things to know:
1. **Headings alone + no Names font:** the masthead's names stay Fraunces (untouched), but
   the private landing's and the invitation header's names are `font-display` / `font-serif`
   text and so follow the Headings font, as they always followed the headings' face. Choosing
   a Names font sets all three.
2. The invitation ENTER door's title is not marked (it is "<hosts> · Today" or a sentence);
   only the RSVP/reply header is, and only when its title is the couple's names.
3. Event Details' Font row and the shipped Maker keep the one Typeface dropdown.
4. The lab draws the four rows on its own draft stand-in.

NOT SEEN in a browser at commit time.

SPEC IMPACT: None beyond the contract above (the fact above is recorded here for the corpus).
