## 2026-09-09 · feat(story): the Story Maker keeps the whole editor, and picks its colours from the mood board

**08 step 1.3 (carry forward) + step 1.4 (theme).**

The Story Maker was assembled by MOVING the shipped editor onto its own route
(PR #5337). This closes the loop on that move in two ways.

**Loss prevention.** A written checklist of every capability the shipped editor
had — the two-up/four-behind-a-fold words, clear-a-field-to-rewrite,
save-before-you-navigate on a plain click with modifier-clicks passing through,
own columns, manual wishes, direct photo upload, the datalist of ten canonical
moments, the four caps (400 · 280 · 12 · 30) and the locked close — is now a
guard that fails when one of them is deleted, rather than a paragraph in a PR
body. It reads the source with `lib/strip-comments.ts`, so a capability cannot
read as "present" when all that survives is a comment describing its removal.

**Theme (new).** Three modes — follow my mood board · make my own · neutral —
ported from `prototypes/story-maker.html` `#p-theme`, with the mood board's OWN
`<SwatchPopover>` (colour name, search by colour name, and a new "from your mood
board" quick-pick row for callers outside the board's provider). The six light
stages repaint live underneath through `lib/story-light.ts`, which the public
page will derive from too — one derivation, so a preview cannot drift from the
page it previews.

Every colour is contrast-corrected before use: body ink ≥ 12:1, muted ≥ 4.6:1,
accent-as-text ≥ 4.5:1. The GROUND is corrected first — a mid-luminance ground
cannot carry 12:1 ink at all, so an ink-only loop would run to its extreme and
report success while returning something illegible.

⚠ **Not PRO.** The owner ruled 2026-09-09 that the gate stays exactly as
shipped (moments · section order · own columns · featured wishes). Theme is not
one of the four, and a test now fails if the words, the theme or the uploads are
moved behind the gate.

SPEC IMPACT: None. `02_The_Story_Maker.md` §5 and `08` steps 1.3/1.4 describe
this build; nothing in the corpus changes.
