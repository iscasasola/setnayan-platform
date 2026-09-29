import { buildChecklist, type ChecklistItem } from '@/lib/guest-checklist';
import { googleMapsNavUrl, googleMapsSearchByQuery } from '@/lib/geo';
import { resolveGuestAttireWithGroups, sanitizeGroupAttire } from '@/lib/role-group-dress-code';
import { sanitizeRoleAttire } from '@/lib/role-dress-code';
import { roleLabel } from '@/lib/entourage';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { paletteSwatches } from '@/lib/site-palette';
import type { GuestRole } from '@/lib/guests';

/**
 * The facts "Your checklist" states, read from what the page ALREADY shows —
 * never a second copy of any of them (guest pathway item 6, owner 2026-09-26):
 *
 *   · what to wear   — the reader's own role's dress code (the shipped per-role
 *                      resolver the Dress code section uses), else the general
 *                      dress-code title;
 *   · motif colours  — the Mood Board palette's swatches (swatches only for
 *                      now; the illustrated person comes after Apple);
 *   · arrive by      — the run of show's first block, formatted by the
 *                      programme's own formatter (passed in);
 *   · venue + Maps   — the venue name, and directions ONLY where the page is
 *                      already allowed to open the venue (`withheldVenue` nulls
 *                      the address and coordinates for a guest who has not
 *                      replied — so this cannot leak what the page withholds);
 *   · their table    — only once seated;
 *   · the QR pass    — always, with the one free save (`/api/guest/qr`).
 */
export function guestChecklistItems(input: {
  role: GuestRole | null | undefined;
  dressCodeConfig: unknown;
  rolePalette: unknown;
  arriveBy: string | null;
  venueName: string | null;
  venueAddress: string | null;
  venueLatitude: number | null;
  venueLongitude: number | null;
  tableLabel: string | null;
  /**
   * Where "Save to Photos" saves this guest's pass. Omitted: the bare QR
   * (`/api/guest/qr`). Null: this guest has no pass yet (pending, or can't
   * come — lib/pass-card.ts), so the checklist draws no pass item at all.
   */
  passHref?: string | null;
}): ChecklistItem[] {
  const config = (input.dressCodeConfig ?? null) as {
    title?: unknown;
    roles?: unknown;
    groups?: unknown;
    palette?: unknown;
  } | null;
  const palette = sanitizeRolePalette(input.rolePalette);
  const mine = resolveGuestAttireWithGroups({
    role: input.role,
    roles: sanitizeRoleAttire(config?.roles, (v) => roleLabel(v as GuestRole) !== null),
    groups: sanitizeGroupAttire(config?.groups),
    palette,
  }).panel;
  const generalTitle = typeof config?.title === 'string' && config.title.trim() ? config.title.trim() : null;
  const dressPalette = Array.isArray(config?.palette)
    ? (config!.palette as unknown[])
        .map((p) => (p && typeof p === 'object' ? (p as { hex?: unknown }).hex : null))
        .filter((h): h is string => typeof h === 'string')
    : [];
  const motif = paletteSwatches(palette);
  const mapsHref =
    input.venueLatitude != null && input.venueLongitude != null
      ? googleMapsNavUrl(input.venueLatitude, input.venueLongitude)
      : input.venueAddress
        ? googleMapsSearchByQuery(input.venueAddress)
        : null;
  return buildChecklist({
    wear: mine?.styleLabel ?? generalTitle,
    wearNote: mine?.note ?? null,
    motif: motif.length > 0 ? motif : dressPalette,
    arriveBy: input.arriveBy,
    venueName: input.venueName,
    mapsHref,
    tableLabel: input.tableLabel,
    passHref: input.passHref === undefined ? '/api/guest/qr' : input.passHref,
  });
}
