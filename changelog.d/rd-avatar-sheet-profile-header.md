## 2026-10-22 · feat(account): the avatar sheet is Direction 2 — a profile cover, one Switch-to card with a row per shop, four quick tiles

Owner, 22 Oct: *"Maybe we can make it more uniform to the content on that menu."* … *"Like in facebook how i can switch to different email addresses"* — then, on the three drawn directions, *"Direction 2"*.

- `SwitcherPanelBody` redrawn as `prototypes/avatar_sheet_uniform_2026-10-22.html` · d2: gold-wash cover (photo · name · email · Profile & settings ›), ONE "Switch to" card (Your events · each shop with a SHOP tag and a "View page ↗" row · Setnayan HQ with an ADMIN tag · Create your shop), the supplier rows in the same anatomy in the vendor layout, four quick tiles, and a quiet "Sign out of all accounts".
- One row per shop (`SwitcherContext.shops`, from `reachableShops`) — the rail drew `vendorProfiles[0]` only.
- Shop-id switch for a helper in two shops: `POST /vendor-dashboard/switch-shop` checks the id against the login's own shops and writes httpOnly `sn_shop`; `fetchOwnVendorProfile`'s helper path opens it. The owner path never reads it. Sign-out clears it.
- "• N new" per row = the bell's unread set split by place, read when the sheet opens; a failed or partial read draws nothing.
- Lab: `/dev/avatar-sheet-lab?who=owner|supplier|helper|couple&app=1&dark=1&nocount=1`.
- Guard: `app/_components/account-switcher/the-sheet-lists-every-place.test.ts`.

SPEC IMPACT: `DECISION_LOG.md` row 2026-10-22 "THE AVATAR SHEET IS DIRECTION 2" (corpus 6555c1f8) — the ruling and the build split. No iteration doc changes.
