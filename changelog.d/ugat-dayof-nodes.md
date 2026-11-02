## 2026-08-01 · feat(ugat): Seat Plan + Run of Show — the WHERE and the WHEN, with the RLS blind spot recorded on the node

Fourth map-backlog cluster, built from a 33-agent sweep that already ran: discovery, a **per-family liveness check**, and every proposed claim adversarially attacked. Backlog **30 → 27**. Nodes **17 → 19**.

Two nodes, not four. `event_floor_*` alone is not a concept anyone names, and geometry does not split from placement — one file writes both, one RPC reads both, and auto-seat consumes the floor plan's ordering alongside the table and assignment rows.

### 🚨 The finding that belongs on the node, not in a changelog

**Guest reads do not go through RLS.** `event_tables` and `event_seat_assignments` grant `anon` nothing — five policies each, all `authenticated` — yet `/find-my-table`, `/seat` and `/hub` correctly show a guest their table. They read through anon-executable SECURITY DEFINER RPCs.

An RLS-only audit therefore concludes *"guests cannot see their seat"*, which is **false**, and misses that the real exposure surface is the function body. This is what triggered today's anon-RPC audit and the seven functions closed in #4000. It is now written on the Seat Plan node so the next person auditing this area starts from the right half of the system.

**Both publish gates live only in function bodies.** `event_floor_plan.published_at` and `event_walkthrough_zones.published_at` are checked inside the RPCs; no policy references either. A new reader that forgets the check **fails open** and serves an unpublished seat plan.

### The other three, all verified against live prod

- **J35 · the soft-delete seam.** `guests` is soft-deleted; `event_seat_assignments` has **no** `deleted_at` (both verified). The FK is CASCADE, so it never fires on a soft delete, and the only automatic seat-release trigger fires on `rsvp_status = 'declined'` — not on removal. A removed guest leaves an assignment the editor's list cannot account for while the chair-uniqueness index keeps that chair occupied. **Latent:** 4 soft-deleted guests, none seated.
- **J37 · deleting a block destroys the emcee's script.** `vendor_block_scripts.block_id` CASCADEs from a block and blocks have no soft-delete, while `event_floor_plan.cocktail_schedule_block_id` merely SET NULLs. **An audit scoped to the `event_schedule_%` prefix sees neither.**
- **`event_tables.link_group_id` is FK-shaped and is not an FK** — verified across *every* schema, not just `public`. Any "every `*_id` should reference something" linter will file a false bug.

### `seating_editor_locks` — recorded because it nearly got deleted

A grep for the table name finds only tests. It is fully live: all access runs through four SECURITY DEFINER RPCs, acquired on mount, refreshed every 30 seconds, asserted before every write. The liveness phase caught this — the exact inverse of the previous sweep's dead-table error.

### Method note

The two **absence** claims here (`no_column` on `deleted_at`, no-FK on `link_group_id`) were each proved with a schema-agnostic query. That is deliberate: two false alarms today came from proving absence inside a fence I drew — `where schema = 'public'`, and a grep excluding `*.test.*` — then reporting it as absence full stop.

Verified: **all six Ugat guards green on the first run**, every new claim holding against the replayed schema · **full DB suite 716/716** · 68 `lib/ugat` unit tests green.

SPEC IMPACT: None — mapping and recorded traps.
