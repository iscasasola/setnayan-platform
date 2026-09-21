'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { applyReconcileForEvent } from '@/lib/seating-reconcile';
import { parseCsv } from '@/lib/csv';
import { normalizeGuestName } from '@/lib/guest-name';
import { parsePersonName } from '@/lib/person-name-parse';
import { norm } from '@/lib/guest-dedupe';
import type {
  GuestGroupCategory,
  GuestRole,
  GuestSide,
  RsvpStatus,
} from '@/lib/guests';
import { plusOnesFromCsv } from '@/lib/guests';
import { resolveRoleSetForEvent } from '@/lib/event-type-profile';

const MAX_ROWS = 200;

// Iteration 0053 P2: the valid role set is per event type — resolved once
// (resolveRoleSetForEvent) before the row loop below.
const SIDE_VALUES: GuestSide[] = ['bride', 'groom', 'both'];
const GROUP_VALUES: GuestGroupCategory[] = [
  'family',
  'friends',
  'work',
  'school',
  'officiant',
  'other',
];
const RSVP_VALUES: RsvpStatus[] = ['pending', 'attending', 'declined', 'maybe'];

export async function importGuestsCsv(eventId: string, formData: FormData) {
  const raw = String(formData.get('csv') ?? '').trim();
  if (!raw) {
    return redirect(`/dashboard/${eventId}/guests/import?error=empty`);
  }

  const rows = parseCsv(raw);
  if (rows.length === 0) {
    return redirect(`/dashboard/${eventId}/guests/import?error=no_rows`);
  }
  if (rows.length > MAX_ROWS) {
    return redirect(
      `/dashboard/${eventId}/guests/import?error=${encodeURIComponent('Max 200 rows; got ' + rows.length)}`,
    );
  }

  const supabase = await createClient();

  // Exact-duplicate keys (normalized first|last) already on this event, so
  // a re-imported file silently skips the rows already on the list instead
  // of doubling everyone. Graceful-degrade to "no existing" on error — an
  // import shouldn't hard-fail just because this pre-check query did.
  const existingKeys = new Set<string>();
  {
    const { data: existing } = await supabase
      .from('guests')
      .select('first_name,last_name')
      .eq('event_id', eventId)
      .is('deleted_at', null);
    for (const g of (existing ?? []) as Array<{
      first_name: string;
      last_name: string;
    }>) {
      existingKeys.add(`${norm(g.first_name)}|${norm(g.last_name)}`);
    }
  }

  // Validate + shape every row before writing anything.
  const roleSet = await resolveRoleSetForEvent(eventId);
  const valid: Array<Record<string, unknown>> = [];
  const errors: string[] = [];
  // Keys seen so far this import — catches the same person listed twice in
  // the uploaded file itself, not just against the existing list.
  const seenKeys = new Set<string>();
  let duplicates = 0;

  rows.forEach((row, index) => {
    const lineNo = index + 2; // header is line 1
    // A spreadsheet column is where whole names arrive most often — either a
    // single "name" column, or a first_name cell that actually holds
    // "Atty. Bob Casasola Jr.". Parse the two cells as one line so the title
    // never becomes the given name, then fall back to the raw cells when the
    // parser found nothing to move.
    const rawFirst = normalizeGuestName(row.first_name);
    const rawLast = normalizeGuestName(row.last_name);
    const parts = parsePersonName(`${rawFirst} ${rawLast}`.trim());
    const first_name = parts.firstName || rawFirst;
    const last_name = parts.lastName || rawLast;
    const name_prefix = parts.prefix || null;
    const middle_name = parts.middleName || null;
    const name_suffix = parts.suffix || null;
    const side = ((row.side ?? '').trim().toLowerCase() || 'both') as GuestSide;
    const group_category = ((row.group ?? row.group_category ?? '').trim().toLowerCase() ||
      'friends') as GuestGroupCategory;
    const role = ((row.role ?? '').trim().toLowerCase() || 'guest') as GuestRole;
    const email = (row.email ?? '').trim() || null;
    const mobile = (row.mobile ?? '').trim() || null;
    // Extra seats, 0–4 (owner 2026-09-21): a number, or yes/true for one.
    const plus_one_count = plusOnesFromCsv(row);
    const plus_one_allowed = plus_one_count > 0;
    const plus_one_name = normalizeGuestName(row.plus_one_name) || (plus_one_allowed ? 'TBA' : null);
    const household = (row.household ?? '').trim() || null;
    const rsvp_status = ((row.rsvp_status ?? 'pending').trim().toLowerCase() ||
      'pending') as RsvpStatus;

    if (!first_name || !last_name) {
      errors.push(`Line ${lineNo}: missing first_name or last_name`);
      return;
    }
    if (!SIDE_VALUES.includes(side)) {
      errors.push(
        `Line ${lineNo}: invalid side "${row.side}" (allowed: ${SIDE_VALUES.join(', ')})`,
      );
      return;
    }
    if (!GROUP_VALUES.includes(group_category)) {
      errors.push(
        `Line ${lineNo}: invalid group "${row.group}" (allowed: ${GROUP_VALUES.join(', ')})`,
      );
      return;
    }
    if (!roleSet.offeredRoles.includes(role)) {
      errors.push(`Line ${lineNo}: invalid role "${row.role}"`);
      return;
    }
    if (!RSVP_VALUES.includes(rsvp_status)) {
      errors.push(`Line ${lineNo}: invalid rsvp_status "${row.rsvp_status}"`);
      return;
    }

    // Exact-duplicate skip (same normalized first+last) — within the file
    // OR already on the event. Fuzzy nickname/typo matches are deliberately
    // NOT auto-skipped here: a bulk import shouldn't silently drop a
    // distinct guest on a guess; that judgment stays with the interactive
    // add forms (quick-add sheet + detailed form).
    const dupKey = `${norm(first_name)}|${norm(last_name)}`;
    if (existingKeys.has(dupKey) || seenKeys.has(dupKey)) {
      duplicates += 1;
      return;
    }
    seenKeys.add(dupKey);

    valid.push({
      event_id: eventId,
      first_name,
      last_name,
      name_prefix,
      middle_name,
      name_suffix,
      side,
      group_category,
      role,
      email,
      mobile,
      plus_one_allowed,
      plus_one_count,
      plus_one_name,
      rsvp_status,
      photo_consent: true,
      // Stash household name into notes as a placeholder — households UI lands later.
      notes: household ? `Household: ${household}` : null,
    });
  });

  if (valid.length === 0) {
    // Nothing new to insert. Distinguish "everyone was already on the list"
    // (a harmless no-op re-import) from genuine validation failures, so the
    // host isn't told their file is broken when it isn't.
    if (duplicates > 0 && errors.length === 0) {
      return redirect(
        `/dashboard/${eventId}/guests?imported=0&duplicates=${duplicates}`,
      );
    }
    const payload = errors.slice(0, 5).join(' | ');
    return redirect(
      `/dashboard/${eventId}/guests/import?error=${encodeURIComponent('All rows failed validation: ' + payload)}`,
    );
  }

  const { error: insertErr } = await supabase.from('guests').insert(valid);
  if (insertErr) {
    return redirect(
      `/dashboard/${eventId}/guests/import?error=${encodeURIComponent('Insert failed: ' + insertErr.message)}`,
    );
  }

  // Smart seat-plan Phase 5: gap-fill the imported guests into provisional seats.
  await applyReconcileForEvent(supabase, eventId);

  revalidatePath(`/dashboard/${eventId}/guests`);
  const skipped = errors.length; // invalid rows only (dupes counted separately)
  const params = new URLSearchParams({ imported: String(valid.length) });
  if (skipped > 0) params.set('skipped', String(skipped));
  if (duplicates > 0) params.set('duplicates', String(duplicates));
  return redirect(`/dashboard/${eventId}/guests?${params.toString()}`);
}
