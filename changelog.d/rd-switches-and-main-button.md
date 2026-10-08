## 2026-10-08 · feat(ui): every switch is the one switch — couple area; the two `.sn-switch` rules no longer collide

Owner, verbatim (2026-10-08, `INTERACTION_RULES.md` § 9 and its APPROVED block): *"switch is teracota or greyed
out"* · *"we want the whole app to be adaptive to the same feel"* · *"the only part that does not follow our rules
is their customized event hub"*. Approved drawing: `prototypes/control_templates_2026-10-08.html` § 3.

- **Found on the way — two rules had one name.** `globals.css` held TWO `.sn-switch` rules: the span track's
  (2026-10-08: colours and the spring only) and, LATER in the file at the same weight, the guest card's real
  checkbox (2026-09-30: its own 44 × 26 size, its own `::after` knob, `transition: transform .2s`, green when on).
  The second landed on every span track: the Maker's `StudioSwitch`, `PanelSwitch`, `Toggle` and the schedule's
  `Switch` were forced to 44 × 26; the two that draw their knob as a child got a second knob that never moved; the
  two that move their knob by `left` lost the travel (it jumped). The checkbox's rule is now `input.sn-switch`
  (no Maker file is edited) and it is the SAME switch: grey off, terracotta on (the variable the track uses — the
  green `#4f6b4a` is gone), the approved 50 × 30 with a 24-px knob travelling 20 px, at the family's speed and
  spring. Its two users (the guest card's yes/no rows, the invited-to rows) change with it.
- **The one drawing — `app/_components/switch-track.tsx`:** `SwitchTrack` / `SWITCH_TRACK` (50 × 30, a 24-px knob)
  and `SWITCH_BUTTON` (a bare 44-px target: the app's 44-px floor on every button had been stretching a track
  drawn ON a button). No hook, no state, no request. It chooses no colour — `.sn-switch` does.
- **Couple area, 14 switches moved onto it** (same handler, form field, `aria-checked`, name and disabled state):
  Push notifications · Haptic feedback · the Profile's setting rows · Share budget ranges · a coordinator's
  access · Flash auto-wall · Show guests their seats early · Show the outfit figure (a real checkbox, kept) ·
  Matches my colours (a hidden checkbox, kept) · the live wall on guests' phones · the Papic gallery open to
  guests · feature this recap · Play music in your film · a supplier's colour access. Gold, green and the second
  terracotta are gone from them. The two Papic switches were worded buttons that filled when on: the words stay,
  the fill is the track's now.
- Not here: the Maker's own files (`launch/`, `website/editor/`), the supplier, sign-up/public and admin areas
  (next commits), and the guests' Event Hub (exempt).

Guard: `lib/every-switch-wears-the-one-look.test.ts` (5) — no bare `.sn-switch` rule may size a track or draw a
knob; a checked box is the colour a track is when on; in the areas listed in `SWITCH_SWEPT` every `role="switch"`
wears the drawing and keeps no fill of its own. 29 sabotages seen red.

SPEC IMPACT: None (the rule and the drawing are already in `INTERACTION_RULES.md` § 9).

## 2026-10-08 · feat(ui): every switch is the one switch — supplier area

Same ruling, same drawing (`app/_components/switch-track.tsx`). Four supplier switches moved onto it, behaviour
unchanged: the shop's Auto-reply, Voice match and shop-page editors' on/off rows — each had its
own orange (`--m-orange`) 36 × 20 track — and a service card's "show on Explore" (an eye icon that filled ink
when live; it is the switch now, with the same name and the same form). `SWITCH_SWEPT` gains `app/vendor-dashboard`.

Listed, not converted (a yes/no drawn as two answer buttons): "Include a Setnayan gift — Yes, include it · No,
not on this card" in `services-manager.tsx`, `canvas-maker.tsx` and `service-wizard.tsx`.

SPEC IMPACT: None.

## 2026-10-08 · refactor(ui): the switch reads the app's accent token

Merged the Look stack's `d349cf57b` (the accent is ONE setting: `--sn-accent` / `--sn-on-accent`, classes
`bg-sn-accent` · `ring-sn-accent` …). The switch's two colour lines move onto it: a checked real checkbox
(`input.sn-switch:checked`) is `rgb(var(--sn-accent))` — the same declaration the track's "on" now is, which
`every-switch-wears-the-one-look` (2) holds equal — and the drawing's keyboard-focus ring is `ring-sn-accent/40`.
`app/_components/switch-track.tsx` joins `TEMPLATE_FILES` in `lib/the-accent-is-one-token.test.ts`.

SPEC IMPACT: None.

## 2026-10-08 · feat(ui): every switch is the one switch — sign-up and public

Three public switches wear the one drawing, behaviour unchanged: the supplier tour's "Setnayan AI" switch (it was
a hand-written gold hex) and the home page's 3D demo — "Apply mood board" (a 34 × 20 gold track) and "Walk
around" (a pill that filled ink while walking; the words stay, the track says on). `SWITCH_SWEPT` gains
`app/_components/home`, `app/tour`, `app/onboarding`, `app/signup`, `app/login`, `app/features`,
`app/for-suppliers`.

Listed, not converted: onboarding's "Add … to my event — ₱…" rows (`app/onboarding/_shared/services-step.tsx`,
two). They say `role="switch"` but are TICKS by the owner's 2026-08-11 ruling (they add a paid line to the
order) — the Ticks kind's lane. Named in `SWITCH_NOT_SWEPT`, each with why; the list fails when one is gone.

SPEC IMPACT: None.

## 2026-10-08 · feat(ui): every switch is the one switch — admin

Three admin switches wear the one drawing, behaviour unchanged: the website widgets' on/off (it was green), a
category's on/off row (a submit button in its own form; gold) and the Reveal studio's Toggle row (a hand-written
wine `--m-mulberry` track; the row's wine tint when on is gone — the track says on). The last two say
`aria-pressed`, not `role="switch"`; what they say is left as it is and they are named in the guard
(`DRAWN_AS_A_SWITCH`). `SWITCH_SWEPT` gains `app/admin`.

After this commit, the `role="switch"` controls that do not wear `SwitchTrack` are: the Maker's own files
(`launch/`, `website/editor/` — their builders' lane), onboarding's two ticks, and the guests' Event Hub (exempt).

SPEC IMPACT: None.

## 2026-10-08 · fix(ui): the one switch's knob really travels at the family's speed

Measured on the compiled stylesheet in headless Chromium (a static page, no server): the drawing's knob moved in
`0.15s cubic-bezier(.4,0,.2,1)` — not the family's 0.7 s spring. Cause: `after:transition-transform` is a Tailwind
VARIANT utility, and variant utilities are emitted at the END of the compiled sheet, after every rule written in
`globals.css`; at the same weight it outranked `.sn-switch::after`. `SWITCH_TRACK` no longer carries a transition
utility on the knob, so the family's rule is the only one: now `0.7s cubic-bezier(.34,1.56,.64,1)` on all three
forms (button, hidden checkbox, real checkbox). The guard refuses any `after:transition|ease|duration|delay`.

Same measurement, NOT fixed here (Maker files, another lane): `StudioSwitch` (`after:transition-[left]`) and the
Maker's `Toggle` (`after:transition-transform`) have the same defect — their knobs read 0.15 s, no spring.

SPEC IMPACT: None.

## 2026-10-08 · fix(ui): every switch's knob travels at the family's speed — the Maker's two included

Controller's ruling on the finding above (option b): ONE rule beside the switch rules in `globals.css`,
`.sn-switch.sn-switch::after { transition-duration: var(--sn-pill-dur); transition-timing-function:
var(--sn-pill-spring); }` — the class doubled only so it outweighs one `after:transition-*` utility; it never names
what moves (one drawing moves its knob by `left`, another by `transform`). No Maker file is edited.

Measured on the compiled sheet in headless Chromium (a static page; knob position on → 120 ms after switching off
→ at rest), before → after this rule:

| Form | Size | Knob moves by | Before | After |
|---|---|---|---|---|
| StudioSwitch (Maker) | 46 × 28 | `left` 21 → 3 | 0.15 s, plain ease | 0.7 s, spring |
| PanelSwitch (Maker) | 54 × 32 | `left` 25 → 3 | 0.7 s, spring | the same |
| Toggle (Maker) | 44 × 24 | `transform` 22 → 2 | 0.15 s, plain ease | 0.7 s, spring |
| Switch (Schedule) | 40 × 24 | `transform` 19 → 3 | 0.7 s, spring | the same |
| SwitchTrack · button | 50 × 30 | `transform` 23 → 3 | 0.7 s, spring | the same |
| SwitchTrack · hidden checkbox | 50 × 30 | `transform` 23 → 3 | 0.7 s, spring | the same |
| `input.sn-switch` (a real checkbox) | 50 × 30 | `transform` 23 → 3 | 0.7 s, spring | the same |

Every knob was part-way at 120 ms (it moves; none jumps), one knob each, terracotta on, grey off.

Guard: `every-switch-wears-the-one-look` (3b) — the rule says exactly the family's speed and spring and no
property; every class string in the app that wears `sn-switch` may put a timing utility on its knob only as
`after:transition…` (one more variant would outweigh the rule again in one state). 6 sabotages seen red.

SPEC IMPACT: None.

## 2026-10-08 · feat(ui): on the dashboards the main button is the app's accent, a pill

Owner, verbatim (2026-10-08): *"for all the design templates you gave me, i am now satisfied on all of these"* (the
gallery's § 9: main = terracotta with white words, a pill; second = white, a hairline, ink words; "cannot be used
yet" = grey) · *"if we change our color to blue, it will be easy to change the button colors"*.

`.button-primary` is ONE class with three renderings. ONLY the dashboards' (`.app-surface …`: couple, supplier,
admin) changed — `app/globals.css`, that one block:

- **Main:** fill `rgb(var(--sn-accent))`, words `rgb(var(--sn-on-accent))` — one declaration each (was gold
  `--sn-gold-700` with `#fffdf8`). A hover no longer repaints it (it lifts, with the accent's shadow), so there is no
  second pair to read badly one interaction away.
- **Second:** white (`--sn-surface`), a 1-px hairline (`--sn-line`), ink words (was a 1.5-px ink outline on nothing,
  turning into an ink button on hover). Its hover darkens the border and lifts.
- **Both** are the full pill (`--m-r-full`), whatever radius a page asked for.
- **Cannot be used yet** (`:disabled` or `aria-disabled="true"`): grey (`--sn-hairline` under `--sn-ink-300`), flat,
  no lift — and no longer faded to 60% on top of that.
- **Reach:** 163 lines carry `button-primary` and 119 `button-secondary` under the three dashboards
  (`/usr/bin/grep -rc --include='*.tsx' button-primary apps/web/app/{dashboard,vendor-dashboard,admin}`).

Contrast, each pair that changed (the lint's own arithmetic):

| Pair | Before | After |
|---|---|---|
| main, at rest | #FFFDF8 on #8A6B39 — 4.87:1 | #FFFFFF on #C24E25 — 4.76:1 |
| main, hover | #FFFDF8 on #5C4726 — 8.66:1 | the same pair as at rest — 4.76:1 |
| second, at rest | #1B1A17 on the page (#FBFAF7) — 16.67:1 | #1B1A17 on #FFFFFF — 17.40:1 |
| second, hover | #FBFAF7 on #1B1A17 — 16.67:1 | the same pair as at rest — 17.40:1 |
| cannot be used | the live pair at 60% opacity | #A09A8E on #EDE8DE — 2.29:1 (an inactive control; exempt, and meant to read "off") |

**Guest and public pages render as before — measured, not only read.** The compiled stylesheet (the repo's own
Tailwind config) on a static page in headless Chromium, before and after: a public button, a guest button in
`.sn-editorial`, and a guest button under a host's Buttons choice read the SAME values at rest and on hover (fill,
words, radius, border, opacity, shadow, lift); only the buttons under `.app-surface` changed. Why, from the cascade:
every rule here starts with `.app-surface`, which only the three dashboard layouts set. One guest-look island
lives INSIDE a dashboard — the Maker's Look sample: at rest it reads the same; on hover it used to borrow the
dashboard's gold fill and lift (a leak) and now does not — everything new is written `:not(.sn-editorial *)`.

**The contrast lint can read it.** `lint-label-on-fill-contrast` resolved a hex and `var(--x)` but not
`rgb(var(--x))` — the form every Tailwind-facing token takes — so a rule pairing two such tokens was skipped in
silence. It reads that form now: 7 pairings that were never measured are (all pass), and the main button's is
one it would catch (ink words on the accent → 3.00:1, red).

NOT in this commit: the hand-made buttons. Counted for the next lane — lines carrying the class, not all of them
buttons (`/usr/bin/grep -rcE --include='*.tsx' '<class>' <area>`, tests excluded):

| Area | `bg-ink` | `bg-terracotta-700` (gold) | `bg-mulberry` | `bg-terracotta` / gold hex | inline `style` background |
|---|---|---|---|---|---|
| app/dashboard | 127 | 77 | 190 | 45 | 165 |
| app/vendor-dashboard | 73 | 15 | 18 | 12 | 201 |
| app/admin | 38 | 17 | 42 | 12 | 45 |
| app/_components (shared) | 29 | 18 | 56 | 12 | 73 |
| app/onboarding · signup · login | 1 | 0 | 4 | 2 | 8 |

Guard: `lib/the-main-button-is-the-accent.test.ts` (6). 19 sabotages seen red there and 3 on the lint.

SPEC IMPACT: None (the ruling is in `INTERACTION_RULES.md` § 9's APPROVED block).
