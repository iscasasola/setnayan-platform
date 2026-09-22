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

---

### 3 · "How it moves" — the control that sets it

Four named presets in the editor rail — **Still · Calm · Editorial · Cinematic** — with one
override underneath: **Auto · Plays once · Follows the scroll**. Owner, on the eight knobs the
first draft had: *"we still want it to be simple enough that they could customize this."*

🔑 **A row of submit buttons, not a client widget.** The sections panel is a server component and
the whole editor works with **no JavaScript** — the PH slow-4G posture the widgets editor already
holds. The live preview sits beside it and reloads on the redirect, so a couple taps a preset and
watches their own page change.

⛔ **The timing override only appears once a preset is chosen.** Offering "Follows the scroll" on
a section with no preset would be a control refining a decision nobody has made.

⛔ **The writer MERGES `config_json`.** It is a shared bag typed `unknown` and any widget may keep
its own settings there; writing `{ canvas }` over the top would delete them silently, visible only
on the guest page. The action re-reads the row rather than trusting the form — a couple with two
tabs open would otherwise post a snapshot from before their other change.

**Guards** — `the-motion-control-is-real.test.ts` (6), which renders the panel and follows the
value a button posts all the way to the class the guest page carries. Six sabotages, each breaking
exactly its guard: a button posting the wrong preset · the pressed chip ignoring what was saved ·
the timing row appearing unasked · **the writer replacing `config_json` instead of merging** ·
Auto stored as a word · dead controls for a caller that never wired the action.

SPEC IMPACT: None.

---

### 4 · 🔴 The canvas reached one door of two — fixed

`site-body.tsx` renders widgets down **two** paths: `HideableWidgetRender` for a guest, and
`PublicHideableWidget` — a deliberate mirror — for an anonymous visitor on an open-browse event.
Item 2 above put the canvas wrapper inside the first one only.

**A couple who arranged their page would have seen it; a stranger following their link would have
seen the page unarranged.** Nothing red, nothing different in the dashboard, and the only way to
notice is to open your own link signed out.

- one shared `HubCanvasFrame` (`app/[slug]/_components/hub-canvas-frame.tsx`), imported by both
- `every-dispatcher-frames-the-canvas.test.ts` finds dispatchers **by what they do** — every
  component that switches on `widget.widget_type` — not by naming two files, so a third door
  added later cannot skip the frame quietly

### 5 · Section backgrounds

A section can now carry one of the couple's own photos behind it — picked from their hero and
their gallery, in the editor rail, with **None** always offered.

🔑 **The stored value is the photo's own ref, never its position in a list.** That list reorders
whenever they add or remove a photo; a stored index would silently move a section's background
with nothing red anywhere. This was the reason I stopped short last night, and it is what the
`media` field now solves.

🔒 **Two ownership checks, not one.** The ref is held to the **public bucket** — a `config_json` is
couple-writable and the signer signs what it is handed, so a hand-crafted POST naming
`setnayan-thread-files` (payment proofs) or `setnayan-vendor-verification` (government IDs) is
refused at the door. And because the public bucket holds *every* event's website media, the ref is
then checked against **this event's own** hero and gallery.

🪤 **A guard caught a real hole in the first version.** `siteMediaServeRef` passes any non-`r2://`
string through verbatim as a "legacy URL" — it accepts `"1"`. So a stringified list index, the
exact mistake this field exists to prevent, would have been stored and rendered as
`background-image: url("1")`. `hubMediaRef` is the stricter reader: a public `r2://` ref or an
absolute `https://` URL, nothing else.

⛔ **A ref that fails to sign renders NO background** — not a dark empty plate waiting for a
picture that is not coming, which a guest reads as a broken page rather than as no photo. The
class is set from the resolved URL, never from the stored ref.

⛔ **The scrim is not decoration.** Words over an arbitrary photo can land white-on-white and this
product cannot know what the couple uploaded, so the picture is its own layer under a gradient
rather than a `background-image` on the frame.

**Every background on a page is signed ONCE**, deduped, in a single `Promise.all` in `SiteBody` —
the failure `displayUrlForStoredAsset`'s own docblock names for list surfaces. The ref is held to
the public bucket **again at the signer**, which `every-render-read-is-pinned.test.ts` requires and
which caught this in the full sweep.

**Guards** — `a-section-background-is-a-ref.test.ts` (7) + `every-dispatcher-frames-the-canvas.test.ts`
(4). Ten sabotages, including: the loose reader returning · a private bucket reaching the signer ·
**the ownership check removed** · an unsigned ref still styled as having a picture · the scrim
dropped · the picture drawn above the words · **the anonymous door losing the frame**.

🪤 **Two of my own guards were vacuous and the sabotages caught both.** One anchored on the whole
`<HubCanvasFrame …>` attribute list, so adding a correct second prop turned it red — a guard that
fails when the code improves teaches the next session to weaken it. The other searched an
1,800-character window for `linear-gradient` after the scrim's selector, and the **dark-mode copy
of the same rule sat inside that window** — deleting the light scrim left it green while every
couple on a light phone got unreadable words over their own photo. It now brace-scopes each rule.

SPEC IMPACT: None. No migration, no price, no locked decision.

---

### 6 · 🪤 A comment swallowed 7,500 characters of code

The full sweep turned `the-wake-never-celebrates.test.ts` red with
*"site-body.tsx lost the celebratory arm: 'Thank you for celebrating'"*. Both tone literals were
present and byte-identical to `origin/main`.

The guard normalises source by stripping comments, and one of its regexes removes JSX comments —
a brace, then a block-comment opener. The new background block was written as the **first token
inside the function body**, which is byte-identical to that pattern's start, so the regex ran on
to the next closer later in the file and removed **7,500 characters of real code**, including the
literals on line 873.

🔑 **The message was true of what the guard could see and false of the file.** The fix is line
comments wherever a comment is the first token after a brace.

⚠ **And the first fix reproduced the bug**: it converted the comment and then *spelled the
offending sequence out* in the prose explaining why — which tripped the same regex in a new place.
The wording now describes it without writing it.

SPEC IMPACT: None.
