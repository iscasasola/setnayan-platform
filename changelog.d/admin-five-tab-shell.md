## 2026-11-13 · feat(admin): the five-tab shell — Work · Money · People · Catalogue · Insights

Owner, 13 Nov: *"admin has been ok'ed"* — slice 1 of the approved admin (`Setnayan-specs/prototypes/admin_pub/`): the navigation shell only, no new features.

- **Bottom bar and desktop rail are the five tabs**, no More. Both draw from ONE source, `lib/admin/admin-tabs.ts`, which places every shipped `/admin` page under a tab › view (or a tab's ⚙, or the avatar) exactly as the drawing's Place map lists it. Which tab lights is query-aware and most-specific-wins (`/admin/studio?tab=referrals` is Money; `/admin/studio` is Catalogue).
- **No address moved.** Every shipped URL and server action works as before, so nothing needed a redirect; old hubs (`/admin/more`, `/admin/directory`, `/admin/queues`) still answer and light their tab.
- **T2 pinned row on every admin page**: `Page · View ▾` (the shared `PickMenu` in the shared `PinnedRow`, each view's count beside it) and the tab's ⚙ (the shared `MenuSettingsButton`, new menu `admin`) listing that tab's settings pages.
- **T6 thumb row on the phone**: a glass search naming what the tab looks through, opening the console's existing search panel (the same one as ⌘K), and one ＋ only where the tab creates something (People › Add a venue).
- **Admin-of-admin under the avatar**: Secrets & integrations · Email delivery · Switches · Business & compliance, as an "Admin" card in the account sheet. Team & permissions and the Admin log are declared with no address (their pages are being built in the Team slice) and draw nothing until they have one.
- **Honest states**: the Work badge shows "—" when a count could not be read (a new `text` on the shared nav badge); the pinned row says "3 waiting" / "Nothing waiting" / "Couldn't count — not the same as none", never a 0 over a failed read.
- **Retired with the old strip**: the Payment-requests FAB (Money › To confirm is that list) and the phone line "Prices, the website and settings are on the computer" — false since the owner's 2026-10-28 ruling "edit from the phone → YES".
- **New guard** `app/admin/admin-routes-all-have-a-tab.test.ts` walks every `page.tsx`/`route.ts` under `app/admin` and fails if one has no home; also fails on a door to a page that does not exist, a door that lands somewhere else, two equal claims on one address, or a count read from a queue nobody counts. Mutation-checked (a removed view, a dead door, `/admin` turned into a prefix): each red, restored green.
- Guards rewritten to the new rulings, not relaxed: `admin-rail-context.test.ts`, `the-menu-name-has-one-source.test.ts`, the phone-strip guard (now `the-phone-reaches-the-whole-console.test.ts`), `lib/every-back-goes-home.test.ts` + `lib/page-home.ts` bar roots.
- Dev lab `/dev/admin-shell-lab?at=<admin address>` draws the real shell on fixtures (404 in production).

SPEC IMPACT: None — implements the approved drawing (DECISION_LOG 2026-11-13 "ADMIN DRAWING APPROVED — BUILD IT"); no ruling changed.
