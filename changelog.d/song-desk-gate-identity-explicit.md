## 2026-08-01 · refactor(song-desk): the gate takes an identity instead of reading the session — and a probe that isolates the narrowing

The song-desk gate asked *"who is logged in right now?"* via `supabase.auth.getUser()`. Correct for a page render, and impossible for anything else — a background health check has nobody logged in, so it could not call the gate at all. The interconnection probes were reduced to re-deriving the vocabulary comparison **beside** the gate, which is the drift-prone shape the whole subsystem exists to avoid.

**The split.** `resolveSongDeskAccess(client, vendorProfileId, services, eventId, bookedEventIds)` now holds the decision; `requireSongDeskAct(eventId)` stays exactly where it was and became the session wrapper that resolves the identity and calls it. `fetchBookedTiles` moved with it. The page and the probe are now on the **same** function, so a change to the rule cannot reach one without the other.

**Why a `lib/` module and not an export from `actions.ts`.** That file carries `'use server'`, and every export from such a file becomes a callable server action — exporting a function that takes `vendorProfileId` as a parameter would publish an endpoint letting any client evaluate the gate as any vendor they choose. The decision belongs where it is an ordinary import.

⚠ The identity is an argument now, so callers must earn it. Nothing inside proves the caller may ask about this vendor; that is the wrapper's job (`auth.getUser()` → `fetchOwnVendorProfile`) or the probe's (service-role, no user in the loop). A future caller taking a `vendorProfileId` from a request body without an ownership check would be a privilege escalation this function cannot see. Noted in the header.

**Probe 3 — `song-desk-narrowing`.** Calls the real gate **twice** per booked vendor: once with the event-tile narrowing, once on entitlement alone. A vendor who passes without narrowing and fails with it is not being paywalled — they hold the specialization and the tile intersection took it away. That is precisely and only the defect that made every specialization desk unreachable, and it is invisible to any check that merely asks "did the gate say yes".

The obvious probe was written first and thrown away: *"gate passed, so can they see the rows?"* **cannot fail** — the inbox reads as service_role once the gate passes, so agreement is guaranteed by construction and it would report health forever. A check structurally incapable of failing is worse than none; it occupies the slot a real one would fill. Refusal on *both* calls is skipped rather than flagged, because an honest paywall that trips a health alarm gets the alarm muted within a week.

⚠ **What it does not prove:** the gate's logic runs under service_role, not the vendor's own database session, so an RLS mistake could deny the real vendor while this reads clean. The 64 DB tests cover that layer; what broke the song desk lived here, in the TypeScript decision above RLS. Minting a real login session for a real vendor on a schedule would close the gap and is deliberately **not** done — standing credentials for real accounts are a worse risk than the one they would retire.

SPEC IMPACT: None — behaviour at the page is byte-identical; the gate is the same rule with the identity moved from ambient to explicit.
