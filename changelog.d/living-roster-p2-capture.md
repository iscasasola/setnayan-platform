## 2026-07-11 · feat(guests): Living Roster P2 — capture bar, inline chip editors, self-join inline

P2 of the owner-approved "Living Roster" redesign of the couple Guests page
(corpus memory `project_setnayan_guests_living_roster.md`) — the largest
interaction phase. Builds on P0's URL/param filter contract (`SummaryFacetBar` /
`buildHref`, untouched) and P1's overlay + optimistic + undo primitives (reused
verbatim: `Popover`, `guestOptimistic` store, `pushUndo`, `live-search.tsx`).

- **Pure Add-grammar parser** (`apps/web/lib/guest-parse.ts` + `.test.ts`, 31
  cases) — a schema-DUMB port of the prototype's Add grammar: whitespace-split;
  `bride|groom|both`→side; `/^\+(\d+)$/`→plus-ones (`min(2, N||1)`, so `+3`→2,
  `+0`→1); `#Word`→group names (deduped, casing kept); `vip`→roleHint `vip`;
  `sponsor|ninong|ninang`→roleHint `principal_sponsor`; else name (word[0]=first,
  rest=last). Returns a structured draft; the SERVER validates `roleHint` against
  the event's offered roles (falls back to `guest`). Cases cover empty/whitespace,
  mononym (last=''), multi-word last names, defaultSide + explicit-override,
  multiple/duplicate `#groups`, non-numeric `+tag`, last-wins, and the canonical
  combined line. No React/DOM — `tsx --test` without a browser.
- **Dual-mode capture bar** (`_components/capture-bar.tsx`) — Add | Find toggle,
  **Add default** (owner sign-off · capture-first). Add parses the line, calls
  `addSingleGuest`, "Adding…" shimmer (`.gl-adding`, reduced-motion-frozen), and
  Enter keeps focus to add many in a row. Find wraps `live-search.tsx` verbatim
  (its debounced `?q=` writer); ⌘K/Ctrl-K jumps to Find. The header's primary-add
  + "More ways" disclosure move into the bar's overflow (Full add form → the kept
  `QuickAddSheet`, Import CSV, Quick add list — all still wired).
- **Inline chip editors** (`_components/chip-editors.tsx`) — clicking a row's
  Side / RSVP / Role chip opens a P1 `Popover`, applies through the P1 optimistic
  overlay (row flips instantly), calls the matching single-guest action, and
  drops a 6s undo — the exact apply→server→reconcile→undo shape P1 established for
  delete. `AddToGroupControl` (a `+` in the Groups cell) picks or creates a group.
  Bride/groom RSVP + Role render as plain, non-interactive pills (couple is always
  Attending / not bulk-role-assigned, owner 2026-06-03). The row passes its
  existing pill visual as `children`, so the chip atoms stay defined once in
  `guest-list-multiselect.tsx` — the recursion-sensitive `RoleChip`/`RoleChips`
  split is untouched, no circular runtime import. A mobile one-tap RSVP-cycle
  capability ships in the component (wired into the mobile grid in P4).
- **New single-guest server actions** (`inline-actions.ts`) — `setGuestSide` /
  `setGuestRsvp` / `setGuestRole` / `setGuestPlusOnes` / `addGuestToGroup` /
  `addSingleGuest`, returning `{ok}|{ok,error}` (no redirect) for the inline
  optimistic path. Field logic + validation + RLS ported VERBATIM: side/RSVP/
  plus-one ← `[guestId]/actions.ts › updateGuest` (bride/groom RSVP coerced to
  attending, `rsvp_responded_at` stamping); role delegates to
  `quick-add-actions › setGuestPrimaryRole` (offered-role check + singleton 23505
  + seat re-place); the add reuses `quickAddGuest` (+ `quickCreateGroup` per
  `#group`, + the `+N` plus-one). All writes use the RLS-scoped couple client.
- **Self-join "needs you" inline** (`guest-list-multiselect.tsx` + `page.tsx`) —
  unlisted joiners (`entry_source='self_added_unlisted'`) already live in the
  roster list; `page.tsx` now lifts their IDS into the main `Promise.all` (the
  same read that feeds the /guests/claims banner count) and threads a
  `selfJoinIds` prop, so those rows render as a blush "joined via your link · not
  on your list" variant with Keep / Link / Remove. Keep + Remove call the SAME
  `claims/actions.ts` actions the deep page uses (so what clears the needs-you
  state stays identical); Link (a merge that needs a target picker) deep-links to
  `/guests/claims`, which stays as the full reconcile surface.

TWO decisions (owner-flagged):
1. **Capture bar defaults to ADD** (Find is the other mode; Esc/⌘K reachable) —
   the capture-first design.
2. **Group `team_side` / group→table binding DEFERRED — NO migration.** The
   group-create paths (capture `#group`, AddToGroup "New group…") write to the
   EXISTING side-less `guest_groups` schema (via `quickCreateGroup`, `team_side`
   default `'both'`). No `team_side`-on-create column was added.

DEFERRED to later phases: reactive RSVP→seat chips + the decline→seat undo (P3) ·
mobile 3-mode parity + wiring the mobile one-tap RSVP cycle + mobile self-join
card (P4).

Verified from `apps/web`: `tsc --noEmit` clean · `next lint` 0 errors (only
pre-existing warnings elsewhere) · `lint:legibility` (79 files, within baseline)
+ `lint:radius` pass · `tsx --test lib/guest-parse.test.ts
lib/guest-optimistic.test.ts` 42/42 green · `next build` succeeds.

SPEC IMPACT: None (interaction-layer redesign — no schema/pricing/SKU change; the
group `team_side`/table-binding invention from the prototype is explicitly NOT
adopted, so no `guest_groups` migration). Tracks P2 of the owner-approved Living
Roster redesign per corpus memory `project_setnayan_guests_living_roster.md`.
