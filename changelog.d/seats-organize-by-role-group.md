## 2026-11-02 · fix(seats): one table order, no stacked tables, a pair sits side by side (seating slice A)

Owner, live on his own event (2026-11-01): *"not organizing the seats properly."* Measured read-only: Tables 1–3 all at
sort_order 0 and the rest out of label order; Tables 17 and 18 stored on one spot (100, 100); 13 and 14 on the bottom edge.
- **One order** (`lib/table-order.ts › compareTables`): the label read naturally ("Table 2" < "Table 10"), then sort_order,
  then when made. `fetchTables` hands it to every seats reader (List, 2D, 3D, auto arrange, prints, chart, exports).
- **No stacked tables** (`spreadForDisplay`): the 2D plan and the 3D room draw tables that share a spot fanned out, and an
  edge table just inside. Display only — nothing is written until the host moves one.
- **A new table takes the next sort_order** (`createTable`), so new ties can't happen.
- **Beside each other**: auto arrange gives a guest and their +1s a run of consecutive chairs (`consecutiveRun`), not the
  scattered lowest-free chairs a half-full table handed out.
Guard: `lib/tables-keep-one-order-and-never-stack.test.ts`. Lab: `/dev/guests-lab?part=screen&gview=seats&seat=list|map&cale=before|after`.
No production data touched.

SPEC IMPACT: None.
