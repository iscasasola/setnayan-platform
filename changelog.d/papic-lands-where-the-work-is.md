## 2026-08-26 · fix(papic): the one thing a couple must do now shows in whichever room they land in

Owner, opening his own wedding's Papic page: *"entering papic inside an event needs to me simpler and better to manage. if I am a customer and I see this, I will be confused."*

**🚨 THE ROOMS FILE ALREADY CLAIMED THIS WAS TRUE.** `resolvePapicRoom` sends a couple with no capture window to Set up, and its own comment gave the reason: *"Unset means Set up, **where the attention row is**."* **There was no attention row.** The capture-window picker's ONLY mount was inside *Cameras & shots* — a room a new couple never lands in. So the single thing standing between a couple and a working camera sat in the one place they could not see it, while the room they *did* land in opened on a look picker.

🔢 **Measured in production, 2026-08-26: all five events have no capture window set.** So every couple who has ever opened Papic landed in a room that could not tell them what to do. Not an edge case — the only case.

🔑 **A SENTENCE IS NOT A MECHANISM.** A docblock asserting that another part of the page does something is worth nothing until something checks. That is the second time this exact shape has cost this project time in a fortnight.

**What shipped**

- A **do-this-first card renders ABOVE the room branch**, so it appears in *all three* rooms while the dates are unset: an eyebrow, the question *"When can your cameras shoot?"*, one line saying why it blocks everything, and **the shipped picker itself** — not a link to it.
- **The in-room picker is now gated on `windowIsSet`**, so the two mounts are mutually exclusive and a couple never meets two identical date pickers on one page.
- The landing rule is now a nicety rather than load-bearing: whichever room resolves, the required act is on screen.
- `rooms.ts`'s comment no longer claims an attention row that does not exist; it points at the card that does.

🎨 **A recorded contrast trap, walked into and caught before it shipped.** The card's eyebrow was first written `text-mulberry-700` — which measures a comfortable 5.86:1 in light and **3.05:1 in dark**, a fail, because that slot flips to the light theme's `#C24E25` on a dark panel. **A light-only check waves it straight through.** Now `mulberry-600` (4.92 light / 5.78 dark). This repo has paid for that exact swap once already.

**🛡 Guard `_lib/the-required-act-is-in-the-room.test.ts`** — 5 rules: the page still has rooms (or every rule is vacuous) · the picker renders above the branch · it shows exactly while the dates are unset · the two mounts can never render together · and the card's **visible text** carries no internal names.

🪤 **Two of its own rules were wrong first, and both are recorded in it.** One regex missed the `(` that JSX puts between `{cond ?` and the element. The other flagged `papic_window_start` — a **prop name**, never on screen — because it judged the whole JSX block instead of the rendered text. *A guard that cannot tell an attribute from a sentence cries wolf, and a guard that cries wolf teaches you to skim past the one time it is right.*

**Mutations**, counts printed before → after: the act goes back inside a room (1→0) 🔴 4 rules red · two pickers at once (1→0) 🔴 · jargon in the visible copy (1→0) 🔴. Green on both clean sides.

**SPEC IMPACT:** None — this is the first build slice of the control-centre rearrange in `prototypes/papic_control_center_2026-08-25.html`, under the purpose lock already recorded in `DECISION_LOG.md` 2026-08-26.

---

🪤 **A TRAP PAID FOR IN THIS PR, WORTH MORE THAN THE FIX: NOT EVERYTHING IN `scripts/` IS A CHECK.**

Looking for contrast guards to run, a `ls scripts/ | grep -iE "colour|color|contrast"` returned three files and all three were run in a loop *"to see if they pass"*. Two are lints. The third — **`swap-status-color-tokens.mjs`** — is a **Wave-3 CODEMOD** that rewrites `emerald` → `success`, `amber` → `warn`, `rose` → `danger` across the whole app. It printed nothing, exited 0, and read as **PASS** while silently rewriting **60 files**, including the one being edited.

It was caught only because `git status` before committing showed sixty modified files instead of four. **Nothing else would have caught it** — every guard still passed, because the codemod's output is exactly what those guards want.

🔑 **A ZERO EXIT CODE MEANS "IT RAN", NOT "IT CHANGED NOTHING".** Before running an unfamiliar script in `scripts/`, read its header: a `lint-*` name inspects, a `swap-*` / `gen-*` / `codemod-*` name **writes**. And check `git status` before every commit — the file count is the cheapest possible smoke alarm.

**How it was unwound, since the naive fix would have lost work:** the codemod had touched the page being edited (7 lines), so the working copy was contaminated rather than simply wrong. Everything was reverted to the branch base and the change **re-applied from scratch**, restoring by hand only the two files the codemod had never touched. The final diff is asserted to contain **zero** `emerald|amber|rose` lines.
