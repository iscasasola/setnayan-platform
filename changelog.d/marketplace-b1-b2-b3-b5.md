## 2026-08-14 · design(marketplace): B1·B2·B3·B5 — the page says its own name, Plans gets a table that fits, and a committed date finally gets an answer

Slices B1 · B2 · B3 · B5 of `MARKETPLACE_FOUR_TABS_PLAN_2026-08-13.md`, on `/dashboard/[eventId]/vendors`. One PR because all four land in the same two files plus the panels they mount.

**SPEC IMPACT:** `MARKETPLACE_FOUR_TABS_PLAN_2026-08-13.md` §7 — slices 1, 2, 3 and 5 are built. Slice 0 (truth alignment) and slices 4 (BUD-8 resolver) / 6 (PR-H handshake) are untouched and still open. §3.4(a)'s ordering note needs the amendment recorded below.

### RULE 0 first — what already existed

| slice | what already shipped | what was actually missing |
|---|---|---|
| B1 | `PageMasthead` (8 sibling dashboard pages use it); `tabLabel()`/`tabBlurb()`; the `BB_TAB_EVENT` bus + `#svc-*` anchors + `goToBuildTab` | the page mounted **no `<h1>` at all**, and had no in-page section wayfinding |
| B2 | the warm-editorial recipe, as `.sn-tile` / `.sn-card` | this surface uses **none of those classes**, so the 2026-08-08 pass never reached it |
| B3 | `compareSlot`, anchors, bus — all resolving **by id** | Plans rendered inside the fixed 380px rail |
| B5 | `dateFitByVendorId`, already computed per vendor from the batched calendar read | nothing grouped it per plan column |

Nothing was redrawn. The masthead is the shipped component; the chips drive the shipped bus; B5 re-groups a map that already existed and issues **no new query**.

### B1 · The Marketplace had no `<h1>`

Measured at `origin/main` `78aadeb97`: the only `<h1>`s under `vendors/` belong to its **sub-routes** (review · workspace · categories · packages). The shell supplies the `<main>` landmark and no heading; the desktop tab strip was removed 2026-07-15 and the mobile dock under the replan flag. So on a phone — no sidebar, no browser tab in the installed PWA — **nothing on screen said which page this was.**

`<PageMasthead>` now carries the name, a back chevron (this product has no breadcrumb component; the masthead's own docblock says so) and a desktop-only lede.

**Four section chips** close seam S1. They are **not tabs and swap nothing** — each calls the shipped `goToBuildTab`, which dispatches the existing `BB_TAB_EVENT` that the takeover's own listener already consumes: scroll to `#svc-<tab>`, mirror `?tab=`, expand if collapsed. No new key, no new anchor, no new bus, no new state. Labels read `tabLabel()`, which is flag-gated, so chips and headings cannot drift.

Deliberately **not sticky**: the bottom nav and the team chip already dock on mobile, and a third pinned bar is the defect `lint-no-stacked-pinned-bars.mjs` exists to prevent.

### B2 · The skin swap reached every surface that used the shared classes — and this one used none

The 2026-08-08 warm-editorial pass shipped as **one edit** to `.sn-tile` / `.sn-card` / `.sn-glass`, on the measured argument that `.sn-tile` alone had 417 uses across 186 files. It therefore reached every surface that *uses* those classes and no surface that hand-rolls its own chrome.

Measured 2026-08-14: the event Overview carries **19** `.sn-tile`/`.sn-card` uses. The Marketplace's seven components carried **zero**. Two concrete drifts followed:

- `rounded-2xl` is **22px** (`--m-r-lg`, the glass radius); the approved card is **14px**.
- **`bg-white/60`** was still on the payments lens — the translucent fill design#6 stripped from the public doorways on 2026-08-13. Four occurrences across the directory, now zero.

Values are **derived** from `.sn-tile`, never re-typed. Padding stays explicit (`p-5`) because Tailwind utilities beat the class's own 18px, so nothing reflows — the shipped `sn-tile p-4 sm:p-5` convention.

🚨 **And one honest sentence.** The premium crest told **every** couple *"Your Marketplace is on the premium tier"*. `premium` is `aiActive`, and while the AI paywall is off `aiActive` is true for every event — so a line meant to mark a paid tier was telling all of them they had bought something. The features it names are genuinely on; what was false was *"premium tier"*. It now says they are on and free during launch — true in both worlds, and it does not need revisiting when the paywall flips.

The crest also moves off the amber `warn-*` ramp onto the warm-editorial card, keeping gold as an **icon accent only**: gold is 3.37:1 and is UI-only, so it may never sit behind text.

### B3 · A side-by-side table cannot live in a 380px column — THE OWNER LOOK

Plans is a matrix — one column per saved plan plus Current, each with a name, a total, an over/under and now a date verdict — and it was rendering in a fixed 380px rail (~330px usable, behind `overflow-x-auto`). At `lg+` it is now a third grid child spanning both columns, full width under the bench. The rail keeps Your team and Payments, still sticky.

Safe because **every key resolves by id, never by DOM position**: `#svc-compare`, `?tab=compare`, `BB_TAB_EVENT` and `?open=` all still find it.

🪤 **The near-miss worth recording:** the first cut used `lg:hidden` + `hidden lg:block`, which *reads* like a move and is not — those are `display`, so **both copies stay in the DOM**: duplicate `#svc-compare` ids and two mounts of the panel's client state. It is one mount placed by the grid. A test now forbids `lg:hidden` on this file.

⚖ **One consequence, deliberate and owner-visible.** Plans now comes **after** Payments at every width, where `Explore_Integration_BUILD_SPEC_2026-07-29.md` §3 put it between Your team and Payments. Moving it full-width already reorders it on desktop — that *is* the requested change — and leaving mobile alone would have required the two-mount bug above. So mobile follows desktop rather than the two disagreeing. §3's reasoning that Plans "sits next to the team it branches from" is what is being traded for a table that fits.

### B5 · A committed date had no answer

The existing availability footer answers *"which days could work"* and renders **only** for year/month-precision events. Both real production events are day-precision, so **that row has never once been reachable on real data** — dormant, not broken.

Once the date is committed the useful question changes: is everyone in *this* plan free on *that* day, and if not, **who**. That last part is the point — an affordable plan can still be impossible, and the couple needs to know which supplier to swap.

The derivation is a **pure core** (`lib/compare-anchored-date.ts`), matching the `bench-sort` / `your-team` / `plans-panel` convention, because a 2,100-line server component is where derivation goes to become untestable. Two rules, both load-bearing:

1. **Fail soft toward silence.** A vendor absent from the map has no calendar signal — off-platform, or a read that flaked. It is not counted as checked and can **never** be reported booked. This row names a real supplier to the couple hiring them; an absence must not become an accusation.
2. **One vendor is one calendar.** A supplier covering two categories is counted once and named once, or a plan reads *"Alba Studios, Alba Studios booked that day"*.

### Guards — every one proven able to fail

`lib/compare-anchored-date.test.ts` (7 behavioural) · `lib/marketplace-masthead-and-layout.test.ts` (14 wiring).

Ten sabotages, each with its **occurrence count printed before → after** so the mutation is proven to have landed:

| mutation | occurrences | result |
|---|---|---|
| delete the no-signal guard | 1→0 | 7 pass → **5 pass 2 fail** |
| delete the dedupe | 1→0 | → **6 pass 1 fail** |
| flip the booked comparison | 1→0 | → **1 pass 6 fail** |
| delete `<PageMasthead>` JSX | 2→0 | 14 pass → **13 pass 1 fail** |
| chips drop `goToBuildTab` | 2→1 | → **13 pass 1 fail** |
| hardcode a chip label | 2→1 | → **13 pass 1 fail** |
| drop `lg:col-span-2` | 1→0 | → **13 pass 1 fail** |
| reintroduce `lg:hidden` | 1→2 | → **12 pass 2 fail** |
| restore the "premium tier" claim | 3→4 | → **13 pass 1 fail** |
| glass fill back on the lens | 1→2 | → **13 pass 1 fail** |

Baseline green and restore green either side of every run.

🔑 The `3→4` and `1→2` counts are themselves the proof that the **comment-stripping works**: those pre-existing occurrences live in docblocks that describe the forbidden thing, and the guards correctly ignore them. A raw substring check would have read this PR's own documentation as the violation.

🔑 Assertions are **scoped to the function or container they are about**, never the file: `services-takeover.tsx` legitimately contains `lg:sticky` (the rail) and **two** `tab="compare"` mounts (replan and flag-OFF), so a whole-file grep would answer the wrong question — the trap that made three earlier guards decorative.

### Flag discipline

B1, B3 and B5 ride `isExploreReplanEnabled()`; the flag-OFF branch is untouched, so the kill-switch remains a true revert. B2's re-skin is unconditional **on purpose** — it is a token correction from the design programme, not part of the replan wave, and gating a colour behind a feature flag would leave the revert path carrying a retired glass fill. `flag-chokepoint-scan.test.ts` still passes: this file continues to call the helper.

### Verification

- typecheck exit **0**, 0 errors · all **22** `lint-*.mjs` rc=0 · full unit suite green
- `flag-chokepoint-scan` · `team-summary-chip` · `bench-deep-link-anchor` — **29/29** pass
- ⚠ **Not verified on the live site.** This surface sits behind a couple login on a specific event; confirming it renders would mean authenticating as a test account, which this session does not do. It is covered by tests and by CI's build, **not** by a live observation — do not upgrade that claim.
- `pnpm build` cannot run on this machine (~7 GB heap). CI is the only valid build claim.
