# WHAT'S NEXT — ONE STORY PER DAY

**Opened 2026-08-22.** Triggered by the owner reading the board and asking four
words: *"isn't that the editorial. the story?"*

> ## 🛑 A HANDOFF IS NOT EVIDENCE — INCLUDING THIS ONE
> Every claim below was read out of `origin/main` and the live production
> database on 2026-08-22 by six independent readers, each attacked by two
> skeptics. **Re-verify before acting.** Line numbers rot fastest: a sweep run
> the same afternoon handed back line numbers that had ALL drifted, one of them
> pointing at an unrelated guest count. **Grep the string, never trust the line.**

---

## Why this file is in the code repo

The spec corpus (`~/Documents/Claude/Projects/Setnayan/`) was **unreadable from
the session that wrote this** — `ls`, `head`, `git` and the Read tool all
returned `Operation not permitted` on every file except `CLAUDE.md`, while
*writing* to the same directory succeeded. Same reasoning as
[`WHAT_IS_LEFT.md`](WHAT_IS_LEFT.md): the corpus is a second repo you may not
have, or may not be able to open.

The permission shape was odd and worth writing down, because it decides what a
future session can do from here:

| operation on the corpus | result |
|---|---|
| read any file (`head`, `cat`, Read tool) | ❌ denied — except `CLAUDE.md` |
| list the directory (`ls`, a glob) | ❌ denied |
| `git` anything | ❌ denied — cannot even read the cwd |
| **append to an existing file** | ❌ **denied** |
| **create a NEW file** | ✅ **allowed** |

⏭ **SO THIS FILE WAS COPIED INTO THE CORPUS AS A NEW FILE, AND THE INDEX ROW IS
OWED.** `WHATS_NEXT_One_Story_Per_Day_2026-08-22.md` now exists at the corpus
root (8,579 bytes, verified by size). **`WHATS_NEXT_INDEX.md` does NOT name it**
— the append was refused, so a session that opens the index on the *"what's
next"* trigger will not find this stream. **Add that row by hand.** Until then,
this repo file is the only register that points here.

⚠ **I first wrote in this very file that the pointer HAD been appended.** It had
not — the command failed and I claimed success from the wrong signal. The size
check (before → after, `109152 → 109152`, grew by 0) is what caught it. **Verify
a write landed by measuring the artefact, not by the absence of a shout.**

---

## The defect, in the owner's own walk

She gets married. Next morning the wedding moves by itself to a shelf headed
**"Untold — no story written yet."**

She taps the card. Inside, one accent card says **"Write your story."** She
presses it and finds her day **already written** — a headline, moments cut from
her own photos, her guests' wishes, her suppliers. She fixes her mother's name
and publishes. The card now reads **"Your story is live."**

She goes back to My Events. The same wedding **still sits under "Untold — no
story written yet,"** offering *"Write the story of Cale & Ice."* She presses it
and gets **a blank page**, an empty box headed "Your story", and an example
naming **a stranger's wedding** — asking her to write the whole day again from
nothing. Not one of her photos is on that screen.

**The app told her, in the same minute, that her story was live and that it was
never written.**

---

## The two things, and why this keeps happening

| | what it is | who writes it | how many per day |
|---|---|---|---|
| **The event's story page** | Setnayan's write-up **OF** the day, drafted from the schedule and the photos; the couple corrects it | the host | exactly one, created automatically |
| **A Storyteller chapter** | a person's own write-up **ABOUT** a day, typed on a blank page | any signed-in person, **including a supplier who worked it** | several |

**They are separate records and nothing copies between them.** Verified: no file
in the app touches both, and no migration links them. They meet in exactly one
place — the celebration's public page renders the story page at the top and,
much further down, a separate list headed *"Stories about this day."*

🔑 **The word is genuinely overloaded — six times.** A person's chronicle · the
love story · its edit page · supplier-written columns · **a writing box inside
the story editor itself** · the public nav tab. The event page renders *"Our
story"* and *"Editorial"* as **adjacent cards in one grid**.

---

## ✅ DONE — do NOT rebuild

| PR | what shipped |
|---|---|
| [#4687](https://github.com/iscasasola/setnayan-platform/pull/4687) | the story page waits: *"Your story opens the day after <name>"* |
| [#4660](https://github.com/iscasasola/setnayan-platform/pull/4660) | correcting the story we auto-wrote is **free**, not PRO |
| [#4690](https://github.com/iscasasola/setnayan-platform/pull/4690) | moments take their name from the couple's own run-of-show |
| [#4696](https://github.com/iscasasola/setnayan-platform/pull/4696) | a column the couple writes themselves (up to six) |
| [#4712](https://github.com/iscasasola/setnayan-platform/pull/4712) | a **guest** reads "The Story", not "The Editorial" |
| [#4715](https://github.com/iscasasola/setnayan-platform/pull/4715) | **"Write the story of X" opens that day's own story page** |

📊 **Safe by arithmetic at the time of the change:** prod held **0 published
story pages** and **1 published chapter attached to no event**, so both the old
and the new shelf measure were empty. Nothing moved on anybody's board.

---

## 🔴 OWNER DECISIONS — no engineering left, do not decide these yourself

### 1. What the couple's dashboard calls it
"Story" collides six ways (above). **Recommendation: "Your front-page story"** —
already the app's own wording in several places, says *story* and says *which*
story. A phone bottom-bar label fits ~10 characters, so the nav may need
**"Front page"** while prose keeps the longer form.
⚠ **Eight sites must move together or a screen calls one thing two names**, and
there is a three-way nav dependency: the registry default **wins** over the menu
entry, so editing only the menu changes nothing a person sees, while the laptop
rail is not registry-overlaid. All three, or phone and laptop disagree.

### 2. "Editorial PRO"
A paid SKU's **display name**, ~24 user-visible occurrences across ~15 files plus
the database catalog title. **One decision applied to all 24 at once, or none.**
⛔ **Not "Story PRO"** — it yields *"Tell this moment's story with Story PRO."*

### 3. Does the love story yield the word?
If *"Our story"* becomes something else, decision 1 becomes trivial. Until then
it is blocked.

### 4. 🔴 The free/paid split may be inverted
**The blank page is free.** On the story we already wrote for her, **naming the
moments, ordering the sections and choosing which wishes to feature are sold as
Event Hub PRO.** Flagged by the investigation, not acted on — pricing is never a
side effect of a build.

---

## ⏭ ENGINEERING — unblocked, not started

1. **The plain editor.** Title and story up front; the magazine fields
   (eyebrow, sub-headline, pull quote, byline) behind a disclosure. The owner
   asked for *"very easy to handle."*
2. **The three audiences** — only me / private (the event's guests, invited or
   attended — **NOT an unlisted link**) / public.
3. **Three dead doorway rows.** `BecomeStorytellerRow`, `OpenShopRow` and
   `CreateSamahanRow` are defined in the launcher and **rendered nowhere** (zero
   call sites app-wide). **Two guards assert the board carries those doors and
   are satisfied by strings inside components nothing mounts.** Nobody is
   stranded — the account menu still carries "Your Story" — but the guards are
   decorative and should be made honest, which will require either mounting a
   row or rewriting the assertion to check a mounted one.
4. **Gold eyebrows fail AA on the story page.** `text-terracotta` is the gold
   `#A9834B`; the page ground is now **white** (owner 2026-08-20, token still
   *named* `cream`). Measured **3.48:1**, below the 4.5:1 floor for 12px text.
   **Seven such sites in that one component**, and its own docblock names
   champagne-gold as the deliberate editorial accent — so fixing one makes it the
   odd one out. **A whole-component design call, not a rider on a copy change.**

---

## 🪤 TRAPS THIS STREAM ALREADY PAID FOR

- **A line number is not an anchor.** A sweep's line numbers had all drifted
  within the same afternoon; one pointed at `attending: 188`. Grep the string.
- **A guard can be satisfied by dead code.** See item 3 — and the two guards
  there were found only by asking "what actually renders this?"
- **An unmeasured mutation proves nothing.** Three mutations in this stream
  reported GREEN while never landing (2→2, 0→0, 0→0), because the perl anchors
  did not match the real source. **Print the occurrence count before → after.**
- **A guard that cannot fire is worse than none.** One written in this stream
  ("an order carrying a custom column is never the default") was deleted after
  the mutation run showed removing it changed no test result — a `custom:` key
  can never equal a canonical one, so the branch was already unreachable.
- **`timeout` does not exist on macOS.** `timeout 900 pnpm test` prints nothing
  and runs nothing; the grep then reports success.
- **`grep -c` exits 1 on zero matches**, so a passing test run chained into one
  reports a failed command.
- **Regenerating the port baseline can absorb a real removal.** Diff it: routes
  before/after, then per-route entry deltas. Both regenerations in this stream
  were verified to remove **exactly one** intended entry.
