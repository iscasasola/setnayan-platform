## 2026-11-24 · fix(venue): the guest's 3D walk names your table, not its code

The caption at the bottom of the guest's 3D walk (`/[slug]/venue`) read "You're at S89TBL-LAB0000006". `public_venue_scene` sends every table by its public id and no table names. The walk printed `you.table` as if it were the name.

The page and the live-refresh route (`/api/venue-scene/[slug]`) now join the guest's own table name through one helper, `withYourTableName` in `lib/venue-your-table.ts`. A joined set of tables answers to its group name, as everywhere else. The caption reads it through `youAreAtWords`: the name, or "your table" if the read fails, never the code. Only the token holder's own table is named, and only after the RPC has checked their token. No other table is named.

No migration and no new server action. The page runs the read beside its room-links read, so it adds no round trip. New guard: `lib/the-3d-walk-names-your-table.test.ts`.

SPEC IMPACT: None — a display fix; the scene payload and its privacy rules are unchanged.
