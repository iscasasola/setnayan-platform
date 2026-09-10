# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-09-06 · feat(vendors): removing a category asks first

Owner: *"yes add the confirm step"* — closing the gap the previous change left open and named.

### The gap

The removal note ships on the button's `aria-label` **and `title`**. `title` is a HOVER tooltip.
This is a phone-first app, where **there is no hover** — so a touch user got no visible warning at
all before their conversations were archived. The accessibility tree had the sentence; the screen
did not. 🔑 **A consequence that only reaches assistive tech has not reached the user.**

### What was reused, not built

`app/_components/confirm-dialog.tsx` already exists — a native `<dialog>` (browser-owned focus trap,
ESC, `role="dialog"`, inert background) with a `useConfirm()` hook returning
`Promise<boolean>`. It replaced 18 `window.confirm()` callsites in May and carries the brand-voice
rules in its own docblock: a title that reads as a polite question, a body carrying consequence +
reversibility. **No new modal, no new styles.**

- title — `Remove {category} from your event?`
- body — the SAME `REMOVE_FROM_PLAN_NOTE` the button already carried, so the dialog and the label
  can never word the consequence two ways
- buttons — **Remove it** / **Keep it**

### Deliberately NOT `destructive`

The dialog's `destructive` flag paints the confirm terracotta so *"a delete looks visually different
from a save"*. This removal deletes nothing — that was the entire point of the change before it —
and the tint would contradict the sentence printed directly above it. Reversibility is the message.
A test asserts the flag stays off.

### One ordering that would be invisible

The confirm is awaited **outside** `startPlanEdit`. A transition cannot await, and starting one
before the couple answers flips the row into its pending state while the dialog is still open —
it reads as "already removing" under a question that has not been answered. Guarded.

### Tests

Three new source-anchored cases (18 total in `category-archive.test.ts`). Mutation-checked, each red
on exactly its own case:

| mutation | caught |
|---|---|
| drop `if (!ok) return;` — Cancel removes anyway | ✅ |
| never mount `{removeConfirmDialog}` — `confirm()` resolves against nothing | ✅ |
| start the transition before asking | ✅ |
| style it `destructive: true` | ✅ |

SPEC IMPACT: None beyond the 2026-09-06 rows already logged — this is the disclosure half of the
archive decision, not a new one.
