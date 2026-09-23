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

---

### 7 · The repo already knew — use its one comment stripper

CI's blocking guards caught `the-canvas-fails-visible.test.ts` growing **its own** comment
stripper. `scripts/lint-one-comment-stripper.mjs` exists for exactly this, and its message names
the defect precisely: a two-replace regex strips block comments first, so a *line* comment
containing a slash-star sequence opens a block that closes at the next real terminator and blanks
everything between — "and the guard then asserts against a blank and passes."

That is the same class of mistake as item 6 above, one layer over: there, a comment hid 7,500
characters from a guard; here, a guard's own stripper could hide the thing it was checking.

Now uses `stripComments` from `lib/strip-comments.ts`. The baseline of 290 files carrying their
own is a **debt list that may only shrink**, and this change adds nothing to it.

All 33 blocking guards run clean locally.

SPEC IMPACT: None.

---

### 8 · Focal point and zoom — and the motion reworked for smoothness

Owner: *"add the focal point and zoom controls"*, then *"make sure the animations are smooth and
clean"*. Reviewing the motion for the second turned up **three real faults in what had already
shipped on this branch**.

**The controls.** A 3×3 keypad drawn **over a thumbnail of the couple's own photo** — so they pick
a point on the picture rather than decode "top-left" from a word — plus three distances (*As it
is · Closer · Closest*). Zero JavaScript, and the live preview beside the rail reloads with the
real crop.

⛔ **They appear only once a photo is set**, and `setWidgetCrop` refuses a crop on a section with
no background server-side too. A focal point with nothing to crop moves no pixels.

🔑 **Its own action, not a third field on `setWidgetBackground`** — that one reads an empty `media`
as "take the background off", so a crop form that did not carry the photo would have cleared it on
every tap.

#### 🔴 Fault 1 — two of Cinematic's three choices never rendered

The motion was a rule per in×out pair. `.hub-tl-scrub.hub-out-shrink` and
`.hub-tl-scrub.hub-in-slide` have the **same specificity**, so the later one won and took
`animation-name` with it; `.hub-during-lift` (one class) lost to both. **Cinematic is in:slide,
during:lift, out:shrink — and only the shrink happened.**

Now one rule per timeline, with the keyframe names carried by `--hub-in-kf` / `--hub-out-kf`. Every
combination is one rule and none can shadow another. *A control whose effect depends on source
order is not a control.*

#### 🔴 Fault 2 — two preset values were read by nothing

`--hub-duration` and `--hub-stagger` were emitted on every arranged section and consumed by **no
rule**. "Plays once" was also a scrub pretending to be one, so duration could not apply.

- **Plays once** is now a real time-based animation with a real duration and a real ease
  (`cubic-bezier(0.22, 0.61, 0.36, 1)`); **Follows the scroll** stays `linear`, because a scrubbed
  section follows the thumb and an ease there reads as lag. That is the whole difference between
  smooth and mechanical at one duration.
- `--hub-stagger` is **no longer emitted**: staggering means animating a section's children, and a
  widget hands the frame one child. It returns with the build that gives sections their own
  elements.
- **New guard, both directions:** every `--hub-*` the contract emits must be read by a rule, and
  no rule may branch on a class the contract cannot emit.

#### 🔴 Fault 3 — `display: contents` cannot be animated

Moving the motion onto `.hub-canvas-body` met a no-media rule that still said
`display: contents`. **A `contents` box is not generated, so it cannot be animated** — every
section without a background photo would have silently lost its arrival and its handoff. Markup
right, classes right, vars right, nothing moving. A sabotage that put it back left every other
guard green, which is why it now has one of its own.

#### Smoothness, deliberately

Only `opacity` and `transform` are ever animated — both compositor properties, so nothing triggers
layout or paint. Translations are `translate3d`, `will-change` sits on the two elements that
actually move rather than on every frame, and **the drift lives on the picture, never the words**:
on one element it would fight the arrival for `transform` at every instant, since `cover` overlaps
both `entry` and `exit`. Two layers, two transforms, no conflict — depth instead of a page that
will not settle. The drift composes the zoom into its own keyframes, because an animation replaces
the whole `transform` and a zoomed, drifting layer must carry both in one function list.

**Guards** — 6 in `the-canvas-fails-visible.test.ts`, 9 in `the-motion-control-is-real.test.ts`,
13 in `hub-canvas.test.ts`. Nine more sabotages, each breaking exactly its guard.

SPEC IMPACT: None.

---

### 9 · Custom fonts (plan's Build 3) — and two builds that turned out not to exist

**Build 7 — "the four themes never drawn" — is already shipped.** `lib/invite-themes.ts` has
carried five themes since 2026-09-10 (House free · Capiz · Velvet · Galeriya · Abaca on Pro), the
hub wears the door's theme since 2026-09-22 (`app/[slug]/_lib/hub-look.ts`), and every one of them
is drawn: a `.module.css` per theme for the door plus a shared material block in `globals.css`,
already held by `the-site-wears-the-doors-theme.test.ts` (8 assertions, green). **The "nine hub
themes" list is an old document's vocabulary that never became the registry.** Whether four more
themes should be designed is a commission, not a build.

**Build 5 — "Drive as a source" — is half-shipped in the other direction.** `/api/oauth/drive/
{start,callback,disconnect}`, a connect card, a Google-access privacy page and a
`drive_copy_artifacts` table all exist: Drive is wired as a **destination** (copy the couple's
photos *to* their Drive). Picking a photo *from* Drive needs the Google **Picker**, which needs a
browser API key and an app id this session cannot verify are configured — and a picker that opens
onto nothing is worse than a door that honestly says Not built. Flagged, not faked.

**So this item is Build 3, custom fonts.** A fixed list of nine faces the app **already loads**.

🔑 **A fixed list, not an upload, and that is the honest version.** `next/font` resolves at build
time; every face here is served from our own origin, so choosing one costs a guest nothing and
cannot fail. A couple-uploaded file would mean a runtime `@font-face` against R2 on a guest's
first paint, an unanswered licensing question, and **a face that fails to load silently** — the
page simply set in something else, with nothing logged.

⛔ **Every entry is checked against `app/layout.tsx`.** A key naming a variable the app does not
declare renders as the fallback stack with no error anywhere: the couple picks Cinzel and gets
Georgia on their own wedding page, while the dashboard says Cinzel.

**Where it goes.** `--pahina-face` is the hook that already exists — two themes override it — so
the couple's choice is the same override, merged into the **same Pro-gated bag as the colours**
rather than threaded as a second prop. A theme carries colour; this carries type; no material is
re-declared. An unset face contributes `{}`, so a couple who never chose gets byte-identical
markup.

**The column** (`events.site_font_key`) follows `20271219583821` exactly: one `ALTER TABLE` per
statement, a closed CHECK, `GRANT SELECT` + `GRANT UPDATE` to `authenticated` only, the
`events_host` rebuild lifted verbatim, and a `DO $$` block that proves all of it. The exposure
freeze added **one** fact: `public.events.site_font_key anon=- authenticated=SU`.

**Guards** — `hub-fonts-are-loaded.test.ts` (9). Five sabotages: offer a face that never loads ·
escape the Pro gate · let an absent field clear a saved face · drift the CHECK from the list ·
repair a stored value instead of dropping it.

🪤 **Three traps in the guard itself, all recorded:** a `'use client'` module's named exports land
under `.default` when dynamically imported under `tsx` (React's only complaint is "Element type is
invalid"); React emits `checked=""` **between** `name` and `value`, so an adjacency regex passed
for the eight unselected faces and failed for the chosen one; and the guard first looked for
`var(--font-display)` in `globals.css` when its consumer is `tailwind.config.ts`.

SPEC IMPACT: None — the fonts are a new Pro control, not a change to a locked decision. Build 7's
"four undrawn themes" claim should be struck from the plan; Build 5 needs an owner answer about
the Google Picker credentials.

---

### 10 · A section the couple writes themselves (plan's Build 4)

Owner, 2026-09-23: *"they can add a blank screen in between, to create content on the website as
well, correct?"*

**"In between" is the whole requirement, and it is why these are widgets and not a table.**
`invitation_widgets.display_order` is what puts a section between two others. A separate table
would carry its own order, and the two would have to be interleaved by something — a second source
of truth for one fact. So a custom section IS a widget, and it inherits **everything already
built**: move up / move down, the Auto · Shown · Hidden three-state, the phase fence, and every
piece of tonight's canvas — background photo, focal point, motion preset.

🔑 **The ceiling is a shape, not a rule somebody remembers.** The table is
`UNIQUE (event_id, widget_type)`, so several sections need several types: **six fixed slots**. A
seventh cannot be created by any path, including a hand-crafted POST, because the database CHECK
does not name one. That also answers the open ceiling question structurally — six was the plan's
own recommendation, and if the owner raises it the change is one list and one CHECK, together.

⛔ **Nothing is seeded.** Six empty rows on every event would be six empty rows in every couple's
editor forever, for a feature most will never use. A row exists once somebody presses *Add*.

⛔ **A heading with no words is not a section.** It renders `null`, so the canvas frame stays off
it too — a title over a blank reads to a guest as a broken page.

⛔ **The words are text, never markup.** `config_json` is host-writable; the body goes into a text
node with `whitespace-pre-line`, and there is no `dangerouslySetInnerHTML` anywhere on the path.

**Guards** — `a-section-of-your-own.test.ts` (9). Five sabotages: publish on a heading alone ·
render the words as markup · report an unadded slot as empty · replace `config_json` and lose the
arrangement · add a seventh slot.

🪤 **Two of my own guards were wrong again, and the sabotages caught both.** One forbade the
substring `onerror=` anywhere in the output — but the couple's words are a *text node*, so those
characters appear escaped and inert, and the guard failed on a page that was completely safe; it
now parses the emitted tags and asserts no element or attribute the couple opened. The other was a
**phrasing ban** (`CUSTOM_SECTION_TYPES.map|forEach`) that a `for…of` sabotage walked straight
past; `customSectionContentMap` is now exported and asked what it returns.

Migration `20271242789193` widens the `widget_type` CHECK and proves both directions: every
shipped type still accepted, and `custom_7` refused by the database.

SPEC IMPACT: None — but the **custom-section ceiling** is now answered in the shape of the schema
(six). If the owner wanted a different number, that is a one-line change in two places.
