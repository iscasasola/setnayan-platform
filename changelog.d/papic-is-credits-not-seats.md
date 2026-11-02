## 2026-09-18 · fix(papic): a retired model cannot come back through the catalogue

Owner, 2026-09-18: *"papic only has papic credits that can be for unlimited
seats. they can also alot specific shots and the rest will be shared as needed."*

**The gap:** the only thing keeping the retired ₱2,999 crew-pack (`PAPIC_SEATS`,
`DECISION_LOG` 2026-06-26) and the four retired per-camera-per-day SKUs off sale
was `is_active` in `platform_retail_catalog_v2` — **an admin-editable boolean.**
One toggle in `/admin/pricing` and a retired product sells and grants again,
with no code review and no PR.

`lib/papic-retired-service-codes.ts` now holds those five codes with their dates
and reasons, and `papic-pass-tiers.ts` refuses them at **every** exit — the
normalise path *and* both fallback returns, which do not pass through normalise
and would otherwise have walked a retired model straight out.

⚠ **Entitlement is untouched.** A couple who bought a crew-pack in 2026 still
owns it; `entitlements.ts` reads historical order rows and is deliberately not
filtered. This governs what may be SOLD and GRANTED from here, never what was
already paid for.

Guarded by `lib/papic-is-credits-not-seats.test.ts`, which executes the decision:
the five retired codes refused · six live credit rungs still allowed (a denylist
that catches the product is worse than none) · a catalogue offering a retired
code has it dropped · and exact matching, so a future `PAPIC_SEATS_V2` is a new
decision rather than something silently swallowed. A floor asserts the list is
non-empty — an empty denylist refuses nothing while staying green.

SPEC IMPACT: None — records an existing owner decision in code.
