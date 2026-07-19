## 2026-06-20 · feat(seed): Maria & Jose sample event — content (guests, seating, budget, mood board, Papic)

Populates the sample event's lived-in content (companion to the event+vendors seed). Authored + adversarially-verified via a parallel workflow (5 subsystems × author→verify), applied to prod via `supabase db query`, committed here as a re-runnable artifact.

- **`scripts/seed-sample-event-maria-jose-content.sql`** — 5 idempotent DO blocks (each clears its own event-scoped rows then re-inserts; event resolved by slug):
  - **Guests** — 42 realistic Filipino guests (30 attending / 3 declined / 3 maybe / 6 pending; sponsors, entourage, +1s, dietary notes).
  - **Seating** — 7 reception tables (1 sweetheart) + 28 seat assignments for attending guests.
  - **Budget** — 18 line items (₱810k) across all 12 categories, tied to the chosen vendors + payment rows + `events.estimated_budget_centavos`.
  - **Mood board** — finalized 6-colour `role_palette` + 7 `event_inspiration_assets` (garden/catholic/classic feel; `mood_feel_key=timeless`).
  - **Papic** — 8 placeholder gallery photos (`papic_photos`) + a placeholder paparazzi seat + sample tags.

The adversarial verify pass caught a real `events_mood_feel_check` CHECK violation (invalid `mood_feel_key`) and fixed it pre-apply. All event-scoped, naturally isolated to the `is_sample` event.

SPEC IMPACT: None (demo/sample data only).
