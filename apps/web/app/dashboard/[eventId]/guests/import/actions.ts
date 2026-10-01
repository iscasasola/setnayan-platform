'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { applyReconcileForEvent } from '@/lib/seating-reconcile';
import { syncExtraSeats } from '@/lib/extra-seats-sync';
import { eventHasSides } from '@/lib/guest-side-question';
import { resolveRoleSetForEvent } from '@/lib/event-type-profile';
import {
  MAX_IMPORT_ROWS,
  looksLikeSpreadsheetPackage,
  planGuestImport,
  readGuestFile,
  type ExistingGuest,
  type ImportPlan,
} from '@/lib/guest-import-file';

/**
 * What the import page shows between the two clicks. `rows` is the whole
 * preview (one per row of the file); `csv` is the file's text, carried back
 * on "Add" so the server re-reads it — the preview is never trusted as input.
 */
export type GuestImportState =
  | { stage: 'idle' }
  | { stage: 'error'; message: string }
  | { stage: 'preview'; fileName: string; csv: string; rows: ImportPlan['rows']; counts: ImportPlan['counts'] };

const MAX_FILE_BYTES = 1_000_000;

async function planFor(eventId: string, csv: string) {
  const rows = readGuestFile(csv);
  if (rows.length === 0) return { error: 'We could not find any names in that file. Is the first row the column titles?' } as const;
  if (rows.length > MAX_IMPORT_ROWS) {
    return { error: `That file has ${rows.length} rows — up to ${MAX_IMPORT_ROWS} at a time, please split it.` } as const;
  }
  const supabase = await createClient();
  const { data: existing, error } = await supabase
    .from('guests')
    .select('guest_id,first_name,last_name,name_prefix,middle_name,name_suffix,side,group_category,role,mobile,plus_one_count')
    .eq('event_id', eventId)
    .is('deleted_at', null);
  // 🔒 A refused read must not look like an empty list: matching against
  // "nobody" would turn every update into a duplicate.
  if (error) return { error: 'We could not read your guest list just now. Try again in a moment.' } as const;
  const roleSet = await resolveRoleSetForEvent(eventId);
  const plan = planGuestImport(rows, {
    offeredRoles: roleSet.offeredRoles,
    singletonRoles: roleSet.singletonRoles,
    hasSides: eventHasSides(roleSet),
    existing: (existing ?? []) as ExistingGuest[],
  });
  return { plan, supabase } as const;
}

/**
 * ONE action, two steps (no new server action — the route budget):
 *   mode=preview (default) — read the uploaded file, return the preview;
 *   mode=add               — re-read the same text, add the new people and
 *                            update the changed ones, then go to the list.
 */
export async function importGuestsCsv(
  eventId: string,
  _prev: GuestImportState,
  formData: FormData,
): Promise<GuestImportState> {
  const mode = String(formData.get('mode') ?? 'preview');
  if (mode === 'reset') return { stage: 'idle' };

  if (mode !== 'add') {
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return { stage: 'error', message: 'Choose your guest list file first.' };
    }
    if (file.size > MAX_FILE_BYTES) return { stage: 'error', message: 'That file is too big for a guest list.' };
    const text = await file.text();
    if (looksLikeSpreadsheetPackage(file.name, text.slice(0, 2))) {
      return {
        stage: 'error',
        message:
          'Save it as CSV first, then upload that. Excel: File › Save As › CSV. Numbers: File › Export To › CSV. Google Sheets: File › Download › CSV.',
      };
    }
    const res = await planFor(eventId, text);
    if ('error' in res) return { stage: 'error', message: res.error ?? 'Something went wrong.' };
    return { stage: 'preview', fileName: file.name, csv: text, rows: res.plan.rows, counts: res.plan.counts };
  }

  const csv = String(formData.get('csv') ?? '');
  const res = await planFor(eventId, csv);
  if ('error' in res) return { stage: 'error', message: res.error ?? 'Something went wrong.' };
  const { plan, supabase } = res;

  const fresh = plan.rows.filter((r) => r.status === 'new' && r.record);
  const changed = plan.rows.filter((r) => r.status === 'changed' && r.guestId && r.patch);
  if (fresh.length === 0 && changed.length === 0) {
    return { stage: 'error', message: 'Nothing to add or change — everyone in the file is already on your list.' };
  }

  const touched: Array<{ guest_id: string; plus_one_count: number | null }> = [];
  const reseat: string[] = [];
  if (fresh.length > 0) {
    const { data: insertedRows, error: insertErr } = await supabase
      .from('guests')
      .insert(fresh.map((r) => ({ ...r.record, event_id: eventId, photo_consent: true })))
      .select('guest_id, plus_one_count');
    if (insertErr) return { stage: 'error', message: `We could not add them: ${insertErr.message}` };
    touched.push(...((insertedRows ?? []) as typeof touched));
  }

  let updated = 0;
  let failed = 0;
  for (const r of changed) {
    const { error } = await supabase
      .from('guests')
      .update(r.patch!)
      .eq('guest_id', r.guestId!)
      .eq('event_id', eventId);
    if (error) failed += 1;
    else {
      updated += 1;
      if (r.patch!.plus_one_count !== undefined) reseat.push(r.guestId!);
    }
  }

  // Smart seat-plan Phase 5: gap-fill the imported guests into provisional seats.
  // ⚖ "+ will have seats beside the person invited" (owner 2026-09-21): each
  // imported +N gets its N seats; a changed +N re-syncs its seats.
  for (const r of touched) {
    if ((r.plus_one_count ?? 0) > 0) await syncExtraSeats(supabase, eventId, r.guest_id);
  }
  // A changed count re-syncs either way — down to zero frees the seats.
  for (const guestId of reseat) await syncExtraSeats(supabase, eventId, guestId);
  await applyReconcileForEvent(supabase, eventId);

  revalidatePath(`/dashboard/${eventId}/guests`);
  const params = new URLSearchParams({ imported: String(fresh.length) });
  if (updated > 0) params.set('updated', String(updated));
  const skipped = plan.counts.look + failed;
  if (skipped > 0) params.set('skipped', String(skipped));
  return redirect(`/dashboard/${eventId}/guests?${params.toString()}`);
}
