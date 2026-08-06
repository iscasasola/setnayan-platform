## 2026-08-06 · feat(3d): three venues get a look of their own, and one stops pretending to be grand

Owner: **"build it."**

`venue_setting` offered eight choices; the 3D plan drew six archetypes and mapped
only four. **`destination`, `heritage` and `civil_registrar` all fell through to
the hotel ballroom** — so a couple marrying at the registrar's office was shown a
grand hall. Meanwhile **`chapel` and `rooftop` were fully drawn and no host could
ever pick them.**

🪤 **Nothing failed.** Every one of those settings rendered a perfectly good room,
just the wrong one, and a fall-through in a `switch` with a `default:` is
invisible to the typechecker.

**Three new shells, drawn in the same primitive vocabulary as the existing six:**

- **Restaurant** — lower ceiling, warmer walls, a bar counter along one wall. A
  restaurant reception is close-packed and bar-led; the ballroom was right in
  kind and wrong in character.
- **Heritage / hacienda** — adobe walls, a run of arcade columns, capiz-warm
  windows, a *higher* ceiling. The arcade is the signature of the Philippine
  heritage venue.
- **Civil registrar** — small, plain, cool, the lowest ceiling of any archetype,
  and deliberately **no ceiling wash**. The wash is what makes the ballroom feel
  grand, and grandeur was the exact defect: this is the least grand room a couple
  will ever stand in, and showing them a hall set an expectation the day cannot
  meet.

**`destination` → the beach shell.** ⚠ A judgement call, and the corpus flagged
it as genuinely ambiguous — "destination" means *away from home*, not a room
shape. In the Philippines a destination resort is overwhelmingly beachfront
(Boracay, Palawan, Bohol), so sand and water is the likelier truth, and it costs
no new drawing. **Reversing it is one line**, and a test names it so reversing is
deliberate rather than accidental.

🔑 **A NEW ARCHETYPE COMPILES GREEN WHILE LOOKING WRONG.** The floor-colour and
background functions both end in `default:`, so adding a union member
type-checks with zero edits and silently inherits the ballroom's dark palette.
All three are listed explicitly in both, and the comment says why.

**Guarded:** `venue-archetype-coverage.test.ts` fails if any host-selectable
venue resolves to the fall-back archetype — the check that would have caught the
original bug. Mutation-checked: removing any of the four new mappings goes red.
An unknown value still fails **soft** to a walkable room, because a guest must
never get a blank scene.

⏭ **Not in this change:** making `chapel` and `rooftop` selectable needs a
database constraint widened, and restaurant *content* (there are zero restaurant
rows in the venue directory) is admin data entry. Both ship separately.

**Verified:** full suite 6,929 pass under `Asia/Manila` · scoped `tsc` clean ·
13/13 lint scripts clean · the existing venue-settings drift guard still green ·
**no migration**.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-06 — recorded with the other owner decisions.
