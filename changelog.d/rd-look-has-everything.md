## 2026-10-03 · fix(maker): Look is one panel — Theme · Background · Font · Colours

Owner, live iPhone test 2026-10-02 (tracker f40): the toolbar's **Look** showed the
theme and then the Hero — no background, no font, no colours. The Hero said to tap
text on the canvas for font and colour, which a phone's panel covers; Mood Board ›
Palette is supplier sign-off, not the guest page's colours. Rulings: DECISION_LOG
2026-09-30 "'BEHIND EVERY SCENE' MOVES INTO THEME, WITH FONTS AND COLOURS" and
"✂ THE MAKER RE-PLAN IS CUT TO ITS CORE" (*"Theme sets background + fonts +
colours"*, *"one font dropdown"*), 2026-10-01 *"accessing it here is too hidden"*;
design `maker_in_four_2026-09-30_fable.html` frame E.

**Look = one panel, in this order** (`lib/maker-look-sections.ts` `LOOK_SECTIONS`,
drawn by `LookPanel` in `launch/_components/details-look-pages.tsx`):

1. **Theme** — the shipped theme pick (`MakerThemeMenu`), unchanged.
2. **Background** — "Behind every scene" (`MainBackgroundPanel`, #6135): the
   theme's own · same as my hero ◆ · upload media ◆ · none, just the colour.
   MOVED from the Hero page and from the scenes column's 🎨 panel.
3. **Font** — the one font dropdown (`FontPick` → `site_font_key`, #6160) ◆.
   MOVED from the 🎨 panel's Colors row.
4. **Colours** — page and button colour (free), Candlelight and Magic Move (◆, as
   before), then **Palette ▾** (#6226) with one line saying where it shows
   (*Styles "Our colours" in the Dress code scene, and each guest's own colours* —
   it never recolours the page, which is why the Welcome canvas did not change).
   MOVED from under the Dress code scene's Style.

Every control is the same component saving to the same field into the draft (the
`updateSiteColors` door reads an absent field as unchanged, so the Font and Colours
parts — one `ColorsPanel`, `part="font" | "colours"` — never clear each other); Apply
is still the only thing guests notice.

**Look's body is the couple's own page** on the stage they are editing (the host
canvas door, `?editor=1`, reloaded on each save like the Hero's page), so a change
shows as it is made; the theme sample gallery is one switch away ("Your page · All
themes"). On a phone, opening Look opens its sheet (no closed "Edit · Theme" handle).

**Removed (replaced by Look):** the Main background under the Hero page; the 🎨
panel's "Behind every scene" and Colors rows and its "Theme · Change in Event
Details" line (`ThemePanel`) — the 🎨 panel keeps music and the invitation
backdrop; the Palette row under the Dress code scene's Style. Old doors land on
Look: `?open=main-background|colors|font`, Apply's "Go to" for Theme · Typeface ·
Candlelight · Magic move · Ombré · Behind every scene (new jump `{ kind: 'look' }`;
`{ kind: 'main' }` retired), and the Maker tour's last step.

Guard: `lib/the-look-is-one-panel.test.ts` — renders the panel and holds the four
sections in order with each control in its own section (sabotage: render order
swapped → RED, restored → GREEN), the moves, the old places empty, the parts'
fields, and the jumps. Port baseline regenerated (`ThemePanel` deliberately removed).

SPEC IMPACT: None
