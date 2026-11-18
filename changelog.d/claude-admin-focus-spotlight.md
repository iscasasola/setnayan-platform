## 2026-11-18 · feat(admin): Focus at Spotlight level — exact IDs, payment references, answers, honest failures, Recent

Builds the owner-approved (18 Nov) P3 drawing "Focus, as powerful as Spotlight". The name stays "Focus".

- **A whole public ID** (`S89B-…`, `S89U-…`, `S89E-…`, `S89O-…`, `S89G-…`) reads the one table its letter belongs to and shows exactly that record under "Exact ID" — no pages beside it; Enter opens it. Before, only events matched an ID.
- **A GCash / BDO reference** (any spacing) finds its payment in `payments.reference_number`, with the order it is on and who logged it. Before, references were not searched at all.
- **A question gets a number**: "paid today" (payments confirmed since Manila midnight + the Work list's waiting count), "orders this week", "waiting to verify", "payments waiting". Counts come from the database (`getAdminQueueDigest` or one head-count); a count that cannot be read says "Couldn't count …", never 0.
- **Honest per-group failure**: every arm of `ugatSearch` used to turn an error into `[]`, so a refused read looked like "no matches". Each read now settles to rows-or-failed; the box shows "! Couldn't search Suppliers — Not "no matches". Tap to try again." and the Ugat console says it too.
- **Records under their own kind, above the pages**, each kind its own few (4); the single flat "Records" heading and the 8-row cap are gone. A top hit leads with its public ID; a supplier with papers waiting opens **its own Verify job** at the new per-shop address `/admin/verify?status=…&shop=<vendor_profile_id>`, else its shop page; prepared rows only open pages.
- **Recent** on Focus home: the last records and pages opened from Focus, kept in this browser (localStorage `sn.admin.focus.recents.v1`) — no table, no migration.
- Not built (drawing marks them as examples or future kinds): typo/Taglish "Also understood", phone lookup, and the new kinds service cards · receipts · applications · disputes · payouts · reviews · articles · subscriptions.
- No new server action, no migration.

SPEC IMPACT: None — implements the approved drawing; no locked decision changes.
