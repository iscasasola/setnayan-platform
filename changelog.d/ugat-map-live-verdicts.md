## 2026-07-31 · feat(ugat): the entity map goes live — joints coloured by their current probe verdict

Owner: *"yes colour all."* `/admin/ugat/map` has coloured its edges from the **frozen 2026-07-05 findings registry** since it shipped; the page's own header called live telemetry "slice 2". This is slice 2.

**What it does.** Every joint watched by an interconnection probe (#3965) now takes its colour from that probe's current verdict. `lying` → red, and it outranks everything on the edge, because it means `service_role` can see rows the surface's own reader cannot — data withheld from someone entitled to it, which renders in the product as a perfectly calm empty state. `denied` / `error` → amber. `ok` → **green**. A frozen audit finding still outranks a live green: the auditor found something the probes do not yet look for.

**The design decision that matters is what green is FOR.** Two probes exist against **83 joints**, so 81 have no verdict — and the failure mode of a health map is painting silence as health. So green is only ever *earned*: an unprobed edge keeps its ordinary unlit stroke and claims nothing, `latestVerdictByJoint()` returns joints **absent** rather than defaulted (including on a failed read, which degrades the map to its pre-telemetry look instead of to false health), and the legend now reads **"connection — not checked"** for the plain state. The scope note prints the ratio out loud: *"1 of 83 joints are watched by a live probe — every other edge is not checked, not healthy."*

`empty` deliberately contributes no colour. "Permitted, and there is genuinely nothing to show" is the normal state of a pre-launch database and says nothing about whether a joint works.

**Worst-wins per edge.** An edge can carry several joints; `liveClass` reduces them and red beats amber beats lit. An edge with one broken joint is not healthy on the strength of its others.

**Mapping.** `vendor-desk-reach` now declares `jointId: 'J7'` — *Event ↔ Vendor (booking)*, joint `event_vendors`, which is precisely the joint whose two vocabularies (`event_vendors.category` vs `vendor_profiles.services`) made every specialization desk unreachable. `song-requests-audience` stays unmapped on purpose: the song desk is one of the 47 `map-backlog` subsystems the map has never covered, and inventing a joint id for it would hide that.

Verified: `tsc --noEmit` clean · `next lint` clean (no findings in changed files) · 76 tests green across `lib/ugat/*` + `lib/interconnect/*`.

SPEC IMPACT: None — the map's own header comment updated in place to retire the "live telemetry is slice 2" note.
