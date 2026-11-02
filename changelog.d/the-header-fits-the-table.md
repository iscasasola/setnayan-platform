## 2026-09-21 · fix(guests): the roster header fits its own cells again

⚖ Owner, on the header shipped yesterday: *"text is improper. and it does not
stretch the whole screen."*

Each column header gained a grouping checkbox (#5793) and kept its pre-control
width. Under `table-fixed` a declared width governs LAYOUT but does not clip:
a `whitespace-nowrap` label simply spills over its own cell into the next one.
So every header sat visibly shifted from the column beneath it, "Contact" was
pushed past the right edge and read "CONTA", and the table overflowed its own
`overflow-x-auto` wrapper rather than filling the screen.

- The six fixed columns go 46% → 50%; Name keeps the leftover.
- `min-w-0` + `truncate` on the label: a flex child will not shrink below its
  content unless told it may, and truncation is what then clips rather than
  overflows. The full word stays in `title`.
- `shrink-0` on the checkbox and the sort arrow, so the WORD gives way under
  pressure and never the control. A clipped word is recoverable (tooltip, and
  the column below it); an unclickable sliver is not.

⛔ **The space did NOT come out of the padding.** Trimming these to px-2 buys
8px a column and puts the header 4px left of every cell under it — the exact
crookedness `the-roster-lines-up.test.ts` exists to stop.

🔑 **Nothing existing could have caught this.** typecheck 0 errors, 18/18 repo
guards, 2,776 tests — all green while the header was visibly crooked on the
owner's screen, and the contrast guard even caught a *different* fault in the
same file the same day. The markup is valid and the classes are real; the
defect exists only once a browser lays it out. New
`the-header-fits-its-own-cell.test.ts` is the arithmetic that was missing.

🪤 Two traps inside that new guard, both caught by sabotage rather than by
review: it first went red against a `{/* … px-2 … */}` comment EXPLAINING why
px-2 is wrong — a guard convicting the prose that documents it, so it now
strips comments before judging. And its width ceiling started at 95%, which a
sabotage ballooning Role to 52% (leaving Name a tenth of the table) sailed
straight through: "under 100" was never the property. It is 55% now, and the
failure prints the declared widths.

Sabotage-checked five ways — min-w-0 removed · truncate removed · checkbox
made shrinkable · columns over-claiming · header padding drifting from the
body — each turning exactly one assertion red, green again on restore.

SPEC IMPACT: None.
