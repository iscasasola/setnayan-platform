import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { fetchEventViewer } from '@/lib/event-viewer.server';
import { parseRecordRow, recordHref, RECORD_ROW_EDITOR } from '@/lib/event-details-record';
import { RecordEditor } from './record-editor';
import { RecordFieldSheet } from './record-field-sheet';

/**
 * ✍ THE OPEN ROW'S FIELD — what the record's `@field` slot draws while an
 * address names a row (`…/details/field/<row>`). Intercepted from the record,
 * it arrives ALONE: the record stays as it is (its folds, its scroll), so
 * opening a row is the field appearing, never the page reloading.
 *
 * Who may open one: the couple (Event settings save live and are not Hub
 * publications). Anyone else gets nothing — the record's rows are read-only
 * for them.
 *
 * 🔒 Only SELECTs here — opening a field writes nothing.
 */
export async function RecordFieldSlot({ eventId, row: rawRow }: { eventId: string; row: string }) {
  const row = parseRecordRow(rawRow);
  if (!row) return null;
  const editor = RECORD_ROW_EDITOR[row];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const viewer = await fetchEventViewer(supabase, eventId, user.id);
  if (!viewer.isCouple) return null;
  return (
    <RecordFieldSheet row={row} title="Event settings" recordHref={recordHref(eventId)}>
      <Suspense fallback={<p className="text-sm text-ink/60">Opening…</p>}>
        <RecordEditor editor={editor} ctx={{ eventId, userId: user.id, supabase }} />
      </Suspense>
    </RecordFieldSheet>
  );
}
