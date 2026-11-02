## 2026-08-24 · fix(guest): the veil asks like an invitation, not like a terminal

**H-1 (W3-D).** The first thing a guest ever sees of somebody's wedding is the
veil, and the instruction under it was set in DM Mono, UPPERCASE, at 3.52px and
2.24px of letter-spacing — a monospaced *data* face, set as a system message.

Read off the live DOM in a real signed-out browser at 375×812, because this
overlay is CLIENT-rendered: both strings are zero occurrences in the server
HTML, and that is not evidence they are absent.

**"you" was stranded alone on a line** — measured by walking the text node and
taking each word's client rect. At 375px the second line rendered as
`or double-tap to lift it for` / `you`.

**The owner's words are untouched, and so is his lock.** The 2026-06-20
requirement is legibility ("so old people can understand the app"), so that was
a constraint to clear rather than something to trade for a nicer face:

| | before | after |
|---|---|---|
| headline | 16px DM Mono, caps, +3.52px | **24px Cormorant, sentence case** |
| second line | 14px caps, +2.24px, **2 lines** | 14px Manrope, sentence case, **1 line** |

Scrim, contrast and text-shadow are unchanged. `text-balance` replaces the
orphan rather than a shorter string, so the fix survives a longer translation.

⛔ **This is not H-2.** That is the film's label face in `lib/std-themes.ts`, it
is owner-gated, and a test in this PR proves it was left alone.

7 mutations, all measured by occurrence count, all red.

SPEC IMPACT: None — the wording, the scrim and the cinematic opening are
unchanged; only the typeface setting the owner's words changed.
