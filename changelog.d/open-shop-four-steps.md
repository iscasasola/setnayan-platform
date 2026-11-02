## 2026-08-10 · feat(open-shop): four steps, one question each — no icon, no headline, a progress bar

Owner asked whether onboarding should be six steps or two, and sketched both. **Neither.** Four:

| step | question |
|---|---|
| 1 | **Your shop** — logo · name · web address |
| 2 | **What you do** — primary service · events you serve |
| 3 | **Who you are** — name (from the account) · position · number · email |
| 4 | **Where you are** — the map pin, which names the city |

**Why not the six the owner sketched.** Two of those pairs are one question each: *"Primary service"* and *"Events you serve"* are both **what do you do**; name / position / number / email are all **how do we reach you**. Splitting them adds a Continue tap and removes no thinking — the vendor is in the same headspace on both halves. And the sketch's step 4 would have been a **single optional box**: the name comes from the account (`users.display_name` exists), leaving only "Position" — a whole screen, and a tap, for a field many will skip.

**Why not two.** Height. The proposed step 1 carried a logo dropzone, a name, an address **and** a map; step 2 paired an expanding service picker with sixteen event chips. Both become long scrolls — the thing splitting exists to prevent. **The map earns its own step**: the one element that needs full attention and cannot be made smaller.

### Chrome removed — "less is more"

The storefront icon, the *"Open your shop"* headline, the *"Free during launch"* blurb and the *"How couples reach you"* title are all gone. **With one question per screen the field label already is the title**, which is what makes removing them safe rather than disorienting.

*"Step 1 of 2"* is replaced by four segments that fill. **The shape carries the count, so no words have to** — `aria-valuenow` plus the label keep that fact available to a screen reader, which cannot see it.

### The name is shown, not asked

`readOnly`, **not `disabled`** — a disabled input submits nothing, and this field is required, so disabling it would post a blank name and bounce the vendor with a message about a box they cannot type in. Falls back to editable when the account has no display name: a locked EMPTY required field is a dead end.

### 🔑 The failure mode the restructure quadrupled

All four steps live on ONE always-mounted form and nothing is written until the final submit. If the server rejects a field without saying which step owns it, the wizard remounts at step 1 and **silently discards everything typed after it**. Under two steps that cost one screen; under four, a step-4 rejection landing on step 1 throws away three — including the map pin, the most effortful thing in the flow.

All nine rejections now carry `step=1..4`, the page parses all four (emitting `step=4` while the page only reads `'1' | '2'` would fall back to 1 and achieve nothing), and `app/open-shop/four-steps.test.ts` pins both halves. A **META case** fails when a NEW rejection is added with no step mapping — otherwise the suite would keep passing by simply never looking at it. Mutation-verified: pointing the city rejection at step 1 turns it red.

The submit gate now walks **every** step, not just the last: a vendor can reach step 4, go back, clear a required field, and jump forward again. On a failure it moves to the step that owns the field, so the message is never about a screen they cannot see.

🪤 **The chrome guard caught a stale docblock**, not a regression — the file header still described *"2 · How couples reach you"* from the two-step era. Removed. The guard now strips `/** */` as well as JSX comments, because the tombstones deliberately name what was removed and a rule that failed on its own explanation would push the next person to delete the explanation.

Verified: **7300/7300** unit · 5/5 the new step-machine guard (mutation-checked) · all 20 `lint-*.mjs` · `tsc` clean · eslint clean.

SPEC IMPACT: None — flow shape and copy. No field, validation rule or stored value changed.
