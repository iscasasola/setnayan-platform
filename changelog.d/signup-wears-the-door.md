## 2026-08-17 · feat(doors): sign-up wears the door register — Session 2 complete

The last screen still dressed as the website. **Reconcile, not redraw**: the
960px two-column composition, the brand panel, the bullets and every field stay
exactly where they were; the REGISTER changes — paper card, 3px terracotta top
edge, terracotta eyebrow and action, shared `.input-field` and `.button-primary`.

🔒 **THE FORM CONTRACT WAS PINNED BEFORE THE PORT, NOT AFTER.**
`signup-contract.test.ts` captures all **11** posted fields from `origin/main`
and was proved to fail (drop `refc` → RED) before a line of styling changed. A
guard written afterwards cannot prove the change was safe.
🪤 Its first draft scanned `<input name=>` and found only **8 of 11** — four
fields render through `<FormField>` — so it would have passed while three real
fields went missing. It counts `name="…"` across the file instead.

✅ **AND PROVED IN A REAL BROWSER, not only in source.** With
`?ref=guest&src_event=…&refc=S89R-…` the rendered form serialises **all eleven**
names through `new FormData(form)` after a simulated fill. `ref`/`refc`/
`src_event` are conditional by design (`ref` accepts only the literal `guest`;
`refc` only the `S89R-<10>` shape) — absent without those params is correct, and
my first two attempts to prove it used invalid values and looked like a
regression until I read the conditions.

🚨 **DARK MODE WAS BROKEN MID-PORT AND MEASUREMENT CAUGHT IT.** Moving the card
to the themeable `bg-surface` while the text still sat on `--m-*` tokens — a
palette defined **once, on `:root`, that never flips** — put the headline at
**1.12:1**. All 25 colour tokens are now themeable: measured **15.29:1** dark /
13.82:1 light, and every pairing on the page clears 4.5:1 in BOTH themes.
🔑 This is the third time the two-theme check has caught something this session.

⚖ The action colour moves from the marketing gold `#8A6B39` (4.79:1) to the door
terracotta `#C24E25` (4.61:1). Both pass — this is a register change, not a fix.

📐 The page had **no `<h1>` at all**: the brand headline was an `<h2>` with
nothing above it. It is now the `<h1>`, and the form heading the `<h2>`.

### Two failures this surfaced, one of them not mine

🔴 **`origin/main` was RED before I started.** `the-host-sees-their-own-page.test
.ts` pinned the LITERAL expression `ownerCapability !== null && …`, which
PR #4495 correctly extracted into the shared `viewerIsEventHost(...)`.
**A guard that pins an implementation's spelling fails its own refactor.**
Repointed to the question being asked, not the characters. Verified failing on
clean `origin/main` before touching it, so this is a fix, not a side effect.

🛡 The door guard fired on `/signup` the moment the port landed — it now matches
the door card BY SHAPE. `/signup` joins that list with a reason: it wears the
register but keeps a two-column composition `<DoorShell>` is not and should not
become.

SPEC IMPACT: None.
