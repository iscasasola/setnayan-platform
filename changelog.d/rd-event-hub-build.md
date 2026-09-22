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

---

### 2 · The canvas contract, and the motion that reaches the page

Owner, 2026-09-23, choosing between free placement and a bounded one: **"rails on."** So the
canvas is not a drag engine and stores no pixel offsets — the reason being the phone: Canva
composes a fixed rectangle where "300px from the left" is always true, and our page is 375px on
a phone and 1440px on a laptop.

🔑 **No migration.** `invitation_widgets.config_json` already exists and nothing has ever read
it as a shape (it is typed `unknown`). So: no exposure freeze, no Ugat node, no prod ledger to
touch. An existing empty column beats new schema.

- `lib/hub-canvas.ts` — the contract three surfaces have to agree about: the editor that writes
  it, the guest page that draws it, and the controller's miniature that shows the guest page.
  Four arrangements, four motion presets, the fine-tune vocabulary, a 3×3 focal point, and the
  CSS custom properties the page sets. Pure, no I/O.
- `globals.css` — the motion, in CSS only. `animation-timeline`, so **no script crosses to the
  guest page**.
- `hideable-widget-render.tsx` — one wrapper around whatever the dispatcher returns, so sixteen
  widget components stay ignorant of layout.

⛔ **"Auto" is an absence, never a value.** Storing the literal `'auto'` would freeze today's
preset body into a couple's saved page, so a later change to what "Calm" means would silently
not reach them. A couple who *chose* Fade keeps Fade; a couple on Auto moves with the preset.

🔒 **Fail-visible by construction.** Every rule that can hide a section lives inside **both**
`@supports (animation-timeline: view())` **and** `prefers-reduced-motion: no-preference`. A
browser without scroll-driven animations, a guest who asked for less motion, or a future
refactor that drops the wrapper all land on the same outcome: the section renders at rest,
visible. A wedding page rendering blank is the worst failure this product has and it looks
exactly like "the couple wrote nothing".

⛔ **It ships INERT.** `hasHubCanvas` is false for an empty `config_json` — every event on the
platform today — so no wrapper, no classes, and markup byte-identical to before. A defect in
this CSS cannot reach a page nobody has arranged.

⛔ **What is deliberately NOT offered, and is named in the CSS as unbuilt:** the focal point and
zoom are stored but not applied (nothing in a widget is marked as the section's media yet), and
the LEFT / RIGHT arrangements need a widget to expose two slots where it exposes one. **A control
that stored a value and moved no pixels is the exact defect this build exists to remove**, so
the editor does not offer them either. The contract is already the right shape for when media
lands.

**Guards** — `hub-canvas.test.ts` (11) and `the-canvas-fails-visible.test.ts` (5). Ten sabotages
across the two: round a value instead of dropping it · store `'auto'` as a literal · let the
preset beat an override · flip the focal keypad · render `undefined` · give "Still" motion · let
one animation binding escape the gates · drop the reduced-motion gate · hide a section with an
ungated rule · add a contract value with no CSS rule · wrap a widget that hid itself.

🪤 **The fail-visible guard passed for the wrong reason on its first run.** It found
`@supports (animation-timeline: view())` **inside the comment that describes the gate**, 1,500
characters before the real rule, and brace-counted from a `{` belonging to nothing. It now
strips CSS comments before searching anything.

SPEC IMPACT: None. No migration, no price, no locked decision.
