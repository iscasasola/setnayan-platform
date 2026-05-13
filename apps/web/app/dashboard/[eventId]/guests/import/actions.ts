'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { parseCsv } from '@/lib/csv';
import type {
  GuestGroupCategory,
  GuestRole,
  GuestSide,
  RsvpStatus,
} from '@/lib/guests';

const MAX_ROWS = 200;

const ROLE_VALUES: GuestRole[] = [
  'guest',
  'maid_of_honor',
  'matron_of_honor',
  'best_man',
  'bridesmaid',
  'groomsman',
  'principal_sponsor',
  'candle_sponsor',
  'veil_sponsor',
  'cord_sponsor',
  'coin_sponsor',
  'ring_bearer',
  'bible_bearer',
  'coin_bearer',
  'flower_girl',
  'officiant',
  'reader_lector',
  'soloist_musician',
];
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

function truthy(value: string | undefined): boolean {
  if (!value) return false;
  const lower = value.trim().toLowerCase();
  return ['true', 'yes', 'y', '1', 'on'].includes(lower);
}

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

  // Validate + shape every row before writing anything.
  const valid: Array<Record<string, unknown>> = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const lineNo = index + 2; // header is line 1
    const first_name = (row.first_name ?? '').trim();
    const last_name = (row.last_name ?? '').trim();
    const side = ((row.side ?? '').trim().toLowerCase() || 'both') as GuestSide;
    const group_category = ((row.group ?? row.group_category ?? '').trim().toLowerCase() ||
      'friends') as GuestGroupCategory;
    const role = ((row.role ?? '').trim().toLowerCase() || 'guest') as GuestRole;
    const email = (row.email ?? '').trim() || null;
    const mobile = (row.mobile ?? '').trim() || null;
    const plus_one_allowed = truthy(row.plus_one_allowed);
    const plus_one_name = (row.plus_one_name ?? '').trim() || (plus_one_allowed ? 'TBA' : null);
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
    if (!ROLE_VALUES.includes(role)) {
      errors.push(`Line ${lineNo}: invalid role "${row.role}"`);
      return;
    }
    if (!RSVP_VALUES.includes(rsvp_status)) {
      errors.push(`Line ${lineNo}: invalid rsvp_status "${row.rsvp_status}"`);
      return;
    }

    valid.push({
      event_id: eventId,
      first_name,
      last_name,
      side,
      group_category,
      role,
      email,
      mobile,
      plus_one_allowed,
      plus_one_name,
      rsvp_status,
      photo_consent: true,
      // Stash household name into notes as a placeholder — households UI lands later.
      notes: household ? `Household: ${household}` : null,
    });
  });

  if (valid.length === 0) {
    const payload = errors.slice(0, 5).join(' | ');
    return redirect(
      `/dashboard/${eventId}/guests/import?error=${encodeURIComponent('All rows failed validation: ' + payload)}`,
    );
  }

  const supabase = await createClient();
  const { error: insertErr } = await supabase.from('guests').insert(valid);
  if (insertErr) {
    return redirect(
      `/dashboard/${eventId}/guests/import?error=${encodeURIComponent('Insert failed: ' + insertErr.message)}`,
    );
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  const skipped = rows.length - valid.length;
  return redirect(
    `/dashboard/${eventId}/guests?imported=${valid.length}${skipped > 0 ? `&skipped=${skipped}` : ''}`,
  );
}
