## 2026-11-10 · feat(seo): search engines and AI read today's product (Build 6 Lane K)

Owner, 10 Nov: *"add to build 6 the database created to help our page be more visible to searches on search engines
and AI. update them all as well"*.

- **`/llms.txt`** (`lib/llms-txt.ts`):
  - The supplier plans are now Lane J's plan table, cell for cell: Free · Verified · Solo · Pro · Ultra, all six limits
    and every tool and price read from code and the live catalogue. This replaces a hand table that had pre-4 Nov caps,
    no Free column, and an Ultra "read API" that doesn't exist.
  - The commission line no longer says a bare "No": it says who pays what, with the live booking-fee rate.
  - Event Plus and Event Pro now use the front-door card's wording.
  - Removed: "4-in-1 Event Hub", "Pro Event Hub", and an "AI Proposal Builder (Pro+)" that no code ever had.
  - `/for-coordinators` is now linked.
  - New section, "Questions AI assistants get wrong", with 12 checked answers.
- **One list of saved questions** (`lib/seo/ai-answers.ts`): app · commission · free guest photos · storage · no signal ·
  payment schedules · live wall · chat tools · suppliers and guest photos · coordinators · "like Vowly?" · "PhotoShare?".
  - It feeds `/llms.txt`, the English `/features` FAQ and its FAQPage structured data (`whyFaqItems`), and `/admin/seo`.
  - Each answer cites the code that makes it true. None types a price.
- **The daily audit** (`lib/seo/health-checks.ts`, `seo-cron-jobs.ts`):
  - Ended the standing daily FAIL (measured in prod on the 10 Nov snapshot). It came from a Setnayan AI price exemption
    that outlived the 4 Nov ruling.
  - The booking-fee figures and ₱0 are no longer reported as orphans.
  - Patiktok (unlisted) is never "missing".
  - Three new checks: the saved questions are answered · no retired names (`lib/seo/stale-claims.ts`) · the front pages
    are in the served sitemap.
  - `/for-coordinators` added to the known routes; the dead `/tl` removed.
  - Simulated on the live catalogue: 0 fail, 1 warn (Bing token, an owner action).
- **`/admin/seo` → AI answer check:**
  - Paste what an AI said, then mark it right or wrong. Either way it's saved as one `seo_suggestions` row
    (wrong → `pending`, right → `rejected` = "no change needed").
  - Shows when each question was last asked and whether it's due (30 days), plus a "Drift to fix" queue with
    "Mark fixed".
- **Homepage structured data:** Setnayan AI is described as inside Event Plus / Event Pro, the Logo Maker as animated by
  Event Pro (not "Event Hub Pro's Logo & QR part"), and the free Papic credits as on the first event (not "on every
  event"). The unverified "personal reels" line is gone, and Memory lane is added.
- **Sitemap:** the pages Lanes J and K changed now carry a 10 Nov lastmod.
- **Guard:** `lib/seo/answer-engines-read-todays-product.test.ts`, 12 tests; two sabotages were watched going red. Six
  new audit tests are in `health-checks.test.ts`.

SPECIFIC NON-CHANGES: production read with SELECT only; no migration, no row written. `seo_suggestions` held 0 rows, so
there was nothing stale to clear. No page was restyled. The Tagalog FAQ keeps its own five answers.

SPEC IMPACT: one `DECISION_LOG.md` row, 2026-11-10 "LLMS.TXT, THE FAQ AND THE AUDIT ANSWER WHAT AI GETS WRONG". Its
text is in the PR body for the controller to append (this session pushes only to its platform branch).
