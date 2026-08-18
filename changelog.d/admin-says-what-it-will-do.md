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

## 2026-08-18 · feat(admin): a song can be put into the common list, or taken out

Owner, on how the catalogue is meant to fill: *"songs in the catalogue will be
filled in by the bands. not from us. but we can place songs that are common for
now so they can also list them down."*

That is what ships — bands add their own songs from **Your repertoire**, and the
~390 seeded ones are a common starter set so neither a band nor a couple opens an
empty box. What was missing is the half Setnayan needs: **the screen printed
"curated" as a read-only LABEL.** You could delete a song and merge two songs;
you could not say *this one belongs in the common list*. When 93 songs fell out
of it, nobody had a button to put a single one back.

Each row now carries **In the list / Add to list**, and the screen says what the
states mean — that being in the list puts a song in the couple's "most popular"
browse and a band's starter repertoire, and that everything else still exists and
is still findable by name.

### ⛔ Deliberately NOT the service-role client — and this is the whole point

The other two actions in that file use `createAdminClient()` to bypass RLS, so
copying them was the obvious move. **It would have shipped a control that
silently does nothing.** `songs_nonadmin_guard` pins `is_curated_pick` to its OLD
value unless `public.is_admin()` is true, and `is_admin()` reads `auth.uid()` —
NULL under service role. The update would report success, change nothing, and the
label would not move.

🔑 **A GATE WITH NO HANDLE — built today, by the person fixing them.** Caught by
reading the trigger before writing the action rather than after.

Verified against production, not inferred: `songs_admin_update` admits
`authenticated` where `is_admin()`, and both columns are UPDATE-granted to that
role, so one signed-in admin session satisfies the policy **and** the trigger. A
zero-row result is reported rather than shown as a save — Supabase resolves
rather than throwing, so a filtered write is otherwise silent.

### 🪤 Two of my own faults, both caught by measuring

**1 · I renamed a form field and would have broken merge entirely.** Extracting
the fields into a client component, `canonical_id` became `canon_id`; the server
action still read `canonical_id`, so every submit would have answered *"Enter two
different valid song IDs."* forever — a control that looks present, refuses every
time, and blames the operator's typing. **A form and its action agree by
convention, and a convention is not a control**; there is now an assertion that
every field the form posts is read by an action.

**2 · One assertion was decoration and the mutation proved it.** Deleting the
whole `<form>` from the row left the suite GREEN, because the check matched
`setSongCuratedAction` anywhere in the file — and the **import line** satisfied
it. Re-anchored to the rendered JSX. *A guard that matches a string rather than
the act it names is decoration.*

7 assertions · 3 mutations for these controls, each measured by occurrence count,
all red.

SPEC IMPACT: None.

🪤 **AND THE FIRST CUT NESTED THE TWO FORMS — CI caught it, not me.** The curate
switch went *inside* the delete form. HTML forbids a nested form: the browser
drops the inner one, so pressing **"Add to list"** would have submitted
**DELETE**. An irreversible action fired by a control labelled as the opposite —
on the same screen, in the same change, that exists to stop exactly that. They
are siblings in a flex row now.
