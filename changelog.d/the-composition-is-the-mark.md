## 2026-09-20 · refactor(monogram): the composition is the mark — precedence flips, and the machinery that assumed otherwise is retired

Owner 2026-09-20: *"yes keep it. and only use the rerendered version of the
uploaded photo."*

**The flip.** `resolveEventMonogramSvg` now resolves `custom ?? uploaded`, the
REVERSE of the rule it held this morning. It flipped because the product
flipped: an uploaded logo is no longer a competing mark, it is the SOURCE the
studio composes from, and what ships is the re-rendered composition. The upload
stays as the FALLBACK — a couple who uploaded a logo and has not opened the
studio yet still has a mark — which is the whole reason the column is kept
rather than an archive nobody reads.

Measured before flipping: of 11 events in production, **0** had both marks and
**1** had an upload only. No event's live mark changed.

**The retirement.** Deleted rather than left standing: `lib/monogram-mark-choice.ts`
and its 8 tests, `setMarkChoiceAction`, the side-by-side comparison, and the
`data-mark="off"` stamp. All four existed for ONE reason — two marks competing
for one slot, so a couple had to be shown both and asked which won. They no
longer compete. Keeping them would leave a second mechanism that disagrees with
the first, which is the exact failure this feature has already produced twice
(nine surfaces that ignored an uploaded mark; a `currentColor` policy that
worked inline and rendered black in an `<img>`).

They shipped this morning and are gone by evening. That is the correct lifetime
for scaffolding around a model that changed, not a sunk cost to defend.

**The strip says one true thing.** For an upload-only event it now points at the
studio — "Open it in the studio to add a frame or change its colours — your
original file is kept either way" — instead of promising a designed mark that
may not exist.

The resolver test that asserted "upload keeps precedence over custom" is
rewritten to the new rule WITH the reason and the measurement, plus a new case
proving the upload still renders when no composition exists. Deleting it would
have removed the only executable record of what the precedence is.

SPEC IMPACT: None — no locked decision changes. The 2026-06-23 "reveal lives
inside the studio" lock is untouched here; consolidating the two reveal pickers
still needs owner sign-off.
