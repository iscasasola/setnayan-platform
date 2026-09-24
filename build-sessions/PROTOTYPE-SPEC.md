# PROTOTYPE SPEC — what "a full final interactive prototype" means here

> Owner, 2026-09-22: *"command the sessions to show me a full final interactive prototype of their
> plans"* — after *"we want everything ready first before we start building autonomously, to make
> sure everything will render and deploy properly."*
>
> **No Redesign session builds until its prototype is approved.** This is the gate.

---

## Why a prototype and not a preview

Two findings from today, both measured, decide the shape of this:

1. **A `claude/*` branch produces no Vercel preview.** `apps/web/vercel.json`'s `ignoreCommand`
   exits 0 (SKIP) for `claude/*`. Proven by pushing `rd/preview-probe`, which built a real preview
   while an identical `claude/*` branch reported "Canceled by Ignored Build Step". Wave branches will
   be named `rd/…` from now on, so previews return — **but a preview only exists after the code
   does.** The owner is asking to see the plan *before* the code.
2. **Most of this wave cannot be seen in production either.** `chat_threads` holds 3 rows, all
   `accepted`; `pending`, `declined`, `displaced`, `withdrawn` and `expired` have **zero** rows. The
   supplier's Accept/Decline block has never rendered for a real inquiry, and no proposal has ever
   gone through the composer being redesigned.

⇒ **The prototype is the only place the owner can see the empty states, the failure states and the
states production has never reached.** That is its job. A prototype that only shows the happy path
is worth less than the screenshot he already has.

---

## 🔑 THE METHOD IS THE OWNER'S KIT — start there, not here

Owner, 2026-09-22, handing over `setnayan-page-redesign-kit`: **use it for the admin money switch
final.** It is installed at `build-sessions/kit-page-redesign/`. **Read `README.md`, then
`REDESIGN-PAGE-PROMPT.md`, then copy `papic-controller-prototype.html` as the template — do not
start from scratch.** The owner reviewed that example and said the method was done correctly, so it
is approved, not a suggestion.

The kit is the authority on **structure, flow and cutting text**. Its eight steps in one line:
confirm the exact page · measure the live one (words, buttons, blocks, order) and list every control
as a contract · find the approved drawing and past rulings · real parts and real data, unknowns as
visible `[PLACEHOLDERS]` · order by how it is actually used, and re-order for before/after the event
· one title and at most one status line, headings of 1–3 words, no paragraphs · ONE file, one DOM,
two layouts, phone under 1024 and the real shell with a sticky right column above it · check the
order, report briefly, change no code.

Two of its rules are easy to miss and both have bitten:
- **`order` by CSS, never duplicated markup** — one body class re-orders the same sections.
- **`[hidden]{display:none!important}`**, because `display:flex` overrides `hidden` and a "hidden"
  panel stays on screen.
- **Test at 375px and 1440px in a browser before sending, and screenshot both.**

**This document adds ONE thing to the kit and does not override it: STATE COVERAGE.** The kit makes
a page clear; the section below makes sure the owner sees the states that clarity usually hides —
empty, overflowing, refused. Where the two ever disagree, the kit wins on layout and this wins on
which states must exist.

## The deliverable

**ONE self-contained `.html` file per session.** No build step, no server, no network — he opens it
by double-clicking. Inline everything; a font from Google Fonts is the only allowed remote.

Save to `~/Documents/Claude/Projects/Setnayan/prototypes/<slug>_FINAL_2026-09-22.html` — the same
folder the ONE DOOR and Your Team prototypes already use. Then **report the absolute path**, and
send the file to the owner with `SendUserFile` so it reaches him on any device.

### 🛑 ZERO JAVASCRIPT. The owner's viewer does not run it.

**Measured 2026-09-22, and it has already wasted two of his reviews.** He opened two drafts and said
*"this is what i see only"*, then *"still nothing"* — **completely blank**, because every value was
written by JS. Confirmed independently here: a local prototype opens as a **static snapshot** and
its scripts do not run. Of the five prototypes delivered today, **four need JS to switch state and
one does not**:

| prototype | `<script>` | verdict |
|---|---|---|
| `your_team_FINAL` | **0** | ✅ works for him |
| `one_door_FINAL` · `overview_FINAL` · `papic_controller_FINAL` · `admin_money_switches_FINAL` | 1 each | ⚠ blank, or frozen on one state |

Two distinct failures, both fatal to a review:
- content written by JS ⇒ **he sees nothing at all**;
- content in the HTML with JS only switching states ⇒ he sees the default and **every state button is
  dead**, which is worse, because it looks like it works.

**The rule: a prototype must render and switch every state with no JavaScript at all.**
Use **radio inputs plus CSS sibling selectors** (`input:checked ~ .panel`). `grep -c '<script'` must
print `0`. That is how `your_team_FINAL` does it, and it is the pattern to copy.

🔑 **`<noscript>` DOES NOT SAVE YOU.** It fires only when scripting is *disabled*, not when a sandbox
*refuses to execute* it. A session tried that first and the fallback never showed.

✅ **A PROTOTYPE INSIDE THE PROJECT FOLDER IS DRIVABLE FROM A SESSION.** `find`, `computer` clicks,
`javascript_tool` and `resize_window` all work, so you can verify a CSS-only switcher **by computed
style** and screenshot it at 375px and 1440px. A prototype **outside** the project folder is not —
page tools are refused with *"This tab shows a local file, not a web page."*

**Settled by a controlled experiment**, not by argument: one byte-identical probe file with a nonce,
copied to both locations, both driven with an explicit `tabId` so tab-targeting was held constant.
Inside: 2 refs, the click flipped the CSS switch, the nonce read back, resize applied. Outside: every
page tool refused.

🪤 **IGNORE THE "renders as static snapshots" NOTICE — `preview_start` PRINTS IT FOR BOTH.** It is
unconditional and is **not a verdict on the file you just opened.** Reading it as one is what put a
false line in this document telling six sessions they could not verify their own work.

🪤 **`preview_start` opens a NEW TAB every call.** Three opens produced tab-3, tab-4, tab-5. Always
read `tabs_context` and pass an explicit `tabId`, or you will drive a tab you are not looking at.

⇒ **Work inside `build-sessions/prototypes/`, verify there, copy the finished file out.**

⚠ What a local page still cannot do is run **its own** scripts. That is why zero-JS is required —
**and why a session can nonetheless verify a zero-JS file completely.** The two are one fact.

🪤 **`grep -c '<script'` IS A SUBSTRING GREP.** A session's first build printed 1 from its own HTML
comment documenting the rule, not from a tag. **Write the rule without the angle bracket** or you
fail your own gate.

**Probe your harness with a known-false assertion first.** A checker that cannot return false has not
told you anything when it returns true.

### It must be INTERACTIVE, not a picture

- Every state reachable **by clicking**, from inside the prototype. A state you can only reach by
  editing the source does not count.
- A visible **state switcher** — a row of controls naming every state, so he can jump straight to
  the one he doubts. Label them in his language ("supplier declined", "read failed"), not in yours.
- Controls that do nothing must **look** like they do nothing. A dead button in a prototype is how a
  reviewer approves a flow that does not exist.

### It must show ALL the states, including the ugly ones

For every screen in your plan:

| must include | why |
|---|---|
| the **empty** state | a couple with nothing yet, a supplier with no customers |
| the **full / overflowing** state | 180 guests, 100 pending inquiries — the uncapped-list defect was found exactly here |
| every **status** the data model allows | including the five `chat_threads` states that have never rendered |
| the **failure** state | a read that refused. **Not a blank.** A refused guest read once told a couple with 180 names "No guests yet" |
| the **loading** state, if the real one will have one | |
| **phone width first**, then desktop | the app is phone-first; the owner reviews on a phone |

🔑 **A failure that renders identically to success or to emptiness is the disease this project has
shipped seven fixes for.** If your prototype cannot show the difference, it is not final.

### It must be honest about what is real

- **Use the shipped copy.** Open the real component on `origin/main` and reproduce its actual words.
  Invented copy is how a redesign quietly becomes a rewrite.
- **Mark anything not yet decided** in visible amber, with the question written out. Do not pick a
  default and hope.
- **Mark anything you are removing**, and say what replaces it. Removal is the part an owner cannot
  un-approve later.
- **Real numbers where they exist.** If production says 3 threads and 2 shops, do not draw 40.
- Where your plan reverses an existing ruling, **say so on the screen**, with the date.

### At the end of the file, a plain-language summary

A short section, readable by someone who has not followed the thread:

1. **What changes**, in one sentence per screen.
2. **What is deliberately NOT changing.**
3. **What this cannot prove** — the honest limits. Say what still needs a real device, a real
   sign-in, or production data.
4. **The open questions**, numbered, each with your recommendation and the cost of getting it wrong.

---

## Rules that still bind you

- **No code.** This is a prototype, in the prototypes folder. Do not touch `apps/`.
- **No push, no PR, no branch.** Nothing reaches git from this task.
- **Read from `origin/main`** (`git show origin/main:<path>`), never from `/Users/icecasasola`.
- **One heavy job at a time** through `heavy-lock.sh`. A prototype should need none.
- **Do not re-draw a working screen.** RULE 0: find the shipped component, reproduce it, and show
  only your delta as changed. The owner has paid more than once to have a page recreated that
  already existed.
- If measuring something would change your plan, **measure it before you draw** — and say in the
  summary what you measured and what it changed.
