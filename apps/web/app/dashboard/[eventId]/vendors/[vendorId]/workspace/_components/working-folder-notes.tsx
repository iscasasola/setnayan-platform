import { Lock, NotebookPen, Trash2, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  WORKING_NOTE_BODY_MAX,
  WORKING_NOTE_VISIBILITY_LABEL,
  canDeleteWorkingNote,
  isCoordinatorVendorNotesEnabled,
  visibleWorkingNotes,
  type WorkingNoteRow,
  type WorkingNoteViewer,
} from '@/lib/vendor-working-notes';
import { addWorkingNoteAction, deleteWorkingNoteAction } from '../actions';

/**
 * Working folder — notes (Coordinator P4 · corpus
 * Coordinator_Role_Feature_Spec_2026-07-18.md § 4 P4).
 *
 * The per-vendor note stream with the private-vs-shared split that IS the
 * feature: a coordinator preps privately ('coordinator_private' — never shown
 * to the couple), then shares what's ready ('shared' — visible to both).
 * The couple can add notes too; theirs are always shared.
 *
 * Self-contained server component: queries under the viewer's own RLS session
 * (migration 20270825279091), so a couple viewer physically cannot receive
 * private rows — visibleWorkingNotes() is only the render-honesty belt.
 * Graceful-degrade: renders nothing pre-migration or for non-members.
 * Flag-gated (NEXT_PUBLIC_COORDINATOR_VENDOR_NOTES_ENABLED, default OFF):
 * flag off ⇒ null, zero queries, today's page byte-for-byte.
 */

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export async function WorkingFolderNotes({
  eventId,
  vendorId,
  displayName,
}: {
  eventId: string;
  vendorId: string;
  displayName: string;
}) {
  if (!isCoordinatorVendorNotesEnabled()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Who is looking? Couple (event_members) vs coordinator (accepted, live
  // event_moderators row). Anyone else gets no folder at all.
  const [{ data: member }, { data: moderator }] = await Promise.all([
    supabase
      .from('event_members')
      .select('member_type')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .eq('member_type', 'couple')
      .maybeSingle(),
    supabase
      .from('event_moderators')
      .select('moderator_id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .is('removed_at', null)
      .maybeSingle(),
  ]);
  const viewer: WorkingNoteViewer = {
    isCouple: Boolean(member),
    isCoordinator: Boolean(moderator),
  };
  if (!viewer.isCouple && !viewer.isCoordinator) return null;

  const { data, error } = await supabase
    .from('event_vendor_working_notes')
    .select('note_id, author_user_id, author_role, visibility, body, created_at')
    .eq('event_vendor_id', vendorId)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) return null; // pre-migration graceful-degrade (42P01)

  // RLS already withheld private rows from a couple session; filter again so
  // the render can never outrun the database.
  const notes = visibleWorkingNotes(viewer, (data ?? []) as WorkingNoteRow[]);

  const authorLabel = (n: WorkingNoteRow): string => {
    if (n.author_user_id === user.id) return 'You';
    return n.author_role === 'coordinator' ? 'Coordinator' : 'Couple';
  };

  return (
    <section
      id="working-folder"
      aria-labelledby="working-folder-heading"
      className="space-y-4 rounded-2xl border border-ink/10 bg-cream/40 p-5"
    >
      <header className="space-y-1">
        <h2
          id="working-folder-heading"
          className="flex items-center gap-2 text-sm font-semibold text-ink"
        >
          <NotebookPen aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
          Working folder · notes on {displayName}
        </h2>
        <p className="text-xs text-ink/60">
          {viewer.isCoordinator
            ? 'Prep privately, share when ready — private notes stay between coordinators; shared notes are visible to the couple.'
            : 'Notes you and your coordinator keep on this vendor. Your coordinator may also keep private working notes.'}
        </p>
      </header>

      {/* Composer — append-only; visibility chosen at write time. */}
      <form action={addWorkingNoteAction} className="space-y-3">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="vendor_id" value={vendorId} />
        <label htmlFor="working-folder-body" className="sr-only">
          Add a note about {displayName}
        </label>
        <textarea
          id="working-folder-body"
          name="body"
          required
          rows={3}
          maxLength={WORKING_NOTE_BODY_MAX}
          placeholder={
            viewer.isCoordinator
              ? 'e.g. Caterer can flex the ingress time — confirm final headcount first.'
              : 'e.g. We prefer the garden setup if the weather holds.'
          }
          className="w-full rounded-lg border border-ink/15 bg-cream/80 px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          {viewer.isCoordinator ? (
            <fieldset className="flex flex-wrap items-center gap-3">
              <legend className="sr-only">Who can see this note</legend>
              <label className="inline-flex items-center gap-1.5 text-xs text-ink/75">
                <input
                  type="radio"
                  name="visibility"
                  value="coordinator_private"
                  defaultChecked
                  className="h-3.5 w-3.5 accent-mulberry"
                />
                <Lock aria-hidden className="h-3 w-3 text-ink/50" strokeWidth={2} />
                {WORKING_NOTE_VISIBILITY_LABEL.coordinator_private}
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-ink/75">
                <input
                  type="radio"
                  name="visibility"
                  value="shared"
                  className="h-3.5 w-3.5 accent-mulberry"
                />
                <Users aria-hidden className="h-3 w-3 text-ink/50" strokeWidth={2} />
                {WORKING_NOTE_VISIBILITY_LABEL.shared}
              </label>
            </fieldset>
          ) : (
            <p className="text-[11px] text-ink/50">
              Visible to you and your coordinator.
            </p>
          )}
          <SubmitButton
            pendingLabel="Adding…"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-mulberry px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-mulberry-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            Add note
          </SubmitButton>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="text-xs text-ink/50">No notes in this folder yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => {
            const isPrivate = n.visibility === 'coordinator_private';
            return (
              <li
                key={n.note_id}
                className={
                  isPrivate
                    ? 'rounded-lg border border-dashed border-ink/30 bg-ink/5 px-3 py-2.5'
                    : 'rounded-lg border border-ink/10 bg-cream/80 px-3 py-2.5'
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">
                      {isPrivate ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-ink/10 px-2 py-0.5 text-ink/70">
                          <Lock aria-hidden className="h-2.5 w-2.5" strokeWidth={2} />
                          {WORKING_NOTE_VISIBILITY_LABEL.coordinator_private}
                        </span>
                      ) : viewer.isCoordinator ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-100 px-2 py-0.5 text-success-800">
                          <Users aria-hidden className="h-2.5 w-2.5" strokeWidth={2} />
                          {WORKING_NOTE_VISIBILITY_LABEL.shared}
                        </span>
                      ) : null}
                      <span>
                        {authorLabel(n)} · {fmtDate(n.created_at)}
                      </span>
                    </p>
                    <p className="whitespace-pre-line text-sm text-ink/85">{n.body}</p>
                  </div>
                  {canDeleteWorkingNote(user.id, n) ? (
                    <form action={deleteWorkingNoteAction} className="shrink-0">
                      <input type="hidden" name="event_id" value={eventId} />
                      <input type="hidden" name="vendor_id" value={vendorId} />
                      <input type="hidden" name="note_id" value={n.note_id} />
                      <SubmitButton
                        pendingLabel="…"
                        overlay={false}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
                        aria-label="Remove your note"
                        title="Remove your note"
                      >
                        <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </SubmitButton>
                    </form>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
