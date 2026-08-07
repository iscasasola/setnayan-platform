## 2026-08-07 · fix(home): the composer's ➕ was GOLD, and gold is never a button

Follow-up to PR #4219 (the "What's your event?" composer row), caught the same
day by reading `globals.css` instead of trusting the class name.

**The bug:** the ➕ circle used `bg-terracotta`. Since the 2026-08-01 palette
lock, `--color-terracotta` holds the **Atelier gold `#A9834B`** — the slot name
was preserved so the 337 files using `text-terracotta` needed no audit, but the
VALUE remapped to the accent. The CTA lives in the NEW `mulberry` family
(`--color-mulberry` = `#C24E25`), which is what `.button-primary` uses.

So the one control on the row that is supposed to ACT was painted in the colour
reserved for things that HIGHLIGHT — the exact confusion the lock exists to
kill ("a primary button looked identical to a selected filter chip").

**The fix:** `bg-mulberry` + `text-cream` + a `mulberry-600` hover.
`text-cream` (not `text-white`) because the palette guard measures the CTA
against **cream `#FDFBF7`** — `#C24E25` clears AA at 4.61:1 on cream, and a
white-background check would wave a failure straight through.

Left alone deliberately: `hover:border-terracotta` on this row and on the
"New event" ghost card. A gold *border* on hover is a highlight, which is
gold's sanctioned role, and the ghost card has used that idiom since before the
lock — changing it here would have made two adjacent controls disagree.

🔑 **A class name is not a colour.** `bg-terracotta` has not painted terracotta
since 2026-08-01. Read the token, never the slot name.

SPEC IMPACT: None — this restores the locked palette rather than changing it.
