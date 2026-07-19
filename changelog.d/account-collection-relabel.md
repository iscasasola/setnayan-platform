## 2026-06-24 · fix(account-nav): rename the cross-event hub "Account" → "Collection"

Resolves an IA collision in the account-level customer doorway. The cross-event
hub (Photos & Videos · Saved Vendors · Editorials, route `/dashboard/library`)
was labelled **"Account"** and sat directly beside the real identity surface
**"Profile & Settings"** — so the gallery + saved-vendor favourites were hidden
behind a word users associate with settings, and two adjacent items competed for
the same "account" meaning. Owner hit exactly this in review and chose
**"Collection"**.

- **Label `Account` → `Collection`** in all four surfaces: sidebar nav
  (`account-nav-config.ts`), admin nav-registry default
  (`customer.account.library` slot in `nav-registry-defaults.ts`), both
  account-switcher panels (`account-switcher.tsx`), and the page itself
  (`library/page.tsx` H1 + `metadata.title`).
- **Icon `CircleUser` → `LayoutGrid`** (curated allowlist) so a person-icon no
  longer reinforces the "account settings" misread; it now reads as a collection
  of things.
- **Route / slot-key unchanged** (`/dashboard/library`, `customer.account.library`)
  — internal ids stay put, the surface doesn't move; only the human-facing label
  + icon change.
- The account **doorway eyebrow** ("Account", parallel to "Planning"/"Vendor")
  is intentionally kept — it names the whole account area, and with the hub now
  "Collection" there's no longer a duplicate "Account" inside it.

**Supersedes** `changelog.d/account-hub-finalize.md`'s "Library → Account" rename
(same owner, reversed in review once the live collision was visible). Profile &
Settings access is unchanged (desktop sidebar item + the in-hub header pills).

SPEC IMPACT: None (account-area chrome label; iteration 0021/0025 — folds into the
North-Star account-doorway follow-up).
