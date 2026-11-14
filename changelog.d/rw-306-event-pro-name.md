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
- **The name is READ on the pages that sell it** (controller's correction, same day): the Event Pro page
  (`/studio/website-pro`) and the Hub settings locks (site chrome · hero photo · living hero — `WebsiteProLock`) take
  the plan's name from its catalogue row — `hubPartPrices` now carries the row's `title` (`fullTitle`) on the read it
  already made, so no read is added for the page; the lock asks the same once-per-render read. An unread title falls
  back to the plan list's name, never a blank button.
- **The catalogue's own part titles are left alone** ("Event Hub Pro · Photos" and the other ten off-sale part rows
  are admin-managed data): the catalogue mirror keeps them byte for byte, and the guard excuses exactly those rows,
  by shape — an allowance that stops matching fails (test 1b).
- **A blind spot closed, and what it found:** `lib/store-shell.test.ts`'s "nothing that sells renders in the app" scan
  now reads the fixed text of template strings too (`` `Unlock ${planName}` `` sells as plainly as the typed words
  did). It found a supplier's portfolio form telling them, inside the iPhone app, to "Buy a pack on Money" — in the
  app that sentence now ends at the limit (App Review 3.1.1); the web is unchanged.
- The T3 "both spellings" transition (`⏳ TRANSITION #7605`) is closed: the tests that read couple-side source now
  require "Event Pro" alone. This supersedes the stalled #7605.

SPEC IMPACT: None — the name is the owner's ruling of 13 Nov 2026; the catalogue already carries it.
