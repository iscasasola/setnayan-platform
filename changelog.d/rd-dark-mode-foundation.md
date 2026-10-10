## 2026-10-11 · feat(theme): dark mode's foundation — the switch, the control, the tokens, the fences

Owner, 2026-10-11: **"dark mode should work."** (supersedes the 2026-06-04 "just always keep it
light theme"; the control is the "Appearance = Light · Dark" approved 2026-10-07.)

**The record, taken before any app file was touched** (`origin/main` a316051dd). Every later commit
on this branch is compared against it and must leave every LIGHT value identical:

- every custom property of every plain `:root` rule in `apps/web/app/globals.css`, resolved — 158
  values (117 of them colour / shadow / glass), sha256 `90b85b5e…600acb9160`;
- every colour of the resolved Tailwind theme, resolved in light — 351 values, sha256 `8c688089…d5f7e452`;
- a compile of the colour utilities (19 utilities × the app's colour families × every step, plain,
  `/40` and `hover:`) — 8,139 declarations, resolved in light, sha256 `d4ed073a…723a3289e`;
- the real guest page, byte for byte: `apps/web/lib/site-body-fixture.golden.html`,
  sha256 `29080537…796bb65ec` — never regenerated on this branch.

Measured the same day: of the 117 colour / shadow / glass tokens, 24 had an `html.dark` value and
93 did not.

SPEC IMPACT: None in this commit (the record only). The ruling is already filed in the corpus
`DECISION_LOG.md` (2026-10-11, "DARK MODE MUST WORK").
