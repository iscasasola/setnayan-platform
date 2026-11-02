## 2026-09-20 · chore(monogram): the page-level "Back to add-ons" link is removed

Owner, pointing at it on the live page: *"remove this."* It sat above the page
title as a second, page-level way back; the app shell's own navigation still
reaches add-ons. "Both ways to make it" stays, inside a door.

**`lint-port-no-lost-controls` went red, and its baseline IS regenerated here.**
The route `/dashboard/[eventId]/studio` is genuinely no longer reachable from
this page, which is precisely the case that guard asks you to record — the diff
carries one readable line, `- "/dashboard/[seg]/studio"`.

🔑 **This is the opposite call from the one made earlier today, deliberately.**
That time the same guard fired on this same page and the baseline was NOT
regenerated, because the link still existed and only the guard's static reader
could not see it through a ternary `href`; regenerating would have recorded a
removal that never happened. The rule both commits follow: regenerate when a
control is really gone, never to quiet a guard that has found something. The
distinction is written into the page so the two commits do not read as
inconsistent.

SPEC IMPACT: None.
