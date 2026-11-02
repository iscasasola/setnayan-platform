# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-04 · feat(account-home): person-shaped account home — Phase 0 of the person-spine model

Owner-locked "lock everything" (2026-07-04): the account model flips from *event* to *person* — the user page IS the Person, rendered. This ships **Phase 0** (safe / additive / no schema): the logged-in `/dashboard` home is rebuilt as a person-shaped, lifecycle-bucketed events home, and the login-landing rule is changed. Full plan: `03_Strategy/People_Graph_and_Lifelong_Identity_2026-07-04.md`.

- **`app/dashboard/(account)/page.tsx`** — the "My Events" picker is now the person-shaped Home:
  - Events bucket into **Ongoing · Upcoming · Completed** (date-only compare in Asia/Manila; null date = still-planning → Upcoming), each event a card with its real `EventMonogram`, an event-**type** chip (event-type-agnostic — a wedding is just one tile among birthdays/christenings/reunions; owner "this is not Bride or Groom. just person because it is events"), plus inline **Add event** and a **Memories Hub** link.
  - **Landing rule changed** (owner 2026-07-04, supersedes the 2026-05-20 universal auto-jump): a **single-event, non-console** user still jumps straight into their one event (the common couple case is unchanged); **2+ events, or any vendor/admin**, now lands on this hub. 0-event console users still route to create-event; 0-event couples see the empty state.
  - Preserves the OAuth-race graceful-degrade shielding on every query (events / profile / roles), and the archived-events + role-switch (Shop / Setnayan HQ) rows. Drops the old `Setnayan · dashboard` eyebrow kicker (site-wide no-eyebrow rule).
  - The AccountSidebar (the rail) and console switcher are unchanged — this rebuilds only the Home content. People/connections (Phase 2) and the Legacy-contact settings slot (Phase 3) are NOT built here.

SPEC IMPACT: None new — implements Phase 0 of the locked person-spine plan (strategy note §9/§12). The landing-rule change and the person-first/event-agnostic account framing are already recorded in `DECISION_LOG.md` (2026-07-04).
