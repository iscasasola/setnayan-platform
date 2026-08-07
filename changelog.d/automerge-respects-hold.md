## 2026-08-07 · fix(ci): "do not auto-merge" is now a control, not a convention

🚨 **A near miss.** The standing rule is that public-facing **legal copy** — privacy notices, pricing disclosures — is opened for the owner to read and merge **in his own name as DPO**, never merged by a machine. The only thing protecting that was "don't run `gh pr merge --auto`".

**That protects nothing.** `.github/workflows/auto-merge.yml` arms auto-merge *for* you, on every non-draft PR. PR #4209 (the privacy retention notice + the booking-fee disclosure) was opened deliberately unarmed, **verified unarmed**, and was armed by that workflow about a minute later. It was caught only because a re-check happened to run.

🔑 **A convention that lives in someone's head is not a control.** "We don't arm legal PRs" was enforced nowhere, and the two PRs relying on it (#4186, #4209) carried **no label and no enforcement** — only words in a title that nothing read.

**The fix — three independent holds, in order of strength:**

1. The **`do-not-auto-merge` label** (created, and applied to both #4186 and #4209).
2. **`DO NOT AUTO-MERGE` in the title** — belt-and-braces for a PR opened before anyone thought to label it. Both PRs that needed this had exactly that and no label.
3. **Draft**, unchanged.

⚠ **`labeled` is deliberately NOT a trigger** — adding the hold label must never be the event that arms the PR.

⚠ **Why the draft mechanism was not enough on its own**, despite being the documented one: the owner must mark a draft *Ready* in order to merge it, which re-fires the workflow and arms it. **The very act of approving becomes the act of losing the hold.**

🛡 `lint-automerge-hold.mjs` pins both conditions and the absent `labeled` trigger — because the real risk now is someone tidying that YAML later without this context. **Both failure modes were reproduced on purpose:** removing the label check fails it, adding `labeled` as a trigger fails it.

🪤 **Wiring checked in all three places.** These guards run `continue-on-error: true` and are aggregated by a separate "Every blocking guard must pass" step. A guard registered as a *step* but missing from the env block or the check-call list **passes silently forever** — so the step id, the env var and the check call were each verified present.

SPEC IMPACT: None — CI plumbing.
