# Retire the cinematic homepage

## 2026-08-13 · chore(home): `/` renders one page — the June cinematic homepage is gone

**SPEC IMPACT:** `DECISION_LOG.md` row 2026-08-13. Closes the owner ruling
*"Retire it completely"* (2026-08-13), which had shipped only half: the front
door went live, but the page it replaced stayed in the tree behind a flag.

The ordering was deliberate — deleting an approved page before its replacement
has been looked at on a real screen is the one irreversible step — and the
condition is now met. The owner has seen the front door live and said delete.

**Gone:** `HomeReskin` · `HomeSpotlightStrip` · `pillars` · the
`NEXT_PUBLIC_NEW_FRONT_DOOR` flag and its module · the four data reads that fed
only the retired page (catalog pricing, admin background videos, the homepage
spotlight, the published-showcase rail) · `home-front-copy.test.ts`.

**Kept, deliberately:** `home-reskin.css` and `HomeOverlays` — both are still
the marketing chrome's, mounted by `SiteChrome` on ~40 routes; `ReskinFooter`,
mounted by `SiteFooterChrome`; `getHomePricingData`, which still serves
`/api/home-pricing` for the Prices popup.

🚨 **AND ALL THREE CRON-FREE `after()` JOBS** — the admin morning digest, the
daily email jobs and the interconnection probes. **They have no scheduler
behind them**; they ride this page's guaranteed public traffic. Dropping one
while rewriting the page would have silently stopped the anniversary digests,
the renewal reminders and the Papic drop warning, and nothing would have
reported it. Mutation-tested: removing one turns
`home-carries-the-cron-free-jobs.test.ts` red.

---

### 🚨 THE FIND: the live homepage had re-broken Google's OAuth brand check, and the guard built to catch it was green

Google refused Setnayan's OAuth brand verification on **2026-07-25**, and one
of the two stated reasons was that the **ALL-CAPS wordmark did not read as a
match** for the consent-screen app name. The fix rendered
`<span class="hr-wordmark">Setnayan</span>` — title case, no transform — and
`app/home-brand-name.test.ts` was written to hold it, with the message *"It
must be TEXT — an image or an aria-label does not satisfy the check."*

**Then the front door replaced that page and rendered `SETNAYAN` in caps.**
Measured on the live site: `class="fd-wordmark" href="/">SETNAYAN`. The only
title-case "Setnayan" a visitor could see was a copyright line in the rail's
small print.

🔑 **The guard never noticed, because it was still reading `HomeReskin.tsx` —
the file that had stopped rendering.** It kept passing, on dead code, about a
requirement the live page was failing. That is this project's most expensive
recurring failure, and this is the clearest instance of it yet: **a guard that
outlives the page it guards does not protect anything; it reports that
something which no longer runs is still correct.**

**Fixed with no visual change at all.** The markup now says `Setnayan` and
`.fd-wordmark` carries `text-transform: uppercase`, so the page looks exactly
like the approved prototype while the STRING — in the HTML, in the accessible
name, in what a reviewer or crawler reads — matches the consent screen
character for character. The guard is repointed at the live shell and gained a
second assertion: **the capitals must come from CSS**, because the obvious
"fix" for a title-case wordmark is to type the caps back into the markup, which
silently restores the rejected variant.

Both halves mutation-tested: caps in the markup → red; CSS rule deleted → red.

---

### The other guards, moved rather than deleted

- **`front-door-invariants` §9 is INVERTED, not removed.** It used to assert
  the flag was read, both branches existed, and `<HomeReskin>` stayed mounted.
  It now asserts the opposite — the front door renders unconditionally, the
  retired page is not mounted, and the flag is gone — so a half-done
  retirement (a stray flag read, a conditional creeping back) still fails.
- **`homepage.spec.ts` rewritten.** Every assertion in it targeted the
  cinematic gate's four elements, all of which no longer exist. It now pins
  what a visitor must be able to do on the front page: the page answers, the
  rail is there, **search works signed out** (the one thing this page exists to
  solve), and Sign in opens over the page without navigating.
- **`public-price-literals`** dropped eight allowances that named the deleted
  `pillars.tsx`. A file-scoped exemption for a file that does not exist is
  dead weight in a list whose whole value is that every line is a decision.

🪤 **`lint-port-no-lost-controls` fired, and this time it was RIGHT** — `/`
genuinely stopped offering two things. Baseline regenerated, which is exactly
its documented escape hatch, and the removal reads as two lines in the diff.
⚠ Regenerating also exposed noise **I introduced last PR**: the widened action
matcher had been recording every identifier inside `action={…}`, so `null`,
`p`, `id` and `bind` were about to be written into the baseline as controls.
Tightened to the two real shapes (a bare identifier, and a ternary's two
branches). A guard whose baseline is full of noise is one people learn to skim.

---

### ⏭ NAMED FOR THE OWNER, NOT DECIDED

**The owner-approved front-page copy is now nowhere in the product.** The hero
sub-line, the manifesto (the *samahan* paragraph) and the Ala ala dock copy —
approved 2026-07-31, `03_Strategy/Claude_Design_Brief_2026-07-31.md` §5 — lived
inside `HomeReskin` and went with it.

**They were already invisible**: the front door has been live for some time and
carries none of them, so nothing a visitor sees changes today. The words are
safe in the brief and in git history. But the front door is a grid of cards
with a screen-reader-only heading — **it says nothing about what Setnayan is**,
and that positioning statement was approved and paid for.

Putting it back means deciding where it goes on a page whose design is
otherwise binding, which is not an engineering call.
