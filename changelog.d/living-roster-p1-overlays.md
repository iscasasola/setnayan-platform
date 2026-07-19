## 2026-07-11 · feat(guests): Living Roster P1 — overlays, optimistic updates, undo-toasts

P1 of the owner-approved "Living Roster" redesign of the couple Guests page
(corpus memory `project_setnayan_guests_living_roster.md`) — the in-page overlay
+ optimistic-mutation + undo-toast layer that P2 (inline chip editors) and P3
(decline→seat loop) build on. Builds on P0's reskin; P0's URL/param filter
contract (`SummaryFacetBar` / `buildHref`) is untouched.

- **Pure optimistic + undo layer** (`apps/web/lib/guest-optimistic.ts` +
  `.test.ts`, 11 cases) — apply-local → server action → revalidate →
  RECONCILE-BY-ID (idempotent, so a double-render can't flip a row twice), plus
  a `buildUndo` inverse builder. The undo of a soft-delete carries the RELEASED
  SEATS through, so restoring a guest re-places them on the same table/chair.
  No React/DOM — unit-tested via `tsx --test` without a browser.
- **Overlay primitives** (`_components/overlay-primitives.tsx`) — `Popover`
  (anchored, ships for P2's chip editors), `Scrim`, and `Drawer` (right slide-in
  desktop / bottom-sheet mobile). Focus-trap + aria + Esc-to-close reuse the
  shared `useModalA11y` hook (focus is RESTORED to the trigger on close, so the
  drawer never steals the selection-checkbox focus); motion uses new `.gl-*`
  keyframes (`gl-pop/gl-slidein/gl-sheetup/gl-fade`) in `globals.css`, frozen by
  the file's universal `prefers-reduced-motion` block.
- **Undo snackbar** (`_components/undo-toast.tsx`) — a bottom host + tiny module
  store (`pushUndo({label, undo})`, 6s auto-dismiss, one live at a time).
  Mounted once in `page.tsx`. Separate from the app-wide `useToast()` (that one
  has no action button).
- **Quick-view drawer** (`_components/guest-drawer.tsx`) — READ-ONLY right
  slide-in: name/side/RSVP/role, Contact (moved off the row), groups, plus-one,
  and a decorative personal QR deterministically seeded from the guest's real
  `qr_token`. Opened by an additive per-row quick-view button; the row name Link
  to the full `/[guestId]` detail/edit route STAYS. Edit affordances are P2.
- **Optimistic bulk delete + undo** (`_components/guest-list-multiselect.tsx`) —
  the SelectionBar delete no longer opens a blocking confirm dialog. It hides the
  rows via a new optimistic overlay store (`_components/guest-optimistic-store.ts`)
  and drops a 6s undo snackbar. Same server gates (couple-protected,
  RSVP-set-blocked) enforced server-side; a rejection rolls the overlay back +
  error-toasts. `guestSelection` store wiring + row keys unchanged; the mobile
  swipe-to-delete path (`bulkSoftDeleteGuests`, FormData→redirect) is unchanged.
- **New return-based actions** (`groups-actions.ts`) —
  `bulkSoftDeleteGuestsForUndo` (mirrors the redirect action's gates but CAPTURES
  the released seats before deleting and RETURNS `{removedIds, releasedSeats}`)
  and `restoreDeletedGuests` (un-soft-deletes + re-upserts the seats). RLS-safe:
  `couple_writes_guest` is FOR ALL and not `deleted_at`-gated, so a couple can
  flip `deleted_at` back to NULL; seat restore is best-effort (a re-taken chair
  leaves the guest restored-but-unseated, never a hard failure).

DEFERRED (later phases, unchanged this PR): dual-mode Add/Find capture bar +
inline RSVP/side/role chip editors + self-join "needs you" inline (P2) · reactive
RSVP→seat chips (P3) · optimistic path for the bulk role/side/group APPLY (only
the delete is optimistic in P1) · opening the invite explainer as a drawer
(ShareDropdown details block left as-is to keep the diff focused) · mobile
quick-view + 3-mode switch (P4).

Verified: `tsc --noEmit` clean · `next lint` 0 errors (only pre-existing
warnings elsewhere) · `lint:legibility` / `lint:radius` / `lint:retired` pass ·
`tsx --test lib/guest-optimistic.test.ts` 11/11 green · `next build` succeeds.

SPEC IMPACT: None (interaction-layer redesign, no schema/pricing/SKU change).
Tracks P1 of the owner-approved Living Roster redesign per corpus memory
`project_setnayan_guests_living_roster.md`: confirm dialogs → undo toasts,
read-only quick-view drawer, optimistic soft-delete with seat-restore-on-undo.
