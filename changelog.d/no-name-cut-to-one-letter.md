## 2026-08-24 · fix(home): no name is cut to "Y…" on a phone

The owner saw a row on his own phone reading **`Y…`**, with its date beneath as `D…`.

**Measured in the live page at 375px, not estimated.** The "Worth planning" row is 309px wide. Its
icon (36px), gaps (42px), countdown (69px) and "Start planning" chip (111px) are **all `shrink-0`**,
and the name column was `min-w-0` — so the only thing that could give way was the name, and it gave
way to **17 pixels**. "Your birthday — turning 40" needs 171.

⚠ **And it was not only those rows.** All five rows on that screen were truncating; the two event
rows had 142px rather than 17, so they read "Cale & Ice — your w…" and looked like an ordinary
ellipsis rather than a defect hiding beside a much worse one.

**The row wraps on a phone.** Nothing is hidden and nothing is shortened — the name takes the first
line, the countdown and the marker drop to the second. Measured after the change: **all five names
fit completely**. Above `sm` the one-line design is untouched.

🔑 **`min-w-[9rem]` is what makes wrapping possible at all.** A flex row shrinks before it wraps, and
`min-w-0` let the column shrink to nothing — which is exactly what happened. Giving it a floor makes
"there is no room" true, and wrapping is what happens then. `sm:min-w-0` restores the shrink above
the breakpoint.

✅ **And a marker that was invisible on phones is back.** The file's own rule reads *"BOTH branches
always render — a row with no marker reads as unknown, which is the one thing this line must never
say."* "Open plan" was `hidden … sm:inline-flex`, so on a phone it rendered nothing and an event the
reader already had looked exactly like a date they had not started. It was hidden because the row
had no room; the row has room now, so the stated rule is true at every width.

⛔ **The cheap fix was rejected.** Hiding the countdown, or shrinking the chip to its icon, would have
freed the space by removing a fact from the screen. Both were measured (96px and 179px for the name)
before choosing the one that keeps everything.

4 sabotages, each measured by occurrence count before → after, all red. `pnpm typecheck` clean ·
9,570 unit tests green under `Asia/Manila` · route, contrast and radius guards pass · ESLint clean.

SPEC IMPACT: None. Presentation only; no migration, no schema, no price or SKU change.
