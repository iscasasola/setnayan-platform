## 2026-11-18 · feat(theme): the supplier dashboard opens to dark, in its navy

Owner, 18 Nov 2026: **"do supplier navy dark next"** (after "all picks" — pick 1, "supplier navy kept" — on the
drawing `prototypes/dark_mode_elite_2026-11-18_fable.html`; the navy itself is the 16 Nov ruling "SUPPLIER
DASHBOARD = THE OWNER'S BLUE LOOK, LIGHT AND DARK"). Stacked on dark mode PR 1 (the one colour set).

- **The navy is a scope, tokens only.** `app/vendor-dashboard/_components/supplier-look.css` gains
  `html.dark:has([data-supplier-look])`, which re-points the one colour set while a supplier page is on screen in
  dark: page `#0D1626` · card `#172338` · tile `#1F2F4A` · wash `#283A58` · words `#EEF2F8` / `#B4BECE` /
  `#9AA6B9` · links `#7DB1FF` · the main button `#2272E6` with white words · amber `#F2A93B` as the small accent ·
  the hero a navy card lit blue from one corner · the same three soft lights on the ground. Everything that
  points at the set (`--m-*`, `--sn-*`, `--fd-*`) follows by itself.
- **The accent as a word.** The button's deep blue cannot also be text on the navy (3.46:1), and no single blue
  can be both. `text-mulberry` and `text-sn-accent` now read `--color-mulberry-word` / `--sn-accent-word` first
  (`tailwind.config.ts`, text only — the `text-terracotta` precedent). They are set only in the navy scope (the
  link blue, 7.20:1); unset everywhere else, so Light and the couple's dark paint exactly what they did.
- **`/vendor-dashboard` is on `DARK_READY`.** Before it was listed: solid `bg-white` → `bg-raised` (100 uses, the
  same pixels in Light), `text-cream` on the main button → `text-sn-on-accent`, stock-palette colours given a
  status-token dark partner. The dark-contrast record fell from 101 to 88 unreadable uses, zero under
  `app/vendor-dashboard`.
- **Guards:** `the-navy-is-readable.test.ts` (the ruled values · every text/surface pair at AA with the scope
  layered over the app's dark tokens · the word tokens · the ready-list) and a down-only raw-hex ratchet for the
  supplier tree (`raw-hex-only-goes-down.test.ts`, 79 today — 63 of them the look's own token file). The counter
  moved to `lib/raw-hex-ratchet.ts`, shared with the couple's ratchet.
- `html.dark .sn-ambient` reads `--sn-ambient-dark` (unset = the plain page), so a look can light its dark ground
  with a token instead of a component rule.

**Also fixed here and on PR 1:** in Light, `--m-ink` and `--m-mulberry` became pointers in PR 1 and would have
followed the supplier scope's navy ink and blue (172 reads). The Light scope now pins them to the warm ink and
terracotta they painted, so Light moves no pixel on supplier pages either.

**Not verified:** only the supplier screens with a lab were rendered in dark; the rest need a signed-in walk.
The contrast lint judges dark with the app's warm dark tokens, not the navy scope — the navy's own pairs are
held by `the-navy-is-readable.test.ts`, token against token, not per class use.

SPEC IMPACT: None new — the navy and the approval are already in the corpus (16 Nov and 18 Nov rows).
