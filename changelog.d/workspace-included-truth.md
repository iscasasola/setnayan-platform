## 2026-07-27 · fix(workspace): "What's included" now lists only what the vendor is actually delivering

The per-service workspace (`app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx`) printed two things under **"What's included"** that were not included.

**Defect 1 — removed lines were still printed as included.** The page selected

```ts
.select('package_id, status, total_locked_centavos')
```

off `event_vendor_packages` and **never read `customizations_json`**, which is where `removed_item_ids` lives. Grepping the file for `customizations_json` or `removed_item` returned zero hits. A line the couple explicitly removed with the **Remove** button on `packages/[bookingId]` kept appearing on this page, with a tick, as part of what the vendor is delivering.

**Defect 2 — add-ons sat inside the included list.** A line with `is_default_included = false` is never inside `total_price_centavos` and is never charged, but it rendered in the *same* `<ul>` as bought lines, distinguished only by a dimmed `CheckCircle2` and an inline `" (optional add-on)"` suffix. The inline label mitigated; the heading still said "What's included".

### The ruling — removed lines are HIDDEN here, add-ons get their own labelled section

**The two pages answer different questions.** `packages/[bookingId]` is the **receipt** — *"what did we agree, and what changed?"* — so a removed line belongs there, and it already shows one under "Removed". This workspace page is the **service detail / day-of view** — *"what is this vendor actually delivering?"* — and a removed line is not being delivered. A struck-through line on an operational view is noise that misreads at a glance, exactly when a couple is scanning quickly.

**Hiding is not a claim, it is an omission — it cannot be false.** The defect was *asserting* that removed lines are included; omitting them ends the assertion. Verification of what was removed lives on the receipt, which is the record.

**⚠ Both pages use the SAME `receiptSections` helper**, so they can never disagree about which *bucket* a line falls into — only about which buckets they choose to *display*. That is a deliberate presentation difference, not drift. Stated explicitly here and in the module header because the difference will otherwise look like the bug this wave just spent the day fixing: the receipt renders `included · notIncluded · removed`, the workspace renders `included · addOns`, off one shared function.

**Add-ons DO show**, in their own clearly-labelled section, because on a service-detail view "what else this vendor offers on this package" is live, useful context — and the owner's design (`Design_Package_Credit_2026-07-26/couple_customize_and_requests.html`) models the couple side as Included · add-ons · requests. **An add-on is a live option; a removed line is a settled past decision.**

### What shipped

- **New pure module `workspace/package-sections.ts`.** `workspaceSections(pkg, removedItemIds)` calls the receipt's `receiptSections` and returns `{ included, addOns }`, dropping the `removed` bucket. `receipt-sections.ts` and its tests are untouched.
- **`parseRemovedItemIds(value: unknown)`.** `customizations_json` is `jsonb`, so its TypeScript type is a promise rather than a guarantee. Anything that is not literally an array of non-empty strings degrades to `[]` and never throws (a stringified payload is `JSON.parse`d once, inside a `try`).
- **A failed read now throws.** `if (bookingErr) throw new Error(bookingErr.message)`. "No row" and "the query errored" mean opposite things on this read: the first is a package that isn't booked, the second is removals we cannot see, and treating the second as "no removals" reproduces defect 1 exactly. This repo shipped a destructive bug from a swallowed select error on 2026-07-27 — same shape, one table over. The best-effort fallback for a genuinely *missing* row is unchanged.
- **Copy.** Heading **"Not included"** — the parallel of this page's own "What's included", in the same `font-display text-lg italic` heading style with a muted `Circle` in place of the terracotta `PackageIcon`. Body: *"Optional extras {vendor} offers on this package. They weren't part of what you booked, and nothing was charged for them."* Adapted from the receipt's "Not included in this booking" — it names the **status**, says nothing was charged, and carries **no CTA** (there is no purchase path for add-ons yet, so an invitation would promise something the product cannot deliver) and **no peso figure** (`replacement_value_centavos` is a replacement *value*; a number beside a line that was never billed reads as a charge). **No count in parentheses** — unlike the receipt, *no* heading on this page carries one.
- **The inline `" (optional add-on)"` suffix and the dimmed-icon branch are gone.** The section heading now carries that meaning. The follow-up filter (`parent_option_id == null`) is unchanged.

### `VENDOR_PACKAGE_ITEM_SELECT` — yes, this page had the same omission, and worse

The hand-typed list was `'service_description, is_default_included, parent_option_id, display_order'`. It omitted **`is_required`** — the same trap the receipt page hit, where `keptItems`'s "a required line survives a removal id" branch reads `undefined` → falsy, so a mandatory line carrying a stale removal id would have *vanished* from a day-of view while the vendor was still delivering and charging for it. It also omitted **`item_id`**, without which no removal id can match any line at all, so the removal filter could never have worked no matter how the JSON was read. The select is now the canonical `` `${VENDOR_PACKAGE_ITEM_SELECT}, parent_option_id` ``. The `vendor_packages` select likewise moved to the canonical `VENDOR_PACKAGE_SELECT`, so the object handed to `workspaceSections` genuinely *is* a `VendorPackageRow` rather than a three-column cast; both constants are already used on the lock path and `/v/[slug]`, so the columns demonstrably exist.

### Tests

`workspace/package-sections.test.ts` (new, 13 cases). Server component, so the RULE is tested, not the JSX — following `[bookingId]/receipt-sections.test.ts` and `app/[slug]/_lib/site-menu.test.ts`. A removed line is not in `included` **and** is not quietly relabelled as an add-on; an add-on is never in `included` and IS in `addOns`; a required line survives a removal id; a follow-up is in neither list; twelve malformed `customizations_json` shapes all yield `[]` without throwing, while partial garbage keeps the real ids. Three source pins cover the wiring a pure test cannot reach — the select asks for `customizations_json`, the parsed removals are passed through, and the read throws on `error`.

**Neutralised, twice.** Dropping `customizations_json` from the select → *"the workspace page READS customizations_json — the removals it must honour"* fails (4641/4642). Passing `[]` instead of `removedItemIds` → *"the workspace page passes the parsed removals into workspaceSections"* fails (4641/4642). Both restored; `git diff` confirms.

**Source pin updated, not weakened.** `lib/package-followup-not-priced.test.ts` → *"the vendor workspace add-on list excludes follow-ups"* asserted `/select\(\s*'[^']*parent_option_id/`, which cannot match a template literal. It now asserts `/\$\{VENDOR_PACKAGE_ITEM_SELECT\}, parent_option_id/` — the same guarantee **plus** the canonical constant, i.e. strictly stronger than what it replaced.

No pricing, no lock path, no `lib/vendor-packages.ts`, no `receipt-sections.ts`, no fee code touched. Display only.

SPEC IMPACT: None (display correctness on an existing surface; no pricing, schema or SKU change)
