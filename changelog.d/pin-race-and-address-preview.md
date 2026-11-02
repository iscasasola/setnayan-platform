## 2026-08-10 · fix(open-shop): six defects on the signup screen, found before the owner walked it

An adversarial sweep over the four-step wizard, run because that screen had been changed **nine times in one day** and the last regression in it was one I introduced. Six survived refutation. **Three are mine, from today.**

### 🔴 The permanent address on screen was not the one created

The visible box sanitised to `[a-z0-9-]` — hyphen **included**. The submitted value went through `slugifyBusinessName`, whose alphabet is `[a-z0-9]` — hyphen **excluded**.

So a vendor typing `banawe-florals` saw `setnayan.com/banawe-florals`, saw the green **Available** tick, read *"you can't change this later"* — and got `banaweflorals`. **A permanent address agreed to in one form and created in another**, with no rename to put it right.

🔑 **The comment on the broken line argued the exact principle it broke** — *"a space or an apostrophe would silently disappear at submit and look like the field ate it."* Right rule, one character short. **A rule stated in prose and enforced by a second hand-typed regex is one edit away from disagreeing with itself.** The new guard runs both transforms over real strings and asserts the box's output is a **fixed point** of the mirror, so no example list can go stale.

### 🔴 Confirming the pin too quickly silently un-confirmed it

`setPin` is synchronous, so the confirmation card appeared the **instant** the map was tapped — carrying the *previous* answer, with a live Yes button — while `setConfirmed(false)` ran only after the awaited lookup.

Tap "Yes, that's right" in that window (a second or two on mobile data, two network hops including a 1-req/sec community geocoder) and the green **Location confirmed** tick appeared, then vanished on its own. Press "Open my shop" in between and you were refused with *"Check the address on the map, then tap 'Yes, that's right'"* — **about a button you had just pressed**, with nothing on screen explaining it.

Worse for anyone dragging a pin: the card kept saying *"Are you in Quezon City?"* over a pin that had moved to Makati.

Three changes, each closing a different part of it:

- 🔑 **Moving the pin voids the old agreement and the old card at the same instant it moves the pin** — cleared synchronously, before anything is awaited. A confirmation is about a place; the moment the place changes there is nothing left to have agreed to.
- The card does not render while the lookup is running, so there is no window in which a stale question can be answered.
- A generation token: a reply for an older pin writes nothing, including the spinner.

### The saved street could belong to a different spot than the saved pin

Tap the map (box fills with street A), notice the pin is off, tap again — the box kept **street A** while the card showed **street B**, and B's coordinates were saved. Two addresses on screen at once, and a shop filed with a street that does not match its own pin — **exactly the pair a reviewer holds against the Mayor's Permit.**

🔑 **The fix is about who owns the text.** What a vendor typed is theirs and is never overwritten. What we derived from a pin belongs to that pin and moves with it. The tested rule takes a third argument and **defaults to theirs**, so a caller that forgets it fails safe toward keeping what a person wrote.

### The last step asked for the wrong city

*"Add the city you serve."* — a coverage question, on a step headed **Where you are**, for a box that is checked against the vendor's DTI, BIR and Mayor's Permit and is locked afterwards. It invited *"Metro Manila"* or a city they travel to into a field that must say where they physically are. **Prod already shows a vendor putting the wrong thing in this box.** Now: *"Add the city your business is in."*

### Verification

Mutation-tested: restoring the hyphen to the box (2 fail) · and three new assertions covering the race, each pinned to the specific mechanism rather than to the symptom.

**7381/7381** unit · 20/20 `lint-*.mjs` · `tsc` clean.

⚠ **Eight further claims were REFUTED** by the same sweep and are not acted on — including "the logo preview is a circle but the logo is never round anywhere it is shown" and "a failed lookup leaves 'Location confirmed' on screen". Recording that they were checked and did not survive, so nobody re-raises them.

SPEC IMPACT: None.
