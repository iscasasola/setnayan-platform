import { Lock, NotebookPen, Users } from 'lucide-react';
import { ReadRefusedNotice } from '@/app/dashboard/[eventId]/_components/read-refused-notice';
import { createClient } from '@/lib/supabase/server';
import { isMissingRelationError, logQueryError } from '@/lib/supabase/error-detect';
import { SubmitButton } from '@/app/_components/submit-button';
import { Badge } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';
import {
  WORKING_NOTE_BODY_MAX,
  WORKING_NOTE_VISIBILITY_LABEL,
  canDeleteWorkingNote,
  isCoordinatorVendorNotesEnabled,
  visibleWorkingNotes,
  type WorkingNoteRow,
  type WorkingNoteViewer,
} from '@/lib/vendor-working-notes';
import { addWorkingNoteAction } from '../actions';
import { WorkingNoteSwipe } from './working-note-swipe';

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
  const [{ data: member, error: memberError }, { data: moderator, error: moderatorError }] = await Promise.all([
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
      .neq('role_subtype', 'viewer') // a limited helper views, never edits (owner 2026-09-28)
      .is('removed_at', null)
      .maybeSingle(),
  ]);
  if (memberError) {
    logQueryError('WorkingFolderNotes.member', memberError, { event_id: eventId }, 'graceful_degrade');
  }
  if (moderatorError) {
    logQueryError('WorkingFolderNotes.moderator', moderatorError, { event_id: eventId }, 'graceful_degrade');
  }
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
  // ⚠ THE COMMENT NAMED ONE CAUSE; THE CODE SWALLOWED EVERY CAUSE. A table that
  // ⚠ does not exist yet is a fair reason to render nothing quietly. A refusal
  // ⚠ is not — and this card disappearing is how the notes on this booking — vanish from the people writing them.
  // ⚠ The predicate it meant to use already lived one file away.
  if (error) {
    if (isMissingRelationError(error)) return null;
    logQueryError('WorkingFolderNotes.notes', error, { event_id: eventId }, 'graceful_degrade');
    return <ReadRefusedNotice what="the notes on this booking" />;
  }

  // RLS already withheld private rows from a couple session; filter again so
  // the render can never outrun the database.
  const notes = visibleWorkingNotes(viewer, (data ?? []) as WorkingNoteRow[]);

  const authorLabel = (n: WorkingNoteRow): string => {
    if (n.author_user_id === user.id) return 'You';
    return n.author_role === 'coordinator' ? 'Coordinator' : 'Couple';
  };

  return (
    // 📐 DESIGN TEMPLATE (14 Nov 2026, rules 2 · 3 · 5 · 6 · 7 · 13): no card — the section's grey capitals with who sees
    // what behind ⓘ, the composer, then each note as a plain row between hairlines (a private one keeps its dashed
    // edge so it never reads as shared). Who-can-see is a soft chip; "Add note" is the shared pill.
    <section id="working-folder" aria-labelledby="working-folder-heading" className="space-y-3">
      <h2 id="working-folder-heading" className="mb-1 mt-[18px] flex items-center gap-2">
        <NotebookPen aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
        <InfoTip
          label={`Working folder · notes on ${displayName}`}
          labelAs="span"
          labelClassName="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70"
          align="start"
        >
          {viewer.isCoordinator
            ? 'Prep privately, share when ready — private notes stay between coordinators; shared notes are visible to the couple.'
            : 'Notes you and your coordinator keep on this supplier. Your coordinator may also keep private working notes.'}
        </InfoTip>
      </h2>

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
              <label className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink">
                <input
                  type="radio"
                  name="visibility"
                  value="coordinator_private"
                  defaultChecked
                  className="h-4 w-4 accent-mulberry"
                />
                <Lock aria-hidden className="h-3 w-3 text-ink/70" strokeWidth={2} />
                {WORKING_NOTE_VISIBILITY_LABEL.coordinator_private}
              </label>
              <label className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink">
                <input
                  type="radio"
                  name="visibility"
                  value="shared"
                  className="h-4 w-4 accent-mulberry"
                />
                <Users aria-hidden className="h-3 w-3 text-ink/70" strokeWidth={2} />
                {WORKING_NOTE_VISIBILITY_LABEL.shared}
              </label>
            </fieldset>
          ) : (
            <p className="text-[13px] text-ink/70">
              Visible to you and your coordinator.
            </p>
          )}
          <SubmitButton
            pendingLabel="Adding…"
            className="ab ab-brand inline-flex min-h-11 items-center justify-center"
          >
            Add note
          </SubmitButton>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="py-2 text-sm text-ink/70">No notes in this folder yet.</p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {notes.map((n) => {
            const isPrivate = n.visibility === 'coordinator_private';
            const card = isPrivate
              ? 'min-h-14 border-l-2 border-dashed border-l-ink/30 py-2.5 pl-3'
              : 'min-h-14 py-2.5';
            const body = (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink/70">
                      {isPrivate ? (
                        <Badge tone="quiet">{WORKING_NOTE_VISIBILITY_LABEL.coordinator_private}</Badge>
                      ) : viewer.isCoordinator ? (
                        <Badge tone="ok">{WORKING_NOTE_VISIBILITY_LABEL.shared}</Badge>
                      ) : null}
                      <span>
                        {authorLabel(n)} · {fmtDate(n.created_at)}
                      </span>
                    </p>
                    <p className="whitespace-pre-line text-[15px] text-ink">{n.body}</p>
                  </div>
                </div>
            );
            /* 👈 Your own note deletes by its swipe (owner 2026-11-03) — no trash on the note. */
            return canDeleteWorkingNote(user.id, n) ? (
              <WorkingNoteSwipe key={n.note_id} eventId={eventId} vendorId={vendorId} noteId={n.note_id} className={card}>
                {body}
              </WorkingNoteSwipe>
            ) : (
              <li key={n.note_id} className={card}>
                {body}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
