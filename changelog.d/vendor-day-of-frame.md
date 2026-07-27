## 2026-07-27 · feat(vendors): day-of console frame — generic kit + a gated specialization slot, in Pahina materials

The vendor day-of console showed every vendor the same tools regardless of
trade. This builds the STRUCTURE the three per-category specializations
(`song_desk` · `stage_script` · `floor_command`) will plug into — the frame
only, not the specialist desks themselves.

**The gate is now resolved server-side.** The live console calls
`resolveVendorSpecializationAccessForVendor` (merged gate,
`lib/vendor-specialization-gate.server.ts`) on the vendor's live subscription
row and gates the specialization section on `access.unlockedSet`. The grantee
path resolves it through the admin client that already authorised the profile
read, so day-of crew of a paying vendor don't silently degrade to the generic
kit.

**The gate governs the NEW section and nothing else.** `resolveModules` still
produces the generic kit exactly as before; `buildDayOfFrame` passes that list
through untouched on every access path, including below-floor. Free-during-
launch is active and every production vendor is on a free tier — no vendor
loses a tool they had yesterday. Asserted against every
`VendorSpecializationReason`, including a same-reference check that proves no
filter runs over the list at all.

**Three honest states, never a broken tab.** Held + a surface registered →
the desk. Held + not built yet → a named placeholder saying it's included and
on the way. Eligible but below the tier floor (or lapsed) → a quiet upsell
plate under the tools, reading the floor from `SPECIALIZATION_MIN_TIER` so
moving the constant moves the copy. Unmapped category → generic only, no
section, no nav.

**Plugging in a specialization: one component, one registry line.** A later PR
writes its surface in its own new subdirectory and adds one line to
`_components/specialization-registry.tsx`. No edits to `page.tsx`,
`specialization-slot.tsx` or `lib/vendor-dayof-frame.ts`. The registry is a
presentation input only — membership cannot grant entitlement (pinned by test).

**Styling.** Restyled in the Pahina materials now live on the guest site, using
the `:root`-level palette tokens (`gild` · `veil` · `paper-deep` · `ink` ·
`paper`) and `font-pahina` directly — NOT the `.pahina-*` classes, which are
`.sn-editorial`-scoped and unreachable from a dashboard by design. Unscoping
them would leak guest-tree styling onto every dashboard, which is owner-locked
against; the recipes are recomposed in `_components/pahina-console.tsx`
instead. Both palette traps are handled there: gild never sits on terracotta
(same rgb on light surfaces), and gild is used only for rules, borders and
marks — never for type below ~0.85rem, where small copy is `text-ink/70`. The
obsidian focal stays dark: `FloorClock` has hardcoded light-on-dark colours and
a day-of clock should be the one glare-legible thing on a venue floor.

No schema change, no migration. No existing tool's behaviour changed.

New: `lib/vendor-dayof-frame.ts` (+ 18 unit tests),
`app/vendor-dashboard/on-the-day/_components/pahina-console.tsx`,
`live/[eventId]/_components/specialization-registry.tsx`,
`live/[eventId]/_components/specialization-slot.tsx`.

SPEC IMPACT: None. Implements the already-locked 2026-07-26 specialization
model (`lib/vendor-specialization-gate.ts`, `SPECIALIZATION_MIN_TIER = 'solo'`)
without changing pricing, tiers, entitlements or the SKU catalog.
