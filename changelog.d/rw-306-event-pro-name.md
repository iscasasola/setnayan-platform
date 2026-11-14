## 2026-11-14 · copy(plans): the last screens say "Event Pro" — the catalogue's own name for the plan (RW-306)

The live site still showed the retired plan name ("Event Hub Pro" / "Event Hub PRO") on couple screens — the Maker's ◆
marks and notes, the theme picker, the reveal openings, Prints, the Details page's services row, the custom-address
field, the guest Event Hub's comments — and in copy built from catalogue keys (the Studio tile's label and button, the
editorial "Powered by" label, the love-story "Go …" button). Every one now says **Event Pro**, the title the live
catalogue gives `COUPLE_WEBSITE_PRO`. Event Ultra is a separate, higher plan (`EVENT_ULTRA`) and is untouched.
SKU codes, keys, file names and App Store ids are unchanged; no new look.

- **New guard `lib/the-old-hub-plan-name-is-gone.test.ts`:** no file under apps/web (copy, labels, tests, comments)
  names the old plan in any spelling, including one wrapped across two lines (it found seven the sweep missed); and
  every hand-typed name of the plan — `PLAN_NAME.pro`, the Studio tile, the editorial label, the App Store product —
  equals the catalogue title in the repo's one catalogue mirror (`lib/llms-txt-guard-input.ts`). Two sabotages red.
- **`lib/help-tips-and-tours-name-what-ships.test.ts`:** the old name is now held on every tour and every ⓘ, not only
  Help (it was Help-only until the other screens were renamed).
- The T3 "both spellings" transition (`⏳ TRANSITION #7605`) is closed: the tests that read couple-side source now
  require "Event Pro" alone. This supersedes the stalled #7605.

SPEC IMPACT: None — the name is the owner's ruling of 13 Nov 2026; the catalogue already carries it.
