## 2026-11-14 · style(public): template wave · public pages 2 — the marketing doorways, the blog and the stories follow the sheet

Second public batch of the owner's template wave (14 Nov). 19 pages; style only — same words, same data, same actions;
no shell changed. Score (paragraphs×2 + cards + hand buttons×2 + hex + mono + empty cards×2 + selects×2) **321 → 165**.

- **Hand-made buttons → the shared pill** (`actionButtonClass`; the blog's category filter is the pill with `filled` on
  the current one and `aria-current`). The Papic dial's 28 px ± are 44 px icon pills.
- **Typewriter capital captions → the section label**: slate on the light pages; on the dark bands they keep their
  light colour (the blog's gold → `--sn-gold-300`, the cream / white ones as they were) so nothing goes dark-on-dark.
  Status chips keep their own colour.
- **Typewriter numbers** (step counters, prices, the Papic dial) → `tabular-nums`.
- **Cards → plain**: bordered panels lose the border (their fill and shadow stay); pressable tiles keep their frame.
- **Server pages call the button class from the plain module** (`components/action-button-class.ts`, the same file and
  guard as public pages 1 — identical content, so whichever lands first, the other merges clean).

Left on purpose, and why:
- **Long paragraphs on the marketing pages** (Papic, For coordinators, About, Download, Our story): they are the pages'
  reading copy, not explanations under a label; the sheet's ⓘ rule is for app screens. Not hidden behind ⓘ.
- **`/v/[slug]/booth`**: its colour codes are the 3D booth scene's own (the sheet has no rule for a 3D scene).
- **Real stories' fallback monogram colour** is data, not styling.
- **The Papic dial's two 44 px steppers** stay as they are (already at the floor).

| Page | Before | After |
|---|---|---|
| `/papic` | 70 | 27 |
| `/for-coordinators` | 42 | 42 |
| `/about` | 22 | 12 |
| `/tl/about` | 22 | 12 |
| `/blog/[slug]` | 22 | 1 |
| `/blog` | 19 | 2 |
| `/download` | 18 | 14 |
| `/explore/compare` | 16 | 4 |
| `/pa3d` | 16 | 4 |
| `/alaala` | 15 | 8 |
| `/v/[slug]/booth` | 15 | 15 |
| `/monogram` | 10 | 4 |
| `/realstories` | 8 | 3 |
| `/realstories/[slug]` | 7 | 1 |
| `/our-story` | 4 | 4 |
| `/papic/try` | 4 | 4 |
| `/suppliers/(index)` | 4 | 4 |
| `/waitlist` | 4 | 2 |
| `/pa3d/try` | 3 | 2 |

Shots (390, Now beside Proposed): `build-sessions/shots-template-public-2/`.

SPEC IMPACT: None — applies the approved template.
