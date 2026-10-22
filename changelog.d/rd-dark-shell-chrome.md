## 2026-10-23 · fix(dark): B1 — the shell and shared chrome paint dark (no route on the ready-list yet)

Batch B1 of the approved plan `prototypes/dark_mode_rollout_2026-10-22.html`. Inert until B2 puts a
route on `DARK_READY`; light is byte-for-byte unchanged (pixel diff of every touched screen: 0 px).

- **The bottom bar** (`bottom-nav.tsx`): its three inline light literals — the frosted fill, the active
  pill, the press-light — read `--sn-dock-bg` / `--sn-dock-pill` / `--sn-dock-press` (globals.css, light
  values identical, html.dark pairs added). In dark the bar stayed light and its labels read 1.15:1.
  `lint-bottom-nav.mjs` now pins the NAV-9 light values where the tokens are declared, demands a dark
  pair, and refuses a literal background on the bar (sabotaged three ways → red).
- **The shell** (`front-door.css`): the nine dark-contrast pairs (chips 1.13:1, the ask pill 1.04:1, the
  search button, mic, notice, kind tag, gold hover) plus the app's top strip (white 55 % = a grey band in
  dark), the date chip, the invite panel and the warm kind tag read new `--fd-*` tokens with
  `html.dark .fd` pairs. Dark-contrast baseline 296 → 287 (only removals).
- **The rail plaque** (`account-switcher.tsx`): its words read the gold WASH token, which goes dark
  under html.dark; the plaque is dark glass in both themes, so its words are a fixed light colour.
- **The phone's clock** (`native-bridge.tsx`): `StatusBar.setStyle` follows `html.dark` (dark text on
  Light, light text on Dark), asked only on a flip. Web code; the plugin is in the shipped app. Held by
  `app/_components/the-clock-follows-the-theme.test.ts`.

SPEC IMPACT: None — implements the approved plan (DECISION_LOG 2026-10-13 calls 1–10).
