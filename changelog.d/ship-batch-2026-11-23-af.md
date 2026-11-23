## 2026-11-23 · ship(AF): #8191, the supplier storage meter counts everything a shop owns

- **#8191:** Photos & video · Files · Records, measured by a claimed nightly job with no pg_cron.
  - The chat & documents room is dropped (owner, specs 9abac928): one storage number, and chat and documents are never refused.
  - Migration `20271360925434_supplier_storage_meter_counts_everything.sql`, blob `4d27a2106d1718da06d673e42541966329180c4a` (controller GO).
- Ship regenerated the screens map, admin jobs and port baseline once.

SPEC IMPACT: None from Ship (the ruling is in DECISION_LOG via specs 9abac928).

- **#8218:** dev-only lab states for filming the front-page loops. Names are invented, and the faces are AI-made inline pictures, nothing fetched. Only `app/dev/` changes.
