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
unchanged: the shop's Auto-reply, Voice match and Shop page (Event Hub page) editors' on/off rows — each had its
own orange (`--m-orange`) 36 × 20 track — and a service card's "show on Explore" (an eye icon that filled ink
when live; it is the switch now, with the same name and the same form). `SWITCH_SWEPT` gains `app/vendor-dashboard`.

Listed, not converted (a yes/no drawn as two answer buttons): "Include a Setnayan gift — Yes, include it · No,
not on this card" in `services-manager.tsx`, `canvas-maker.tsx` and `service-wizard.tsx`.

SPEC IMPACT: None.
