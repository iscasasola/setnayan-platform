# #8041 · search and AI text from one source — §4 proof (22 Nov 2026)

**1 · Screens.** None to shoot: this PR changes text only (`/llms.txt`, the AI answers, /help bodies, the site title,
the meta description and the Organization JSON-LD). It changes no layout. What it serves is in
`llms-txt-rendered-from-test-fixture.md`.
⚠ That file is rendered from the **test fixture** (`lib/llms-txt-guard-input.ts` + the code-default `BOOKING_FEE`), not
from production. Its prices and its fee rate are fixture values; production reads `platform_retail_catalog_v2`,
`vendor_billing_catalog` and `platform_settings`.

**2 · Drawing parity.** No drawing. The words come from specs `SETNAYAN_FOR_SEARCH_AND_AI_2026-11-20.md`. They differ
from the source in these ways:
- Fee wording is main's (`lib/booking-fee-who-words.ts`: `FEE_SCOPE_THIRD` + `FEE_FREE_RULE_THIRD`). Main retired the
  first-booking promise at its source on 20 Nov, after this PR was written.
- Patiktok, Music Maker and the §9 "never say" column are left out (retired names).

**3 · Ways in.** `/llms.txt` (route `app/llms.txt/route.ts`), the /features FAQ and its FAQPage JSON-LD, /admin/seo, and
/help (web + in-app bodies). The site title, meta description and Organization JSON-LD are in `app/layout.tsx`, on
every page. Checked by the guards, not in a browser.

**4 · Guards.** Full preflight from `apps/web` (`preflight-2026-11-22.md`): 51 checks pass. That is 46 CI guards,
eslint, tsc (24 files), 628 tests that import a changed file, 5,488 whole-tree guard tests and 216 DB tests that scan
source. Full typecheck, full unit suite, full DB replay, build, Lighthouse and e2e are LEFT TO CI.

**5 · Overlapping open PRs.** #8004 (`lib/llms-txt.ts`, `lib/help/topics-existing.ts`, `lib/help/user-2.ts`). #7988
(`lib/public-copy-is-not-wedding-only.test.ts`, `lib/retired-products-stay-retired.test.ts`,
`lib/the-app-says-event-in-plain-words.test.ts`). #7935 is stacked on this PR and must merge after it. Sixteen open
PRs also touch `lib/ugat/screens.generated.json`.

**6 · §2 rules not followed.** "Capture the real page before designing from it" and "screens at 375 light and dark":
not applicable, since there is no screen. Nothing else.
