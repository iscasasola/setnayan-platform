## 2026-08-17 · fix(admin): the five Studio surfaces stop printing "nothing here" over a read the database refused

Lane C of the S8 console-table conversion. Five files under `app/admin/studio/_surfaces/` now render through the existing `<ConsoleTable>` archetype (shipped in #4506): `discount-codes` · `patiktok` · `real-stories` · `referrals` · `storytellers`. Their six raw `<table>` blocks are gone; **`storytellers-surface.tsx` held two tables and both are converted**, so its bill line comes off.

Nothing here is a new design. `ConsoleTable`, `PageMasthead` and `KpiStatCard` all already existed; this wires five screens onto them and deletes what they were hand-rolling.

### What was actually broken — Supabase resolves with `{ error }`, it does not throw

`(data ?? [])` turns a REFUSED read into an empty array, and the page then prints a calm sentence saying there is nothing here. Measured per file, on `origin/main` = `f880f375f`:

- 🚨 **`patiktok-surface.tsx` never destructured `error` at all.** Both its reads bound only `data`. A refused query rendered *"No Patiktok render jobs yet."* to the one person whose entire job on that screen is spotting reels that failed — plus *"latest 0"* in the lede and a five-chip strip of honest-looking zeroes. **The lane doc classified this file as clean** because the scan looked for the literal `data ?? []` spelling; not destructuring an error and discarding one produce the identical screen, so a scan for `error` only finds the second kind.
- 🚨 **`referrals-surface.tsx` bound the errors on all three reads and dropped them.** *"No referrals yet."* over a refused read, three count tiles reading `0`, and *"₱0"* under a sentence asserting as fact that *"the referral engine is live but inert"* — a claim about configuration, printed from a read that returned nothing.
- 🔴 **And the referral MASTER SWITCH was the dangerous one.** `setReferralProgramEnabled`'s own comment reads *"An unchecked checkbox doesn't submit, so absence = off."* `defaultChecked` came from that same settings read, so a refused read drew an **unchecked** box beside the words *"Currently off"* — and an admin pressing Save to confirm what they saw would have **switched the whole referral program off from a state nobody had read.** The form is now withheld entirely when the setting cannot be read: a control whose current value is unknown must not offer to overwrite it.
- ⚖ **`discount-codes-surface.tsx` was honest** — it threw on the error, so a refusal hit the error boundary. It is also the least useful honest answer available (a thrown page names nothing), so the throw is replaced by `readError`, which prints the refusal and says plainly that nothing loaded. Its four stat tiles were the real defect: a **local `Stat` typed `value: number`** with no way to say "not measured".
- ⚖ **`real-stories` and `storytellers` were already honest** about error-vs-empty — their loaders return a discriminated result. **Neither reads the database in the file being edited**, so the remaining swallow was UPSTREAM and converting the table would not have fixed it. Fixed at the read instead (below).

### Three fixes upstream of the surfaces, because that is where the swallow was

- `lib/showcase-db.ts` · `lib/storytellers.ts` — the `{ ok: false }` branch now carries `message`. The old panels said *"Try again in a moment,"* which describes a network blip; a phantom column, a stale enum value, an unapplied migration or a missing grant is not a blip and never fixes itself, and that message is the only place it ever announces itself.
- 🚨 `lib/creator-analytics.ts` — **the influencer panel printed `"So far: 0 of 25"` unconditionally.** Every count in `InfluencerAnalytics` defaults to `0`, and the read the gate metric derives from bound no error, so a refused query produced a confident statement about platform activity. The type gains `measured: boolean`; a refused chapter read returns unmeasured and the panel says so instead of quoting a number. Its three `AdminStat` tiles — another local re-declaration typed `value: number` — are now `KpiStatCard`.

### No silent caps

Four caps were invisible; all four now pass the SAME constant to `cap`, so a full page discloses itself:

| surface | cap | where it was hiding |
|---|---|---|
| `referrals` | 500 | `.limit(500)`, nothing on screen |
| `patiktok` | 60 | `.limit(60)`, nothing on screen |
| `real-stories` | 100 | **in `lib/showcase-db.ts`** — a defaulted parameter, so `grep '.limit('` on the surface found nothing and the list read as every eligible wedding |
| `storytellers` | 100 | **in `lib/storytellers.ts`**, same shape |
| `storytellers` leaderboard | 10 | a bare `.slice(0, 10)` in the lib |

`discount-codes` genuinely has no cap — nothing to disclose.

### Colour: two golds, two rules — six measured AA failures

The Tailwind slot named `terracotta` holds the atelier **gold `#A9834B`** (3.37:1 on cream, non-text only); the CTA `#C24E25` lives in the slot named **`mulberry`** (4.61:1). Inherited and backwards, so `text-terracotta` looks safe and is the unsafe one.

- **The Feature button was `bg-terracotta text-cream` on both featuring surfaces** — a cream label on gold measures **3.37:1**, an AA failure on the primary control of the screen whose whole purpose is that button. Now `bg-mulberry`: **4.61:1 light / 6.29:1 dark** for cream-on-fill, measured in both themes because `mulberry-700` is 5.86 light and **3.05 dark** and a light-only check waves that through.
- Six link and button hovers turned their label gold on white at the same 3.37:1 → `hover:text-mulberry`.
- The Real Stories rank chips: `Cover` was gold-700 on a gold tint at **4.12:1**; `Most loved` was plain `mulberry` on a mulberry tint at **4.03:1**. Both under 4.5. `Cover` is now a filled CTA chip (4.61 / 6.29) and `Most loved` uses `mulberry-600` on the tint (**4.76 light / 6.33 dark**).
- The referral master switch's tick was gold — it scraped the 3:1 non-text floor and nothing more, on the one mark a person has to read correctly. Now the CTA colour.

🪤 **`lint-label-on-fill-contrast` passed on `bg-terracotta text-cream` before this change and passes after.** It checks 1366 pairings and did not judge these, so all six numbers above are hand-measured. Same seam as the `#9A8F86` failure in design#6: a defect can live between two correct guards.

### Deliberately NOT done

- **The two `StatusPill`s stay separate, and this is a judgement call, not an oversight.** A discount code's states (Active / Expired / Disabled, derived from `is_active` + `expires_at`) are not a render job's states (queued / rendering / completed / failed / cancelled, off a status enum). Different values, different meanings; the only overlap is that both are round. Sharing one would mean a pill taking a `variant` for every caller — the 22-local-`Stat` problem wearing a different hat.
- **The archetype is untouched.** No `actions` prop was added. Rows that genuinely settle on one click (Feature / Unfeature / set order / disable / enable a code) render their own form inside their own `cell`, exactly as the archetype's docblock prescribes.
- **Featured rows lose their 4% gold row tint.** `ConsoleTable` has no per-row class and must not grow one for this. The Featured column already renders a pill on exactly those rows and they sort to the top, so the signal survives twice.
- **`scripts/port-control-baseline.json` is NOT regenerated** — `lint-port-no-lost-controls` passes as-is (402 routes / 1322 controls / 3546 blocks, baseline ref `c3dc3848a`). Regenerating from a branch tip silently drops routes that landed meanwhile; that nearly shipped on #4506.
- **Only my own two lines came off `page-masthead-baseline.json`.** Three other files in it no longer hand-roll a masthead either, but they are not this lane's work and removing their lines would absorb someone else's win silently.

### Verification

- `admin-console-is-one-table.test.ts` — 10/10 pass. The bill was **re-derived by measuring** (26 files still hand-roll a table, down from 31), not hand-edited and hoped for; the guard asserts the bill EQUALS the measured set, so a wrong resolution fails loudly either way.
- The guard **caught one of my own regressions**: the gold checkbox tick in `referrals`. Fixed at the caller, not by widening the guard's icon exemption.
- Typecheck clean. Every CI lint above run from the working directory `ci.yml` gives it.
- ⚠ **Nothing here is observable from a session.** Admin sits behind a login, so this is test-proved and hand-measured, never seen. Do not upgrade it to "verified live".

### The guard had a hole and it was found by sabotage, not by reading

🚨 **Deleting one line from `CONVERTED` left the guard GREEN — 10/10.** Every rule that does the work iterates that list, so a shorter list simply checks fewer files: any surface's read-error handling, cap disclosure and gold-as-text could have been switched off one line at a time with CI silent. The bill above it can only shrink; this list could shrink too, and it is the half carrying the assertions.

🔑 **A guard whose subject list is hand-maintained is only as wide as that list** — the same shape as the hand-enumerated door list that missed three doors earlier today, and the stale deny-list in #4364. Membership is now DERIVED: an 11th assertion pins `CONVERTED` equal to the measured set of admin files importing `ConsoleTable`. Mutation-checked both ways, counts printed — delete a line (5 → 4 entries): 10 pass / **1 fail**; add a bogus one (5 → 6): 7 pass / **4 fail**.

### Found while passing through, NOT fixed

Seven other `/admin/studio` surfaces carry **19 occurrences of gold-as-text** (`social-queue` alone has 11). They are unguarded because the colour rule only iterates `CONVERTED`, and none of them hand-rolls a table, so none is on the bill. Separate work, named here so it is not lost.

The secondary display lookups (creator names, event names, referral emails) still discard their errors and render `—` for an unresolved name. That degrades to a dash rather than to a false statement, so it is left as-is.

SPEC IMPACT: None — no SKU, price, schema or migration change. Admin-only presentation and read-error handling.
