### Account switcher — events-first redesign (owner 2026-06-22)

Restructured `AccountSwitcher` + `AccountSwitcherStandalone` (`app/_components/account-switcher/account-switcher.tsx`) per owner direction "we do not need the user, since we already see the events on top … the account style at the bottom is for the vendor and Setnayan team … add event more accessible" + the follow-up "B" (one-panel) ruling.

- **Removed** the user header (avatar · display name · email) and the Gallery / Favorites / Editorials tabs — and the now-dead `renderTabContent`, `activeTab` state, `Tab` type, and `Image`/`Heart`/`Newspaper` imports.
- **Events lead the panel** with a prominent full-width "Add event" button (replaces the small dashed "Add" pill) — the core action is now the first, biggest target.
- **Console rail** (User / Shop / HQ) stays, conditional — shown only to vendors / Setnayan team, hidden for plain couples.
- **Profile · Settings · Sign out** moved to a slim footer at the very bottom (two-corner pattern: the switcher above is pure event/console switching; identity actions sit beneath it). Hosts still shows when there's a co-host context.

Verified: typecheck + lint clean; desktop left-drawer and mobile bottom-sheet both render events-first → slim footer with the user header and tabs gone.

SPEC IMPACT: None (UI chrome; iteration 0000 § event-switcher behavior unchanged — switching surface only reorganized).
