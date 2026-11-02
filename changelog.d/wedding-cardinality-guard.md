## 2026-07-12 · feat(create-event): wedding cardinality — one wedding at a time (hard block)

Owner-locked 2026-07-12 (HARD BLOCK: "you cannot have 2 weddings at the same time"). A user may co-host at most ONE non-archived wedding; tapping "Wedding" again while one is active is blocked — no second wedding event is created. Finishing/archiving the active wedding frees the slot (remarriage).

- **`wedding-guard.ts`** — `hasActiveWeddingForUser(supabase, userId)`: shared single source of truth (does the user co-host a non-archived wedding?), used by both the page and the action.
- **Server action** (`createWeddingEvent`) — the authoritative gate: if `isWedding` and the user already has an active wedding, redirect to `?error=wedding_exists` before any insert. The UI can be bypassed; this cannot.
- **Picker** — when Wedding is selected and one is already active, renders a clear "One wedding at a time" block (with *Go to my wedding* / *Pick a different type*) instead of the create form, so no one fills the form only to be rejected. Responsive (`max-w-lg`, `sm:` stacking).
- **Error copy** — `wedding_exists` message added to the create-event page.

⚠ Surfaced (flagged for a future exception path, NOT handled here): the strict block also stops the Muslim-rite concurrent unions (PD 1083, up to 4) and requires the civil-then-church SAME marriage to be modeled as one wedding with two ceremonies (never a second wedding event). Non-wedding types are unaffected.

SPEC IMPACT: applies the locked wedding-cardinality + pacing rules (Event_Anchor_Minimalist_Setup_Design_2026-07-12.md § 4b) as the owner-chosen hard block.
