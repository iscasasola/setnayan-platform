## 2026-11-06 · fix(open-shop): the owner's gate-walk fixes — email confirm, logo after opening with align + zoom, simpler service pick, typo-forgiving search, +63 phone box, sign in in place

The owner walked `/open-shop` on live on 6 Nov 2026 (DECISION_LOG 2026-11-06 "OPEN YOUR SHOP — THE GATE-WALK FIXES",
plan `plans/open-shop-fixes-2026-11-06/PLAN.md`, Session A). Ten fixes on the shipped wizard, extended in place:

- **A1 · Email confirm on the shop door.** `lib/open-shop-account.server.ts` flipped `email_confirm` unconditionally,
  so this door skipped the confirmation `/signup` requires. The flip now runs only when `isEmailVerificationRequired()`
  is false (the `/signup` switch). With it on: the shop is opened on the new account, the page says "We sent a link to
  <email> — tap it to finish", and the link (`/auth/callback?next=/vendor-dashboard`) lands on the dashboard. The
  account is now created only after every shop field has passed, so a later refusal can't strand an unconfirmed account.
- **A2 · Logo off step 1, asked after the shop opens.** New `/open-shop/logo` ("Add your logo"): round preview, the
  Event Hub Maker photo control (9-point align + zoom 100/120/150, `HUB_FOCAL_POINTS` / `HUB_ZOOMS`) and Skip → Today.
  Same control on My Shop's logo row. Saved by My Shop's own `updateVendorProfileField` (field `logo`). Migration
  `20271316444107_shop_logo_focal_and_zoom` adds `vendor_profiles.logo_focal` / `logo_zoom` (closed-set CHECKs,
  column grants to `authenticated` only, `vendor_profiles_self` rebuilt). `lib/open-shop-logo.ts` `logoFrameStyle` draws
  the logo on the logo screen, My Shop (row + hero via `VendorAvatar`) and the public shop page.
- **A3 · Primary service, simpler.** Search on top; the groups as a 2-column grid of `folderIcon` tiles; a group opens
  its services as one list (branches as headings, no third tap).
- **A4 · Search forgives spaces and typos.** The picker's private substring search is gone; it calls the SHARED ranker
  with reviewed aliases. New `rankTaxonomyOptionsWithClose` in `lib/taxonomy-search-rank.ts`: `matches` is
  byte-identical to `rankTaxonomyOptions` (Explore, the card maker and every other caller unchanged) and `close` holds
  typo matches (edit distance ≤1 for words ≤5 letters, ≤2 longer, on label words and aliases), shown under "Close
  matches", never auto-picked.
- **A5 · Plan limit at the pick.** "Pick your main service to start — you can add more later. How many categories you
  can run depends on your plan ⓘ"; the ⓘ lists categories per plan from `TIER_CAPS` (`categoryLadder()`).
- **A6 · Events you serve: Select all · Clear**, each dimmed when it would do nothing.
- **A7 · Phone box.** Fixed +63 on the left; digits only on the right — starts with 9 → mobile, exactly 10 digits;
  otherwise a landline with its area code (judged by `parsePhPhone`). Capped, spaced as typed, a leading 0/63 stripped,
  the sentence under the box while typing, posted as E.164 (`lib/open-shop-phone.ts`).
- **A8 · Email already has an account → sign in right here.** After a "taken" refusal, step 3's email box becomes the
  shipped in-place sign-in (`signInInPlace`): email filled, password, Google/Apple; the typing stays and the wizard goes
  on to "Open my shop". Never checked while typing.
- **A9 · Location blocked → say so.** "Couldn't get your location — type your address or drag the pin." under the map.
- **A10 · Fee box → ⓘ.** "Free to open, free to run. You pay only when a couple books you through Setnayan. ⓘ" — the
  live-schedule numbers inside the ⓘ, still before "Open my shop".

Tests: `app/open-shop/the-gate-walk-fixes.test.ts`, `lib/open-shop-phone.test.ts`, `lib/open-shop-logo.test.ts`,
`lib/taxonomy-search-close-matches.test.ts`, `tests/db/a-shop-logo-keeps-its-frame.db.test.ts`; retargeted (never
deleted) `four-steps`, `a-refused-submit-keeps-what-was-typed`, `the-logo-step-says-one-thing`, `round-logo-dropzone`.

SPEC IMPACT: controller recorded the ruling (DECISION_LOG 2026-11-06 "OPEN YOUR SHOP — THE GATE-WALK FIXES",
"SHIP AUTHORITY", "A CONTACT NUMBER ON TWO ACCOUNTS").
