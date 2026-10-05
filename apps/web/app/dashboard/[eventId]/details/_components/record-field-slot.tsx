import { Suspense } from 'react';
import { eventWordsFromProfile } from '@/app/[slug]/_lib/event-words';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchEventViewer } from '@/lib/event-viewer.server';
import { isDelegateWithoutArea } from '@/lib/event-viewer';
import { profileSetup, resolveProfileByEvent, surfaceEnabled } from '@/lib/event-type-profile';
import { coverQuestion, giftsLabel, LOGO_QUESTION, papicLabel } from '@/lib/event-answers';
import { readHubDraft } from '@/lib/hub-draft-store';
import { printOwnsPro } from '@/lib/print-set.server';
import { isStoreShellRequest } from '@/lib/request-platform';
import { RECORD_ROW_EDITOR, RECORD_ROW_GROUP, parseRecordRow, recordHref, type RecordEditorKey } from '@/lib/event-details-record';
import { RecordEditor } from './record-editor';
import { RecordFieldSheet } from './record-field-sheet';

/**
 * ✍ THE OPEN ROW'S FIELD — what the record's `@field` slot draws while an
 * address names a row (`…/details/field/<row>`). Intercepted from the record,
 * it arrives ALONE: the record stays as it is (its folds, its scroll), so
 * opening a row is the field appearing, never the page reloading.
 *
 * Who may open one is who may change the fact in the Maker: the couple, on an
 * event whose type has an Event Hub; Event settings (which save live and are
 * not Hub publications) only need the couple. Anyone else gets nothing — the
 * record's rows are read-only for them.
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
  const [viewer, profile] = await Promise.all([fetchEventViewer(supabase, eventId, user.id), resolveProfileByEvent(eventId)]);
  if (!viewer.isCouple) return null;
  if (editor !== 'settings' && !surfaceEnabled(profile, 'website')) return null;

  const [draft, ownsPro, storeShell] = await Promise.all([
    /* A draft that cannot be read shows the live value — as the Maker does; the
       editor's save still merges into the draft the server reads itself. */
    readHubDraft(supabase, eventId).catch((e: unknown) => {
      console.error('[event-details] the draft could not be read:', e instanceof Error ? e.message : e);
      return null;
    }),
    printOwnsPro(eventId),
    isStoreShellRequest(),
  ]);

  const title = fieldTitle(editor, profile);
  return (
    <RecordFieldSheet row={row} group={RECORD_ROW_GROUP[row]} title={title} recordHref={recordHref(eventId)}>
      <Suspense fallback={<p className="text-sm text-ink/60">Opening…</p>}>
        <RecordEditor
          editor={editor}
          ctx={{
            eventId,
            userId: user.id,
            supabase,
            admin: createAdminClient(),
            profile,
            draft,
            ownsPro,
            storeShell,
            mayReadGuests: !isDelegateWithoutArea(viewer, 'guest_list'),
          }}
        />
      </Suspense>
    </RecordFieldSheet>
  );
}

/** The sheet's title — the name the record and the Maker already give the field. */
function fieldTitle(editor: RecordEditorKey, profile: Awaited<ReturnType<typeof resolveProfileByEvent>>): string {
  const words = eventWordsFromProfile(profile);
  switch (editor) {
    case 'font':
      return 'Font';
    case 'colours':
      return 'Colours';
    case 'buttons':
      return 'Buttons';
    case 'rsvp':
      return 'RSVP';
    case 'papic':
      return papicLabel(words.solemn);
    case 'gifts':
      return giftsLabel(profileSetup(profile).giftsMode);
    case 'logo-answer':
      return LOGO_QUESTION;
    case 'cover-answer':
      return coverQuestion(words.solemn);
    case 'names':
      return 'Names';
    case 'date':
      return 'Date & time';
    case 'venues':
      return 'Venues';
    case 'love-story':
      return 'Love Story';
    case 'special-message':
      return 'Special message';
    case 'settings':
      return 'Event settings';
  }
}
