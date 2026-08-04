## 2026-07-31 · the wizard now records what an event commemorates, and whether it comes back

The generic onboarding — the live path for every non-wedding type — wrote **no** `anchor_date`, `anchor_origin` or `recurs`. Only `anchor_kind`, from the authored map.

So an anniversary created through it landed with no commemorated date and `recurs = false`. `couples_with_anniversary_today()` reads `anchor_date` for recurring anniversaries, and `buildYearMoments` derives the Year view from the same pair — **neither could ever match it.** The event was permanently invisible to the surface built for it, and there is no screen anywhere to set those fields after creation. The inline form has asked this since PR-A (2026-07-12); the wizard that replaced it never did.

### Two questions, only where they mean something

**`anchor` — anniversary only.** *"What date are you marking?"* with the sub-line **"The day it commemorates — not the day you'll celebrate. We ask that next, because you can hold it whenever suits everyone."** That is the whole point of the two-column model (owner, 2026-07-30: *"events doesnt need to be celebrated on their exact date"*): `anchor_date` is what is marked, `event_date` is when it is held, and in PH a Tuesday milestone is very often a Saturday party. `event_date` still lands NULL — the day it is held is chosen later, unchanged.

The origin picker offers **positive origins only** (`ANCHOR_ORIGINS`), mirroring the DB CHECK. There is no memorial option because there is no memorial value — babang-luksa stays out of this product, and the picker cannot offer what the column would reject.

**`recurs` — the six toggle types** (`canToggleRecur`: travel · celebration · corporate · gala_night · reunion · tournament). Anniversary and birthday recur by nature and get no toggle; wedding, debut, christening, gender reveal and graduation are one-time.

### ⚠ The counsel gate is enforced in the INSERT, not just the UI

`birthday`, `debut` and `christening` have anchor kind `person_birthdate`. That date **is a person's birthdate**, and events do not store those. The wizard never asks — but "the UI does not ask" is not a guarantee, so `buildGenericEventInsert` forces `anchor_date` to NULL for any `person_birthdate` type regardless of what the payload carries. A future screen that starts asking cannot leak through this path.

`anchor_origin` is filtered through `isAnchorOrigin` for the same reason: an unrecognized value is dropped rather than passed through to fail the insert.

### Also: copy I made stale yesterday

The `life_event_exists` card still said *"type their name in "Para kanino?" when creating"* — a field the live path no longer renders. My own fix gave the wizard **"Who are we celebrating?"** instead, which made that instruction send people looking for something that is not there. Reworded to name the act, not the label.

### Tests

`anchor-write.test.ts` — 6 cases: an anniversary carries date + origin + yearly; the anchor is **not** the event date (`event_date` stays null); **the counsel gate holds for all three `person_birthdate` types even when a date is passed**; non-positive origins (`memorial`, `death`, `babang_luksa`, empty, whitespace-padded) are all dropped while every allowed origin survives — so the filter is not just "always null"; `recurs` defaults FALSE so nothing is silently made yearly; and the toggle set matches exactly what the wizard offers.

**5,733 unit tests, 0 failures.** `tsc` clean · `next lint` clean.

SPEC IMPACT: None. The anchor model, its positive-origins lock and the counsel gate are unchanged — this is the first non-wedding flow that actually feeds them.
