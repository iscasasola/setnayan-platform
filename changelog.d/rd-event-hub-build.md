## 2026-09-23 · feat(event-hub): the overnight Event Hub build

One branch, one merge, one commit per item. Owner, 2026-09-23: *"build it continuously …
merge them all as one merge"*, then *"is it okay that you finish these builds so when I
wake up this is done and merged?"*

---

### 1 · The entourage gets a call time

Owner, on what a ninang needs: **"what she needs most is her call time."** Her role and her
outfit shipped on 2026-09-20 (`lib/role-dress-code.ts`). The third fact had nowhere to live —
the entourage could not read a call time anywhere in the product.

- `RoleAttireRule` grows `callTime?: string` — `HH:MM`, 24-hour, beside the style and the note
- the guest's own panel shows it **above** the outfit, because she can decide what to wear
  later and cannot decide when to leave the house later
- the couple sets it per role in the dress-code editor, on an `<input type="time">`

🔑 **Typed, not derived — and that is not an oversight.** Suppliers already get a call time
without typing one: `deriveVendorCallTimes` reads the earliest run-of-show block they are
tagged responsible on via `responsible_vendor_ids`. **There is no role equivalent of that
tag** — a block can name a vendor and cannot name "the principal sponsors" — so there is no
schedule row to derive this from. If role tagging on the run of show ever ships, this is the
field that should stop being typed; do not add a second one beside it.

⛔ **Nothing is repaired.** `sanitizeCallTime` accepts `HH:MM` and nothing else. `"7"` quietly
fixed into `07:00` is a *wrong alarm*, and a ninang who arrives six hours early because this
product guessed is worse off than one who was told nothing. An unreadable value drops; the
rest of the row still saves.

**Kept per-role, not re-keyed to `RoleGroup`** (the plan's Build 2). A group key would make a
ninang and a ninong share one rule, which is coarser than what already ships. Owner asleep —
flagged here rather than guessed at silently, and it is one field to change if he disagrees.

**Guards** (`each-role-wears-its-own.test.ts`, 9 → 14) — five sabotages, each breaking exactly
the guard facing it: repair a half-typed time · drop the field in the sanitizer · render the
time below the outfit · hide the editor input when unset · break the noon edge.

🪤 **The fifth guard was vacuous on its first run and the sabotage caught it.** It took a
source window from `<input` *forward* to `name="role_call_time"`; the conditional wrapper a
saboteur would add sits *before* the tag, so the window faced away from the mutation and the
run came back green. Replaced with a real render that counts inputs across two roles — one
with a time, one without.

SPEC IMPACT: None. `dress_code_config` is an existing JSONB column; this adds an optional key
inside it. No migration, no price, no locked decision.
