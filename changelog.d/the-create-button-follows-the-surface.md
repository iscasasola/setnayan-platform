## 2026-08-26 · fix(nav): the create button makes what THIS place makes

Owner, on the gold button in the top bar: ***"this needs to change depending on
where they are. Home - Create Event. Shop - Create Service Card. HQ - Create
what?"***

**It was one hardcoded `+ Create event` on all six signed-in trees.** So a
supplier standing in their own Shop was one press from a couple's wedding
wizard. That is a wrong button, not a matter of taste.

| surface | before | after |
|---|---|---|
| Home | + Create event | **unchanged** |
| Shop | + Create event → a wedding wizard | **+ Create service card** → the category picker |
| HQ | + Create event | **nothing** |

**HQ makes nothing, and that is from the record rather than from taste.** Across
every admin action ever logged — **65 of them** — only **nine** created anything
(4 taxonomy nodes, 3 demo suppliers, 1 schema stub, 1 ceremony type). **Thirty-one
were price edits.** HQ is where you answer and adjust, and its real primary action
is already in that bar: the overdue pill. A second gold button beside it would
compete with the one thing that should pull the eye, for a job done four times a
year.

**Three states, and the middle one is why this is not a boolean:** `undefined`
keeps today's button (every other caller is byte-identical), a node replaces it,
and `null` means this surface makes nothing. A `??` fallback would have made
HQ's `null` fall straight back to the wedding wizard — mutation-proved.

**The Shop's words are the Shop's own.** Its services screen already calls the
thing a *service card*; the bar's grammar on Home is *"+ Create …"*, and 🔒 the
word CREATE is owner-locked here (2026-08-15: renaming it read as **deleting**
it — he scanned the bar for the word and it was gone). It points at the picker
rather than a bare `/new` route because a card cannot exist without a category,
and a guard asserts the anchor it targets is actually rendered — otherwise the
button opens the page and visibly does nothing.

🔒 `.fd-btn-gold` is reused, never re-styled per surface (one chrome, one button
colour — owner-locked 2026-08-14). A guard also pins that **exactly two**
surfaces override the slot, so the lock cannot erode one layout at a time.

**Guards** — 6 assertions, 8 mutations, all RED. 🪤 **And a process failure worth
recording: my mutation harness keyed its backups by FILE BASENAME, and both
layouts are named `layout.tsx` — so the admin layout was restored over the vendor
one and silently corrupted the tree.** Caught because the restored tree failed
its own tests. Recovered from git and re-applied; the harness now keys by full
path.

SPEC IMPACT: None.
