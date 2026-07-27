## 2026-07-27 · feat(explore): PR-F — Compare reframed as "Plans" (flag-dark), with locked picks PINNED and a first-class Load

Slice F of the Explore Replan wave (`Explore_Replan_BUILD_SPEC_2026-07-27.md` §3 PR-F + §8). Everything user-visible is behind `isExploreReplanEnabled()` (`NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED`, default OFF) — with the flag off the surface renders exactly as it does in production today. **No schema change, no new dependency, no flag flipped.**

**The reframe in one sentence:** a plan is a named set of *candidates*; a locked vendor is a contract, so it is identical in every plan and no plan may vary it.

### The section is "Plans" — a LABEL change only

`TAB_META.compare.label` stays `'Compare'`; the new `tabLabel()` in `lib/budget-build.ts` is what every consumer reads, and it returns `'Plans'` only when the flag is on. The tab **key** is untouched, so `?tab=compare`, the `BB_TAB_EVENT` bus, the `#svc-compare` scroll anchor and the `customer.budget-subnav.compare` nav slot all keep working — no deep link breaks. Both label consumers were moved onto the helper so they can't drift: the layout-mounted mobile section sub-nav (via `lib/customer-menu.ts`) and the takeover's own `SectionStub`. The section heading follows ("Compare saved builds" → "Your plans").

### Locked picks are PINNED rows (§2 #10)

`lib/plans-panel.ts` (new, pure, unit-tested) splits the matrix:

- **Which categories are locked comes from the LIVE plan, never a snapshot.** A saved snapshot captured `locked` at save time; trusting it would pin a category the couple has since unlocked and miss one they have since locked. `lockedGroupIdsOf` reads the current plan only.
- Pinned rows render **once across the full column span** — "{vendor} · ₱{cost} — locked, the same in every plan" — instead of once per column. There is no per-column control on them, which is the point: they are not a thing a plan gets to disagree about.
- Candidate rows (everything else, union across all columns, deterministic order) render per-column exactly as before. The shipped availability footer and budget verdict rows are untouched.

### `applyBuildToWorking` **did** need a guard — and it is not the one you'd guess

Locks live in `event_vendors.status`, **not** in `event_build_picks`, so the wholesale `.delete()` at the top of `applyBuildToWorking` could never destroy a lock. The real hole was the other direction: loading a plan saved *before* a lock **inserted a stale candidate into the now-locked category**, so a pinned row sprouted a rival and the couple saw two vendors competing for a category they had already settled.

Closed on both sides:

- Caller: `planPicksToApply` drops every pick in a locked group (and every pick with no `vendorId` — pre-vendorId snapshots aren't loadable).
- Server backstop: `applyBuildToWorking` takes an optional `lockedPlanGroupIds` and excludes those groups from **both** the wipe and the insert, so a Load leaves each locked category byte-for-byte as it was. The clear is a read-then-targeted-`.in()` delete rather than a `NOT IN` filter — plan-group ids are free-form slugs, and an explicit id list can't mis-quote its way into deleting the wrong rows. The parameter is optional and defaults to today's behaviour, so no existing caller changes.

`isPlanLoadable` disables the Load control when a plan has nothing left to give (everything in it is locked already or gone from the shortlist) rather than firing a no-op write.

### Load, named save, and Clear candidates

- **Load** — each saved plan is now a named ROW with its own `Load` button (Compare's per-column "modify" promoted to a first-class control; the column button remains and relabels to "load" so the vocabulary is one). Confirm copy states the invariant plainly: *"Your locked vendors are untouched — they're in every plan."*
- **Named save** — the shipped `savePlanBuildNamed` + `planSaveAs` create/overwrite semantics, unchanged. The input now caps typing at `MAX_BUILD_TITLE_LEN` (60) rather than silently truncating on write.
- **Clear candidates** — `clearBuildPicks` had **no caller at all** (flagged in PR #3790); this restores its purpose. Confirm-first, and the copy says what survives: locked vendors (contracts) and anything mid-handshake, which are cancelled individually. Placed on the Plans surface; the "Your team" placement is PR-E's job.

### Owner rulings folded in (`Integration_Contract_Booking_x_Explore_2026-07-27.md` §7a)

Both landed mid-build and are honoured:

1. **A blank name never blocks a save.** There is no required-field validation, no error state, and the Save button is disabled only while a write is in flight. Blank → `normalizeBuildTitle` returns null → the shipped `autoBuildTitle` names it ("Build N"). That auto-name is shown as the input's **placeholder before saving** so it is never a surprise, and confirmed after ("no name given, so we called it *Build 3*"). A per-row **Rename** loads the plan back into the Save-As bar with itself pre-selected as the overwrite target — renaming is the shipped overwrite path, not new machinery. No new namer was written.
2. **Plan names get NO content gate.** They are not routed through the #3606 contact detector or any raw-content filter — a 27-agent adversarial review showed the chat rules misfire on honest non-chat text (a date range reads as a phone number; "Coverage @Tagaytay" as an @handle). Plan names are couple-private text: trim + the length cap is the whole of the validation, and `named-builds.test.ts` now pins that with the exact adversarial strings so a future filter can't be bolted on silently.

### Verification

`tsc --noEmit` clean · `next lint` — no warnings in any touched file · `pnpm run test:unit` **4269 passing** (up from 4266): 30 new/extended cases across `lib/plans-panel.test.ts` (pinned/candidate partition disjointness + determinism, the snapshot-`locked`-is-not-authoritative rule, load-merge semantics incl. multi-pick dedupe, non-mutation) and `lib/named-builds.test.ts` (the §7a blank-name round-trip for create *and* overwrite, the namer's totality, and the no-content-gate invariant).

### Handoff to the neighbouring slices

- **PR-E (Your team):** `clearBuildPicks` is wired and proven here — move the "Clear candidates" control into the Your-team rail and delete the copy on this surface. `lockedGroupIdsOf` is the shared way to ask "what's locked"; reuse it for the Locked/In-build/Buffer tiles rather than re-deriving from `raw_status`.
- **PR-G1 (shared-date window):** spec §8.4 rules the TEAM is the filtering basis. `partitionPlanRows` already gives the locked-vs-candidate split that window derives from, and Load now guarantees candidates never overlap a locked category — so the window can be computed as locked ∪ candidates with no de-dup pass.
- The `compare` tab key is permanent. Anything keying off the section must use the key, never the label.

SPEC IMPACT: None on pricing, SKUs or schema. Records two build-time landings worth a `DECISION_LOG.md` row: (a) the `applyBuildToWorking` locked-category guard — a plan may only vary unlocked categories, enforced caller-side *and* server-side; (b) the §7a blank-plan-name ruling as implemented (auto-name shown as placeholder, confirmed after save, one-tap rename) together with the explicit decision that plan names carry no content gate until the profile-based caller ships.
