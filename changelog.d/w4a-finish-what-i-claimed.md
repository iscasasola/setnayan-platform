## 2026-08-24 · fix(dashboard): finish what W4-A claimed — the colours a class-name sweep could not see, and two gaps it never looked for

W4-A PR 4 of 4, opened by an **adversarial audit of my own three merged PRs**
(11 agents, every finding re-verified by hand). The audit's verdict: the stream
did about two-thirds of its job and reported it finished. The building was
sound and nothing was rebuilt that existed — the **measuring** was wrong.

🔑 **THE ROOT CAUSE, WORTH MORE THAN THE FIXES:** PRs 1–3 swept for one
SPELLING of a colour (`text-terracotta`, a class name), found every instance of
that spelling, and reported that the colour delta was closed. Colour also
reaches these screens as a **raw hex** and as an **inline CSS variable**, and
both were invisible. *A search that can only match one spelling is not a
survey.*

### The colours that spelling could not see

Measured against the surface each one actually lands on, not against white:

- **alaala's `01…06` stage numerals: 2.03:1** — `--m-orange-3` #CBA766 on the
  #F4F2EC card. **Worse than the 3.37:1 gold this whole stream existed to
  remove**, in a file PR 3 edited that same day. Same defect on the
  story-assignments page. Both now `terracotta-800` **as a class**, so a guard
  can see them.
- **The second gold ERROR message.** PR 2's write-up boasted about fixing a gold
  error — "a refusal dressed as an accent". There was another one file away
  (`.plan-err`, #9a6a12, 4.56:1) that survived because it is written as a hex.
  Now `danger-700`.
- **Four supplier-search badges at 3.96–4.06:1** — gold text on a gold tint.
  Gold has almost no headroom, so it passes on paper (4.78:1) and fails on its
  own tint. A second slot `--gold-on-tint` #6F5A2E (5.29–5.42:1) rather than
  deepening the one that is already correct where it is used.
- **Two alaala eyebrows at 4.42:1** — the repo's canonical text gold #8A6B39
  *fails on the tinted card*, same law.
- **The "coming soon" chip marker at 3.67:1** — the only thing telling a couple
  a feature is not available yet was the faintest text on the chip.
- Three contact links and the required-field `*` in shared components that
  render on these screens.

### Two gaps a colour sweep was never going to find

- **The guest list's NAME column.** Six fixed columns summed to **78%** of the
  table; the name got the remainder minus the 40px checkbox, and spent 116px of
  that on padding, avatar and quick-view button before a glyph — so
  "Maria Villanueva" rendered **"Maria Vil…"**, and with a guest inspected the
  rail took `clamp(340px,30vw,420px)` more and left the name ~0px at 1440px.
  Fixed columns now total **56%**. **Nothing was removed** — which columns exist
  was never ruled on, only that desktop is rows and not tiles (owner
  2026-06-05).
- **Deleting a saved plan asked nothing.** A hard row delete, no undo, no name
  read back — while *clearing the rebuildable candidate list* on the same screen
  already stops and asks with a named keep. The screen guarded the reversible
  thing and not the irreversible one. The dialog was already imported, already
  instantiated and already mounted; it simply was never put in front of this one
  control.

### The guard is rewritten, because rev 1 was decoration where it mattered most

`gold-is-not-text.test.ts` listed alaala and its **real coverage there was
zero**. Now three rules over a file set that is **resolved, not enumerated** —
it follows the four trees' own imports into `_components/`, so a hand-written
list can no longer be "the files somebody thought of" (it picked up 3 shared
components that were invisible before). New rule: a table of colour values
measured below the AA floor, banned as text **in any spelling** — hex or CSS
var — each row carrying its measurement so a reader can check the arithmetic
rather than trust it.

🛡 Mutation-tested by printed occurrence count, before → after: new bare gold
RED · bill-rot RED · comment-only GREEN · typo-shape RED · the 2.03:1 value
reintroduced as a **var** RED · the same value as a **hex** RED · bare gold in a
**shared component** RED. ⚠ One sabotage printed 0→0 (never landed) and reported
a clean pass — caught only because the count is printed, and redone.

### Deliberately NOT built — an owner call, with the trade-off named

The Roster archetype says the roster "never grows a selection column", and the
desktop table has one. A faithful "the avatar IS the checkbox" port would
**lose** what a native checkbox gives free (role, announced state, Space to
toggle, `indeterminate` on select-all, forced-colors rendering), put the target
at 36px against this repo's own 44px minimum, and silently reassign a click
that today opens the guest. ⚠ And the premise that "mobile already does it the
approved way" is **not accurate** — mobile *swaps* the checkbox into the
avatar's slot in select mode; it does not make the avatar the control. That is a
design decision with an accessibility cost, not a port. Flagged, not taken.

SPEC IMPACT: None.
