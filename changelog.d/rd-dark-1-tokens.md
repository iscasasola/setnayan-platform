## 2026-10-13 · feat(theme): every shared colour token gets its dark pair — Light unchanged (dark mode PR 1)

Owner, 2026-10-13, "approve all" on the dark-mode map (DECISION_LOG "HOW DARK MODE IS TURNED ON"):
tokens and colour scales first, in the warm set of the approved template gallery (call 6).

- **globals.css** — the 76 colour tokens at `:root` that had no dark value (`--m-*` 41, `--sn-*` 35)
  each get one under `html.dark`, right after their own block: page `#17160F`, paper `#1E1C15`,
  card `#232019`, ink `#FBFAF7`, lines = paper at 16 %, gold `#CBA766`, CTA `#E5794E`, shadows in
  black. The old cool dark values (`#1E2229` / `#2A2E36` / `#22262C`) become warm. Left the same in
  both themes on purpose, with reasons: the `--sn-ob-*` obsidian surface, the `--sn-glass-dark-*`
  glass over photos, and the Hub's `--color-gild` / `paper-deep` / `veil`.
- **Shared recipes in dark:** the boot splash paints the page; `.home-card` / `.home-tile` take the
  card; `.sn-row` is warm; the dark islands (`.sn-tile-dark`, `.sn-tile-obsidian`, `.sn-glass-dark`)
  stay dark with their parchment words.
- **front-door.css** — the shell's 13 `--fd-*` tokens (top bar, rail, bottom bar of every signed-in
  tree) get `html.dark .fd` values.
- **tailwind.config.ts** — the success / warn / danger / info ramps, the static ends of terracotta /
  mulberry, gold, champagne and sage were literal hex (~3,700 class uses that could never follow a
  theme). Each now reads a `--ramp-*` token that holds **the same three numbers** in Light and the
  same ladder read from its other end in Dark (50 ↔ 950 …). New slot `raised` (white in Light =
  today's `bg-white`; the card in Dark).
- **Inert:** nothing sets `html.dark` yet (the switch is PR 3, and it opens dark only on routes an
  area PR has swept).
- **Guard:** `lib/every-colour-token-has-a-dark-pair.test.ts` — every literal-colour token at
  `:root` and in `.fd` has a dark value or a reasoned allowlist entry; the Tailwind colours hold no
  literal colour and every token they read is paired. Sabotaged 4 ways, each red.

**Light proof:** the whole app stylesheet compiled with Tailwind before and after, every rule
resolved as Light resolves it (`var(--ramp-*)` → its light value, hex ↔ rgb normalised): **6,268
light rules, identical, same order**; the only additions are 72 new token names. `front-door.css`:
295 light rules identical. `lint:contrast` unchanged (1,754 pairings, all ≥ 4.5).

SPEC IMPACT: None — implements the 2026-10-13 ruling already in the corpus DECISION_LOG.
