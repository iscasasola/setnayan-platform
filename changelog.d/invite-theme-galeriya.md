## 2026-09-13 · feat(invite): Galeriya skin — the photo hung as the work, the names as its label

The third of the four Event Hub Pro invite themes (owner 2026-09-10, "elegant,
classy, sophisticated, rugged, and generic"). Galeriya is the SOPHISTICATED one:
a flat light gallery wall, one hairline rule standing the full height of the page
that everything ranges off, the couple's reveal background hung as a framed
print, their names beneath it as the wall label, and their colour as a single 3px
tab on the rule beside the name — ornament only, never a word, never the action.

Ported from `Design_Invite_Themes_2026-09-10/designs/galeriya.html`, not redrawn.
Same shape as Capiz and Velvet before it: a new skin file, ONE case in
`inviteSkin`, and `ready: true` in the registry. No migration, no table, no SKU —
the four Pro themes ride `COUPLE_WEBSITE_PRO`, which is already sold.

**Owner Q4 = B — the print is shortened until "Continue" sits on the first
screen.** Measured in the browser at 375x812 on the real component tree, not on
the design board. Both figures (before and after) are in the PR body.

**Two port corrections, both from DoorShell being a centred card rather than the
board's top-ranged column:**

- The work hangs INSIDE the card, not on the wall above it. The only slot a skin
  has above the header is `crest`, which renders inside the card; a print on the
  wall would need space the skin cannot reserve and would land on the wordmark,
  the only navigation a door carries.
- The name is 40px, not the board's 64px, and it came down with the print for the
  same reason: at 64px no print height reaches the fold at all.

**Type:** Schibsted Grotesk SemiBold only — SIL OFL 1.1, from
`github.com/google/fonts` `ofl/schibstedgrotesk`, instanced at wght 600, subset to
latin, woff2, with `OFL.txt` beside it (owner Q1 = A, 2026-09-11). The design's
400 and 500 dress the board's own fields and buttons, which a skin must never
restyle, so shipping them would be bytes nothing renders. The theme's other face
needs no download: the design's DM Mono is already this app's `font-mono`.

`lib/invite-themes.test.ts` follows the registry — Galeriya now resolves to
itself and is suggested by the `modern` feel; Abaca takes over as the
"unshipped skin is never offered" example, since it is now the only unready theme.

SPEC IMPACT: None. `lib/invite-themes.ts` already carried Galeriya's name, word,
tier, feels and opening from the 2026-09-10 decision; this flips `ready` and adds
the skin the flag was always promising.
