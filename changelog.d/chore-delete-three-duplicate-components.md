## 2026-08-06 · chore(cleanup): delete three duplicate components that lost their doorway

Three components had **zero importers** and were each a second copy of something
a live screen already does. Verified against `origin/main`, not against a
document — the first pass of this hunt guessed the wrong paths for all three and
concluded two were "already deleted" when they were not.

**Deleted:**

| File | Why it is redundant — the live thing that covers it |
|---|---|
| `dashboard/[eventId]/vendors/invite-modal.tsx` | `_components/new-manual-vendor-modal.tsx` (mounted from `plan-budget-accordion.tsx` **and** `shortlist-categories.tsx`) invites a supplier via `createManualVendorInvite`, returning a claim URL + QR with Copy / Share affordances. |
| `dashboard/[eventId]/studio/save-the-date/_components/soundtrack-row.tsx` | `StdBuilderClient.tsx` uploads the song at Step 4 (`handleMusicUpload` → `siteMusicKey`) and persists through `saveAllStdContent`. |
| `dashboard/[eventId]/date-selection/_components/auspicious-card.tsx` | `date-picker.tsx` computes and renders the same reasons inline (`computeAuspiciousReasons`, line 86), and `date-selection/page.tsx` renders the locked view. The card was a **third** copy. |

**Also removed:** `saveSoundtrack` (in `studio/save-the-date/actions.ts`) — its only
caller was the deleted row. It wrote the same three `events.site_bg_music_*`
columns as `saveAllStdContent` while **skipping** that path's `parseClientRef`
validation, so it was a strictly weaker duplicate.

**Deliberately KEPT:** `sendVendorInvite` + `connectExistingVendorProfile` in
`lib/vendor-invite-actions.ts`, now documented as having no caller. Emailing an
invite is a capability **nothing else provides** — `createManualVendorInvite`
returns a link and does not send mail. Deleting them would have removed a
feature, not a duplicate. The rest of that file is the live claim-link flow.

**Fixed three docblocks** that referenced `AuspiciousCard` / `auspicious-card`
by name and would have pointed at a deleted file.

### On the guard baseline

`port-control-baseline.json` is regenerated in this PR — the escape hatch
`lint-port-no-lost-controls.mjs` documents, so a deliberate removal lands as a
readable line in front of a reviewer instead of silently. The diff also absorbs
two controls added by other merged PRs (`setDelegatePhotos`,
`host-setlist-panel.tsx`) that the previous baseline ref predated. Guard passes:
403 routes / 1194 controls.

### Verified before deleting

- zero importers for all three, on current `origin/main` (not a stale checkout)
- none carries a "parked on purpose" docblock — the register lists 18 files that
  do, and deleting one of those is what would break things
- every orphaned symbol traced: `computeAuspiciousReasons` has 7 live consumers
  and `ChineseSpecialistNudge` is also imported by `page.tsx`, so both survive
- no unused imports left behind; 15/15 lint scripts pass

A claim in an early draft of the kept-actions comment — that they "remain covered
by the vendor-invite tests" — was **false** and is corrected in the shipped
comment: nothing tests them.

SPEC IMPACT: None. No behaviour changes — every deleted file was unreachable.
