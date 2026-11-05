## 2026-11-05 · fix(privacy): "Download my data" — the 39 undecided record types sorted, 23 new sections in the file

Owner, 5 Nov 2026, on item 7 of the 15 "act first" items (DECISION_LOG 2026-11-05): *"this is important"*.

`UNDECIDED_PERSON_KEYED_TABLES` in `lib/export-completeness.ts` listed 39 tables that hold a person's rows with no decision about the RA 10173 access file. Each is now sorted by the rule the codebase already states — the person gets their own personal data:

- **Exported (29).** 23 new reads in `lib/personal-data-export.ts`, each filtered on the subject's own id with a fixed projection: notifications, BIR receipts, the history of their own orders, account-deletion requests, chat read markers, comps, notify-me sign-ups (both tables), creator chapters, voucher eligibility, co-host roles, prep items and budget builds they made (author-scoped), stage notes they sent (author-scoped, privileged read like working notes), founder seat, saved suppliers, help messages, referral codes, slot reservations, face profile (metadata only, never vectors), date waitlists, retired token balances, supplier team memberships. Six more were already read but never recorded as decided (working notes, day requests, years, colour access, colour changes, supplier media).
- **Excluded with a reason (7):** `communities`, `live_studio_highlights`, `guest_qr_rotations`, `vendor_custom_plans`, `platform_expenses`, `promo_free_windows`, `social_posts` — the person key is a creator or staff stamp on a shared, event, shop or Setnayan record.
- **Left for the owner (3):** `fraud_enforcement_audit`, `user_devices`, `vendor_client_notes` — fraud signals or two people's data in one row. The file's `not_included` says so.

Left out on purpose and said in `not_included`: staff notes and staff ids, the order-history bookkeeping field and admin ids, the co-host invitation token, face vectors. An admin-prepared file also drops notification text (a notification can quote a chat message).

Also fixed: ten sections already in the file (samahan stories and messages, Papic free grant, unfollows, invite mutes, event-type asks, re-booking requests, photo suggestions, event-removal reasons, years) were never passed to `collectIncomplete`, so a failed read shipped `[]` under `export_complete: true`.

Guards: new `lib/personal-data-export-sections-are-counted.test.ts` (every section is counted; every "exported" table is really read) — both halves sabotage-checked. `tests/db/every-person-keyed-table-is-decided.db.test.ts` unchanged and re-proved: a new person-keyed table turns it red by name. `lib/export-coverage-guardrail.test.ts`: 19 gaps closed, `KNOWN_GAP_CEILING` 90 → 68; `event_stage_notes` moves from excluded to exported (author-scoped).

SPEC IMPACT: None to the corpus. The owner questions for the three undecided tables are in the PR's "Where I stopped".
