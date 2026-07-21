## 2026-07-21 · feat(plan3d): the booth poster renders on the guest walk, and vendor booth surfaces freeze at T-24h

Completes the poster feature: storage and upload shipped previously, this makes it visible and settles when it stops changing.

**`public_venue_scene` v10** adds `posterUrl` to the booth vendor block. Joined on `(event_id, vendor_profile_id)` — **not** on the `event_vendors` row — because there is one artwork per vendor per event: a vendor booked for two services shows the same poster on their booth. That is the cardinality `event_vendor_booth_posters`' UNIQUE constraint already states. `poster_ref` rides raw, exactly like `vp.logo_url` beside it, and the reader resolves it. Identical to v9 apart from the added key and one LEFT JOIN (verified by diffing the function bodies).

**Both read paths resolve it in ONE batch with the logo** — `/[slug]/venue/page.tsx` and `/api/venue-scene` each already batch-resolved logo refs through `displayUrlForStoredAsset`; a booth commonly carries both, so they are collected together rather than in two round-trips.

**`BoothPoster` is deliberately a separate object from `BoothSign`.** The sign is the account-level logo on the backdrop board; the poster is bespoke artwork for one wedding. They render side by side exactly as they would in a real room — a 2:3 portrait panel on a slim stand, reading like the pull-up banner PH vendors already bring to a booth, positioned clear of the footprint and rotated with the booth's computed facing.

Same texture path as `BoothSign` (manual `TextureLoader`, `crossOrigin` for the cross-origin R2 display URL, silent drop on failure) and the **same `boothCanBrand` gate** — branding is the Pro/Enterprise perk, so one gate governs both. The two are otherwise independent: a vendor may have artwork without a logo, or a logo without artwork, and each renders on its own.

Upload enforces 2:3, but the plane still **fits to the texture's real aspect inside a fixed frame** — a legacy or hand-inserted ref then letterboxes rather than stretching, and every booth's banner stays the same physical size regardless of what was uploaded.

**T-24h freeze on `vendor_set_booth_poster`.** This answers the owner's *"finalization … until the hour/day before the event?"*, resolved as: **vendor** surfaces freeze at T-24h; the **couple's** room structure soft-freezes with seat moves still allowed; and the **guest's** own avatar never freezes — a guest's most likely moment to set it is at the reception itself, scanning the QR with the room in front of them, so locking it would kill the feature's best hour to prevent a problem that does not exist (3D renders client-side; a late change costs nothing).

Only the vendor half is enforceable in this RPC, and it earns its keep twice: it stops a poster being swapped mid-reception while guests are already walking the room, **and it IS the couple's review window** — what appears in their wedding is settled a day ahead, which is why the design needs no approval queue on top of the QR-in-media guard. Compared in Asia/Manila civil time (matching the schedule-pools convention); a dateless event never freezes; mapped to friendly copy in the server action.

**Deferred, deliberately:** couple-lab parity. `lib/seating.ts` builds booth vendors from a different (snake_case, embed-based) row shape and the poster lives in its own table, so wiring it there needs a second query rather than an embed — mechanical, but it does not belong inside a render PR. Until then the poster shows on the guest walk (the surface the vendor is paying for) but not in the couple's own lab.

SPEC IMPACT: `Booth_and_Avatar_Build_Plan_2026-07-21.md` §A4 — render + freeze shipped; couple-lab parity added as a follow-up there.
