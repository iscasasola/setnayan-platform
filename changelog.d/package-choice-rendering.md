## 2026-07-26 · feat(packages): couple-side CHOICE lines render and price (flag-dark)

Closes the §6.1 gap: a vendor could author a choice line ("chicken / beef /
salmon") but `lock-modal.tsx` never SELECTed `vendor_package_item_options`, so
the couple saw an inclusion with no way to pick. The first real package would
have shipped with an invisible line.

### What renders

A choice line now shows a radio group nested under its inclusion. The vendor's
standard option is preselected and reads **Included**; every other option shows
its own `+₱N`. Picking one adds that delta to the package total, with an
**Upgrades picked** row in the footer so the couple can see what the increase
is for.

### The flag, and why the OFF state is still correct

Gated on `packageCreditEnabled()` (`NEXT_PUBLIC_PACKAGE_CREDIT`, default OFF),
because the surcharge is only priced by the credit engine.

With the flag OFF a choice line still renders — as a plain line at its standard
option — and **that total is correct, not a degraded fallback**: the DB pins the
standard option's `price_delta_centavos` to 0 (`..._default_is_free` CHECK).
There is no flag state in which the modal quotes below what the vendor charges.

### Money rules (each has a named test)

- an upgrade on a **removed** line is not charged
- an upgrade on a line that was **never included** is not charged — nothing was
  billed for it to upgrade
- a **required** line still charges its upgrade: required means "cannot be
  dropped", not "cannot be upgraded"; they are separate axes
- a removal id for a required line does **not** suppress its upgrade, so a
  client cannot dodge the surcharge by sending a removal it isn't allowed to make
- an option id belonging to **another line** cannot be applied to this one
- a **retired** option is ignored and the standard applies instead
- a choice line with no available standard resolves to `undefined`, never to
  free — the DB enforces *at most* one default, never *at least* one

**Prices are never taken from the browser.** The client sends option IDs only;
`lockPackage` re-reads every `price_delta_centavos` from the DB, and persists a
**sanitised** `chosen_option_ids` so a bogus id can't survive in
`customizations_json` and read as truth to later consumers.

### Also fixed

`/v/[slug]` omitted `is_required` from its package-items SELECT, so on that page
every required line rendered as a normal unticking checkbox. The server refused
the removal, but the UI said otherwise. Now selected.

### No migration

`chosen_option_ids` rides inside the existing
`event_vendor_packages.customizations_json JSONB`.

**Tests:** 17 new, all named for the failure they prevent. Falsifiable — deleting
the removed-line guard turns 1 red; breaking option-to-line scoping turns 8 red.
Full suite green, `tsc --noEmit` exit=0, `next lint` exit=0.

SPEC IMPACT: `HANDOFF_Package_Wave_2026-07-26.md` § 6.1 — the couple-side half is
done. § 6.2 (credit wiring: `computePackageCredit` still has zero production
callers) is untouched and remains next; this ships the narrower
`chosenOptionsSurchargeCentavos` so choices price correctly without the whole
credit pool being wired.
