## 2026-08-06 · feat(nav): the phone bar stops knowing less than the laptop

Owner: *"we also want the phone bottom nav to be as useful as much as possible
for both customer's event dashboard and vendor's dashboard."*

**RULE 0 first, and it changed the answer twice.**

1. The bottom nav is an owner-locked template with a lint guard — one component,
   every doorway passes only its own tabs. Nothing to rebuild.
2. It already has an **accordion mode** (owner-locked 2026-06-15: six menus, each
   opening its own children inline, no "More" overflow) with **zero callers**.
   Turning it on for the couple looked like the obvious win — until reading
   further showed the couple already reaches sub-surfaces through a docked
   section strip, so the accordion would have been a *third* mechanism for one
   job.
3. Adding sub-items to the VENDOR bar looked like the obvious win too. The
   vendor sidebar says the opposite in as many words: the 5-page IA is
   **owner-locked 2026-07-12** — every former sub-surface lives as a tab inside
   its hub — and *"Do NOT re-add children here; extend the hub tab strips
   instead."* **The build that felt right was the one an owner lock forbids.**

**So the real gap was not depth. It was that the phone knows less than the laptop.**

The bottom nav has rendered badges since it shipped — dot, count, tone palette,
sr-only label, in both its flat and accordion paths. **The admin bar uses it.
The couple's bar and the vendor's bar passed nothing** — while their desktop
sidebars, mounted in the same layouts and fed by counts those layouts had
*already fetched*, showed them. A vendor at a wedding saw five plain tabs; the
same vendor at a laptop saw *"3 new inquiries · 2 unread threads"*. The phone is
where they are.

**Shipped:**
- The couple's **Guests** tab now carries the live head-count its sidebar row
  has always shown.
- The vendor's **Customers** tab now carries pending inquiries + unread threads,
  the same sum the sidebar shows (both land there because the 5-page IA put the
  pipeline and the threads in that hub).
- No new queries. No new counts invented. No badge placed on a tab whose sidebar
  twin does not already carry one — deciding a tab deserves a *new* count is a
  product call and was not made here.

🔑 **ONE RULE, NOT TWO COPIES.** The badge is built by a shared helper both the
sidebar and the bar call. Re-deriving it beside the bar is how the payouts badge
and the list beneath it came to count different things — both valid, disagreeing
forever, in silence.

🔑 **ZERO AND "COULDN'T TELL" ARE THE SAME VALUE HERE.** Both layouts fail-soft
their count fetches to 0/null on any error, so a dot reading "0" would claim
*nothing is waiting* on precisely the request that failed. The helper returns no
badge at all rather than a zero.

🪤 **THE BADGE IS APPLIED AFTER THE ADMIN LABEL OVERLAY**, not before — that
overlay rebuilds each tab and carries only the fields it names, so an admin
relabelling "Customers" would have silently dropped its count. Guarded.

🪤 **A MUTATION TEST OF MINE HIT THE WRONG CALL SITE AND I NEARLY BELIEVED IT.**
`bookingsPending` appears four times in the vendor layout; my sabotage removed
the *sidebar's* copy, the guard stayed green, and I recorded it as decoration.
It was my sabotage that was wrong — but the guard was genuinely too loose (a
windowed regex swept in the sidebar's props), so it now slices the exact JSX
element. **Verify the sabotage landed before trusting either colour.**

⚠ **AND THE SOURCE-TEXT GUARDS COULD NOT CATCH THE REAL BUG.** The first cut
added both props to the vendor bar's TYPE and never destructured them. All ten
tests passed — the names were present, just not bound. `tsc` caught it. A test
that greps cannot tell a name appearing from a name being used.

**Verified:** 10/10 new tests, each mutation-checked against a correctly-targeted
sabotage · scoped `tsc` clean across both layouts and all four nav files ·
`next lint` clean · all 12 `lint-*.mjs` clean · full unit suite 6699 pass under
`Asia/Manila` (8 failures are pre-existing on untouched `origin/main` — image
decoding and vendor deep-search, unrelated).

SPEC IMPACT: `DECISION_LOG.md` — records that the vendor 5-page IA lock forbids
bar-level children, and that the accordion mode remains built-with-no-caller.
