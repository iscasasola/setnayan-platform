## 2026-08-13 · refactor(home): retire the ELN cinematic homepage — one door, no flag, no fallback

Completes the owner's 2026-08-13 ruling: *"yes we want the new website"* → *"Retire it completely."* The new front door has been live and looked at, so the June cinematic page, its pillars, its Spotlight strip and the flag that chose between them are all deleted. `/` now renders `<FrontDoor>` unconditionally.

### 🚨 Retiring a LAYOUT quietly retired a BRAND DECISION — and a guard is the only reason we know

`lib/home-front-copy.test.ts` pinned the **owner-approved § 5 Filipino-USP copy** line by line against the deleted files. Deleting the page turned it red with `ENOENT`.

**The ruling was about a page. Nobody said out loud that it also deletes copy the owner personally approved** — the hero sub-line, both headline lines, and the manifesto containing the **samahan clause**, which that guard's own words call *"the load-bearing idea of the approved manifesto."* Measured: the word `samahan` now appears **nowhere** in the front door.

📄 All of it is preserved verbatim in the corpus at `RETIRED_ELN_HOMEPAGE_COPY_2026-08-13.md`, with the open owner question — *do you want the manifesto on the new front door?* — stated rather than answered. Putting a new section on a locked, approved design is the owner's call; losing his approved words silently is not an option either. **A guard going red because its subject vanished is a finding, not noise.**

### 🔴 A LIVE OAuth regression, fixed

The new front door renders the wordmark as literal `SETNAYAN`. `app/home-brand-name.test.ts` records why that is not a style question: **"SETNAYAN" in the markup was the original 2026-07-25 Google OAuth REJECTION** — brand verification reads the homepage for the consent-screen app name as visible text, character for character, and the caps form did not read as a match. That guard was red (its file was deleted), so the regression shipped unguarded and **is live right now**.

Fixed so both are true at once: the markup says **`Setnayan`**, and `text-transform: uppercase` on `.fd-wordmark` delivers the caps look the prototype draws. **Same pixels, verifiable text.** Both halves are now pinned — the title-case markup *and* the CSS that makes it look right, because removing the transform invites "fixing" it back to literal caps, which is the rejection again.

### ⚠ Two things left the product with the page — verified against the LIVE site, not inferred

| Gone | Evidence |
|---|---|
| Hero headline *"Keep your memories." / "Plan your moments."* | 0 hits on `www.setnayan.com` |
| The **"Start planning · free" CTA → `/onboarding/wedding`** | **no `/onboarding` href anywhere on the page** |

**The missing CTA reads as deliberate, not broken:** the front door gates planning behind sign-in and says so in the rail — *"Sign in to save suppliers, plan your event, and keep your photos"* — the same ruling that made the Marketplace signed-in only. It is still a real change to the top of the funnel, so the e2e now asserts the new shape rather than merely dropping the old assertion: if a "Start planning" CTA ever returns, somebody decided that.

### Guards moved rather than deleted

- **`home-brand-name.test.ts`** → re-pointed at `front-door-shell.tsx`. Its own failure message had always said *"if the nav moved, move this guard with it."*
- **`home-front-copy.test.ts`** → shrank to the one rule that was never about that page: **§ 5 keeps faith-specific rites off the top of the funnel.** The funnel still has a top; it just has a different page at it.
- **`front-door-invariants.test.ts` § 9** → **inverted, not removed.** It used to assert both doors existed and the flag chose. It now asserts one door, no flag, no fallback, and that `HomeReskin` cannot return. A guard whose subject retires is where the *next* state gets pinned — deleting it would leave `/` with nothing asserting which page it renders.
- **`doorway-invariants.test.ts`** → the exclusion of `/` is unchanged and still correct (`/` is the front door, not a tool doorway), but its stated **reason** — *"it is the ELN cinematic reskin"* — was retired with the page. A retired reason left in place is how a guard ends up arguing for a decision nobody holds.
- **`public-price-literals.ts`** → 7 declared mock peso figures pointed at the deleted pillars screenshot. Removed as the guard's own message instructs. None were SKU-backed, so nothing the daily SEO audit verifies against live prod changed.

### Kept deliberately

- **`home-reskin.css` is NOT deleted.** Despite the name it is the shared **marketing** stylesheet — `site-chrome.tsx`, `site-footer-chrome.tsx`, `sign-in-here-panel.tsx` and the login card each import it. Only this page's import goes; the front door uses none of its `.hr-*` classes (verified: zero occurrences).
- **`HomeOverlays.tsx`** stays — `cam-join-flow.tsx` imports `OverlayShell` from it, outside the homepage entirely.
- **All three cron-free `after()` jobs and `revalidate`** survive untouched, enforced by `home-carries-the-cron-free-jobs.test.ts`.

**Verified:** typecheck clean · **7,873** unit tests pass · all **16** `lint:*` guards pass · port-control baseline regenerated so the two removals on `/` (`HomeReskin`, `HomeSpotlightStrip`) appear as readable lines in the diff.

SPEC IMPACT: `RETIRED_ELN_HOMEPAGE_COPY_2026-08-13.md` added to the corpus (retired copy + one open owner decision). `DECISION_LOG.md` 2026-08-13 already carries the ruling.
