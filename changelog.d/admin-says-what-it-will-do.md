## 2026-08-18 · fix(admin): the console says what it is about to do, and what it has counted

**Three defects, all found by the owner opening three admin screens on a phone.**
Nothing here was found by a test — two of the three are invisible to any check
that asks "does the page render".

### 🚨 1 · Deleting a song took one tap, with no confirmation

A bare bin icon on every row of a **391-row list**. One tap and the song was
gone, and every couple and vendor who had picked it lost that pick. On a phone,
mid-scroll, that is one mis-tap from permanent — on the same catalogue that had
just been found to have silently lost 93 songs to a different defect.

### 🚨 2 · Merge was two hand-typed numbers, irreversible, naming nothing

You typed a duplicate id and a canonical id into empty boxes. It **deleted one
song and re-pointed every couple's pick to the other**, with nothing on screen
saying which songs those numbers were. Typing `688` where you meant `686`
destroys the wrong song and silently rewrites what couples chose. No undo.

🔑 **A DESTRUCTIVE CONTROL DRIVEN BY AN ID MUST SHOW THE THING, NOT THE ID.** A
number cannot be sanity-checked by the person typing it; a title can. The
confirmation now resolves both ids against the list already on screen and names
both songs — and when an id is **not** on screen it says so rather than merging
something unseen, because an id you cannot see is exactly where a typo hides.

RULE 0: this reuses the console's existing pattern from
`admin/website-media/media-table.tsx` (a `window.confirm` naming the target and
saying it cannot be undone) rather than inventing a second one.

### 🚨 3 · "You're all caught up" was a claim about 14 queues, not all of them

The Work page said *"You're all caught up — nothing is waiting on you right now"*
and *"14 queues are clear"*. Measured: **ten other queue-shaped admin surfaces
are not counted there at all** — including vendor **payouts** and the **fraud**
queue, plus ID documents, fees owed, pax changes, completions, chat flags,
repost watch, profile corrections and data-privacy filings.

Some are excluded deliberately — judgement queues get no one-click action, by
design, so nobody makes a hard call at speed. **None of that was said out loud.**

🔑 **A SCREEN MAY ONLY CLAIM WHAT IT MEASURED.** "Nothing is waiting on you"
reads as everything. It is true today only because production is empty; it
becomes false the first day something lands in an uncounted queue, without
changing. Same family as the refused read that renders "nothing here" — and this
one is read by the person whose job is to notice.

The sentence now states its own scope, and the number is **derived from the rows
actually rendered**, never typed, so adding or removing a queue cannot leave it
saying something untrue about its own coverage.

### 🛡 Guard

`destructive-controls-confirm.test.ts` — 4 assertions, anchored to the ACT (a
confirmation whose refusal actually stops the submit) rather than to the presence
of a word.

| mutation | |
|---|---|
| remove the delete confirmation | **red** |
| **confirm, but name the ids instead of the songs** | **red** ← the defect's real shape |
| put the bare unconfirmed button back on the row | **red** |
| tree after the run | clean — committed before mutating |

⚠ **Scope stated, not overstated:** this reads source, so it proves the
confirmation is wired, not that a browser paints it. That is the honest ceiling
of a static check.

⏭ **Named, not built:** the songs screen still shows "curated" as a read-only
label. There is no control to add or remove a song from the couple's list on
purpose — a separate build.

SPEC IMPACT: None.
