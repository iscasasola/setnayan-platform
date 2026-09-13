## 2026-09-13 · fix(thread): "Propose schedule" is visibly shut, with its reason, until the couple books

A supplier reading a conversation with a couple who has not booked them saw **Propose schedule** sitting in the rail looking exactly as available as the eight tools beside it. Pressing it left the conversation, loaded the client's Schedule tab, and only there did they meet the refusal. It now reads greyed and unpressable with **"Opens once they book you"** underneath, in the rail, before they go anywhere.

🔑 **THE DESTINATION WAS NEVER DISHONEST — this is a defect about WHERE a true sentence lived.** The Schedule tab already draws *"Unlocks when they book you. You can propose a call time once you're booked."* for a pre-agreement supplier. The register's row read as "a control that does nothing"; measured, it was "a control whose reason is one navigation away". Both are worth fixing; only one of them is a lie, and it is neither of these — so the fix is to move the sentence, not to build a refusal that already exists.

Owner question **B2, recommendation (a)**, matching the existing Lock ruling: **hide nothing, say why.**

⚖ **THE GATE IS A `Record<ThreadStage, boolean>`, NOT `stage === 'booked'`.** `resolveThreadStage` ranks **completed above booked** — "a finished job stays finished however the thread was later filed" — so a supplier who has already worked the wedding reads as `completed`, while the destination still opens for them (it asks a different question: are they on the roster). Gating on `booked` alone would grey the tool out and tell that supplier it "opens once they book you" about a couple who already did. **Over-greying is the direction that puts a lie on screen; under-greying is merely today.** The map is exhaustive, so a new stage fails the typecheck rather than quietly picking a side.

**Two things deliberately not done, each stated where it is decided:**

- **The tool is not hidden.** A tool that vanishes teaches a supplier the product lacks a feature; a tool visibly shut teaches them what earns it.
- **It is not a `<button disabled>`.** A disabled button leaves the tab order, so a keyboard or screen-reader user never reaches it and never hears the reason — to them the control is simply missing, which is the outcome the ruling refuses. `aria-disabled` + `tabIndex={0}` + `aria-describedby` keeps it focusable and reads the reason *with* the name.

⚠ **The destination literal stays in the route's own file even though the shut branch does not use it.** `lint-port-no-lost-controls` reads a route's files for the destinations it offers and only sees a literal after `href=`; losing it would read as the route having LOST that destination, and the tempting fix — regenerating the baseline — would record a removal that never happened. The guard asserts the literal is still there.

**Guard — `lib/the-schedule-tool-says-why-it-is-shut.test.ts`, 5 subtests.** Sabotage, each derived from an assertion, each restored:

| mutation | result |
|---|---|
| gate on `booked` only (`completed` → false) | **4 pass / 1 fail** |
| hide the tool instead of showing it shut (`shut ? null`) | **3 pass / 2 fail** |
| retype the reason in the rail instead of reading it from the list | **4 pass / 1 fail** |
| read the agreement off the stage PILL's label instead of the map | **4 pass / 1 fail** |

⚠ **The guard read RED against a working rail before it was right.** Its source window ended at the first line starting with `}`, which in a destructured parameter list is `}: {` — so every assertion ran against a few lines of types. The window now ends on a brace alone on its line **and fails loudly if it collapses**, because a window that has shrunk onto the signature proves nothing while passing.

Neighbouring guards green: `the-thread-tools-open-what-they-name` (8) · `the-mobile-tools-trigger-is-labelled` (5). All 32 of CI's `scripts/` guards run and green, the four that CI runs with `working-directory: apps/web` re-run from there (from the repo root they "fail" on a missing path, which reads exactly like a real failure).

SPEC IMPACT: None. No pricing, schema or catalog change; one launcher's rendering. The register at `Setnayan_Finale_2026-09-13/ONE_REGISTER.md` (row SUP-G) is corrected in the same breath — it described the control as doing nothing, which is not what was measured.
