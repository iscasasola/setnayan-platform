## 2026-08-01 · feat(design): Warm Editorial Archive palette — cream page, espresso ink, terracotta CTA, slate-indigo links

Global palette move away from pure white toward a warm editorial canvas for a
Filipino-first event platform. **Two files, zero component edits** — every colour
slot in `tailwind.config.ts` resolves from a CSS variable, so changing the
variables propagates through all 1,263 `bg-cream` call sites automatically.

**Values (light mode):**

| Role | Was | Now | Contrast on `#FDFBF7` |
|---|---|---|---|
| Page + card | `#FFFFFF` | **`#FDFBF7`** soft cream | — |
| Text / structure | `#1B1A17` | **`#2C2A29`** espresso | 13.82:1 AAA |
| Primary CTA | `#A9834B` gold | **`#C24E25`** terracotta | cream label 4.61:1 AA |
| Highlight / accent | `#A9834B` gold | **unchanged** | 3.37:1 — UI + large text only |
| Links / secondary buttons | *(no token)* | **`#3B4E67`** slate indigo | 8.22:1 AAA |

Page and card are deliberately the **same** cream, so the `paper`→`cream` alias
survives and the 337 hardcoded `bg-white` files need no audit. Card separation is
carried by border + shadow.

**Two premises in the request were checked and did not hold:**
- **There is no "tech blue" to remove.** Every blue in the app is legitimate:
  `#1877F2` in `oauth-icons.tsx` and `library/_components/photos-tab.tsx` is
  Meta's sanctioned Facebook brand mark on the OAuth/import controls (recolouring
  it violates Meta's guidelines), and `blue-50/100/200/700/800` in two schedule
  components is the `paperwork` status chip. Zero links, zero buttons, and no
  `#0000FF` / `blue-600` anywhere. All left untouched.
- **The app was not pure white/black.** Text was already warm `#1B1A17` and the
  accent already gold; `#000000` was used as a text colour nowhere.

**The requested CTA `#E05A2B` fails WCAG AA and was darkened.** It measures
3.71:1 with a white label and 3.85:1 with ink — both under the 4.5:1 floor for
normal-size button text, so no label choice rescues it. Darkened along its own
hue to `#C24E25`.

⚠️ **Sized against cream, not white.** `.button-primary` labels with `text-cream`
(`#FDFBF7`), not `#FFFFFF`. The first value that clears AA on white — `#C75026`
at 4.56:1 — drops to **4.41:1** against the label the app actually renders and
would have shipped a failure. A white-background contrast check waves this
through; only checking the real pairing catches it.

**Also corrected while in there:**
- The `mulberry` tint ladder in `tailwind.config.ts` still held **gold** values
  (`#f3ecdf` … `#3f3019`) from when that slot carried the gold CTA (2026-07-12).
  With the slot holding terracotta, `bg-mulberry-100` would have painted a gold
  wash under an orange button. Regenerated from `#C24E25` programmatically rather
  than hand-picked, so the shades cannot drift out of hue.
- `--m-mulberry-3` / `-4` deliberately **left neutral**. They stopped being CTA
  tints long ago — `-3` is consumed as muted light text on dark
  (`vendor-grow-sections.tsx`, `vendor-tier-matrix.tsx`) plus the disabled-button
  fill. Making them terracotta would have put orange body copy on the vendor pages.
- The `--m-*` block's WCAG header still advertised the retired obsidian CTA at
  16.42:1. Recomputed and rewritten rather than left to mislead the next reader.
- Dark-mode values updated for coherence even though the theme is **inert** —
  the app is light-locked (owner 2026-06-04). The light `#3B4E67` scores 2.13:1
  on the obsidian page and would fail outright, so link and CTA are lightened
  there rather than reused.

**Verified:** Tailwind compiles clean; `link` utilities and all four new token
values present in generated CSS; `.button-secondary` resolves to
`rgb(var(--color-link) / …)`; contrast recomputed on the shipped values — **zero
WCAG failures**, gold correctly flagged UI/large-text-only with `#8A6B39` (4.79:1)
as the text escalation.

SPEC IMPACT: `DECISION_LOG.md` row 2026-08-01 — supersedes the 2026-07-31
Facebook-grey + mandarin direction (owner chose warm over cool the same week) and
the 2026-07-12 gold-CTA half of the Atelier lock. Gold is retained as the sole
decorative colour; the slate indigo is scoped to links + secondary buttons only,
so the "one decorative family" kit rule still holds.
