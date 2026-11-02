## 2026-08-26 · fix(papic): the uploads switch now reaches a column the page reads — and the column is grantable

Two defects in the switch shipped hours earlier, both found before anyone met them. **One of them was a live break of the whole Papic studio; the other made the switch decorative.**

## 🚨 An ungranted column on `events` does not fail quietly — it fails the WHOLE query

`events` revokes table-level SELECT and re-grants a **per-column allowlist**. A column added without its own `GRANT SELECT (col)` is not merely unreadable: PostgREST refuses the entire query, so every surface reading `events` through a user session goes **silently empty**. And `events_host` has an **explicit column projection computed from those grants**, so a new column is a phantom column on the view until it is rebuilt — while `/dashboard/[eventId]/details` **throws** on a query error, which would have killed Personalization for every host on every event type.

`lint-events-column-grants` caught it. ⚠ **The db coverage tests structurally cannot** — their `before()` re-applies the lockdown, which recomputes the allowlist over the new column. This is the phantom-column family again: **refused, not thrown, and the only symptom is an absence.**

SELECT + UPDATE for `authenticated`; `anon` gets nothing. **No INSERT** — the switch is not answered at creation; a celebration is minted with the default and the couple changes it later, and a column the create path can name is a column a create path can get wrong. The view rebuild **refuses to apply** unless the projection contains the new column, so it asserts the grant took rather than assuming it.

## 🪤 And the switch governed nothing

`uploadsOpen` was read off the page's **main event select, which never named the column**. It was always `undefined`, `?? true` reported OPEN, and the picker rendered for a couple who had switched it off. It saved. Its own control showed the right state. The thing it exists to control ignored it — **a stored value with no reader, in a feature whose entire point is the reader.**

⚠ **The read gets its own round trip, not an extra name on the main select.** The column lands in a migration; naming an unknown column makes PostgREST refuse that whole query, and this page answers an unreadable event with `notFound()` — so the "obvious" one-line version turns a missing migration into **a live celebration rendering as missing**. `papic_style` two blocks above is the precedent.

## 🛡 The guard that let it through gets the rule it was missing

Rules 1–6 all passed while the switch governed nothing: the column existed, the control was mounted, the branch was wired, the save was confirmed. **I guarded the branch and not the source.** Rule 7 asserts the value the picker branches on is actually SELECTED — exactly once, on its own, and consumed by that branch.

| sabotage | count | result |
|---|---|---|
| the column is never selected | 3 → 2 | 🔴 |
| folded into the main select | 1 → 2 selects | 🔴 |

🪤 **The second sabotage reported GREEN first time and the count is why I noticed.** Rule 7's regex required `'…'` immediately before `)`, and this file writes multi-line selects with a **trailing comma** — so folding the column into the main read counted as **zero** selects and the rule passed on the arrangement it forbids. `,?` is load-bearing.

🪤 **Rule 3 also went red on a correct change** — it pinned the exact expression `papic_uploads_open as boolean | null) ?? true`, so moving the read broke a guard that was describing characters instead of behaviour. It now matches the fallback **inside the `uploadsOpen` assignment**.

**Exposure baseline** regenerated; the diff is **one added fact**: `events.papic_uploads_open  anon=- authenticated=SU`. Nothing else in 6,210 facts moved.

**Verified:** `tsc --noEmit` exit 0 · 7 events_host / exposure db tests pass (7·16·19·5·8·16·6) · 13 lints pass.

**SPEC IMPACT:** None.
