## 2026-11-25 · chore(final check): retire lane R pages R1–R9 (LAUNCH-GATE L6)

Final check, lane R (Add 17; ALL-FINDINGS § Lane R). Door check first; the page and its own files go; menu, nav and route-builder entries go; an old address people may hold forwards permanently.

- R1 `/dashboard/profile/concierge` (Setnayan AI settings) — page gone; both Profile rows gone. Its `actions.ts` stays: payment activation (`lib/sku-activation.ts` → `activateConcierge`) imports it.
- R2 `/dashboard/[eventId]/studio/setnayan-ai` (the stand-alone AI buy page) — forwards to the event's plans page (`routes.dashboard.eventServices`); the Home planner card, Home first screen, Suppliers banner and search overlay now open it; `routes…setnayanAi` removed. The value copy beside it stays (onboarding reads it).
- R3 `/dashboard/clusters` (+ `[clusterId]`) — gone (no door).
- R4 `/dashboard/[eventId]/guests/quick` — gone; its unused route builder removed.
- R5 `/dashboard/[eventId]/seating/lab` — the ADDRESS forwards to Guests › Seats › 3D; the room component it held moved to `seating/lab/_components/seating-room.tsx` (the Seats page mounts it); the mood board's "Edit in Seat Plan" opens Seats › 3D.
- R6 `/studio/papic/challenges` and `/run-of-show` — gone; the never-drawn summary and full-screen branches of `CoupleChallengesManager` went with them; the Papic actions return to the card's seat.
- R7 `/admin/concierge-abuse` — gone with its Work view, admin menu, tabs, work row, nav default and route builder; the user record keeps its "AI abuse flags" list without the queue link.
- R8 `/dashboard/api-keys` and the `/api/v1` reference page — forward to the dashboard; Profile rows and the route builder gone. The `/api/v1/*` endpoints are untouched.
- R9 `/papic/lightcheck` — gone.
- Schema (owner ruling: drop) — migration `20271363906595_drop_retired_clusters_and_concierge_abuse_flags.sql` drops `event_cluster_members`, `event_clusters`, `concierge_abuse_flags` and the cluster-only functions (`cluster_guest_roster`, `cluster_timeline`, `resolve_cluster_guest_person`, `backfill_cluster_guest_matches` + its trigger); `set_guest_person` is re-created without the cluster name match (a name-only guest still gets no person); `lib/clusters.ts`, the "years you grouped" export section and the user record's "AI abuse flags" list (it replaces the R7 note above) go with them.

Test: `lib/retired-pages-are-gone.test.ts` (each route gone or forwarding; no menu/nav/builder names a retired address). Tests that read a deleted file drop only that file's entry; two count floors move by exactly the deleted item (admin drawing 114 → 113, pill selectors 22 → 21).

SPEC IMPACT: None — the owner retired these (Add 17/19, LAUNCH-GATE L6).
