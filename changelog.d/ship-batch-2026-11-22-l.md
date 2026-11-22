## 2026-11-22 · ship(batch-l): #7993 · #7997 · #8112 · #8114, with the ship controller's fixes

Merged with merge commits off `origin/main` (after batch K and the Maya webhook fix went live). Fixes made in the batch:

- **#8114 supplier roles:** `seat-pause.server.ts` and `inquiry-routing.server.ts` abort on any failed read, so a failed read never pauses a seat or picks an Account Manager. The assign and cover writes check the rows they changed. `writeSplitCut` validates before it deletes and puts the old rows back if the insert fails. The inquiries page says when the counts could not be loaded.
- **#8112 Cake Maker:** only a Shop Manager (`canManageVendor`) reads or saves the Cake Maker options. Account Managers read cake designs on their own clients' threads (`cake_designs_member_read` gains the `current_vendor_ids('viewer')` + `agent_customer_event_ids()` clause, the same one the chat uses). Itemise is hidden when a quote carries cake extras, so no cake line is dropped. The panel reads the supplier tokens instead of 25 raw hex colours.
- **#7997 supplier navy:** the dark supplier page stays flat. `--sn-glow-soft` and `--sn-ambient-dark` are gone from the page; the glow stays on the band only (DARK_MODE_STANDARD).
- **Merge:** `guest-card-body.tsx` takes main's 20 Nov redesign block and keeps #7993's `bg-white` → `bg-raised` on the ticket image.

Migrations (controller GO pinned to blobs): `20271356599293_supplier_roles_one_client_one_account_manager.sql` (1425c065) · `20271356877338_cake_maker_shop_and_designs.sql` (fa21e8e0).

SPEC IMPACT: None. The rulings these PRs implement are already in the corpus (supplier roles 19 Nov, Cake Maker 21 Nov, dark-mode standard 20 Nov).
