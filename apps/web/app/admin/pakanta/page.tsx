import { Music, Sparkles, Heart } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { relativeTime } from '@/lib/activity';
import {
  composePakantaBrief,
  type LoveStoryBlob,
  type PakantaResponses,
  type StoryTone,
} from '@/lib/pakanta-brief';

export const metadata = { title: 'Pakanta queue · Admin' };

/**
 * /admin/pakanta — the back-office Pakanta songwriting queue.
 *
 * The schema (20260626000000_iteration_0036_pakanta_intake_drafts.sql) was
 * built for exactly this: "Admins read all rows so the back-office Pakanta
 * queue can scan for new intakes." This page renders, for each couple who has
 * a Pakanta intake, the SONG BRIEF auto-composed from their ONBOARDING love
 * story (events.love_story) + their Pakanta music preferences
 * (pakanta_intake_drafts.responses) — see lib/pakanta-brief.ts. The music team
 * copies the brief into Suno to write the custom song; no re-interview, because
 * the love story was already told once in onboarding.
 *
 * Auth is enforced at the layout level (apps/web/app/admin/layout.tsx
 * notFound()s non-admins). Reads go through createAdminClient() (service role),
 * matching /admin/account-deletions + /admin/disputes.
 *
 * Phase 2 (separate PR) ships the couple-facing collection surface that writes
 * these draft rows (the retired wizard's intake form was deleted in #1320);
 * until then this queue lists any existing/legacy drafts and composes each
 * brief from whatever love-story + responses are present.
 */

type DraftRow = {
  draft_id: string;
  event_id: string;
  responses: PakantaResponses;
  status: 'draft' | 'purchase_pending' | 'purchased';
  updated_at: string;
};

type EventLite = {
  event_id: string;
  display_name: string | null;
  love_story: LoveStoryBlob;
  story_tone: StoryTone;
};

const STATUS_LABEL: Record<DraftRow['status'], { label: string; cls: string }> = {
  draft: { label: 'Draft (not ordered)', cls: 'bg-ink/5 text-ink/60' },
  purchase_pending: { label: 'Purchase pending', cls: 'bg-amber-100 text-amber-800' },
  purchased: { label: 'Purchased — write the song', cls: 'bg-emerald-100 text-emerald-800' },
};

export default async function AdminPakantaPage() {
  const admin = createAdminClient();

  let drafts: DraftRow[] = [];
  let queryError: string | null = null;

  const { data: draftData, error: draftErr } = await admin
    .from('pakanta_intake_drafts')
    .select('draft_id,event_id,responses,status,updated_at')
    .order('updated_at', { ascending: false })
    .limit(200);
  if (draftErr) {
    logQueryError('AdminPakantaPage (drafts)', draftErr, {}, 'graceful_degrade');
    queryError = draftErr.message;
  }
  drafts = (draftData ?? []) as DraftRow[];

  // Resolve the event (couple names + love story + tone) behind each draft in
  // one IN query — matches the lookup style on /admin/account-deletions.
  const eventIds = Array.from(new Set(drafts.map((d) => d.event_id)));
  const eventsById = new Map<string, EventLite>();
  if (eventIds.length > 0) {
    const { data: eventsData, error: eventsErr } = await admin
      .from('events')
      .select('event_id,display_name,love_story,story_tone')
      .in('event_id', eventIds);
    if (eventsErr) {
      logQueryError('AdminPakantaPage (events)', eventsErr, {}, 'graceful_degrade');
    }
    for (const e of (eventsData ?? []) as EventLite[]) eventsById.set(e.event_id, e);
  }

  // Compose a brief per draft, newest first; purchased/pending float to the top.
  const rows = drafts
    .map((d) => {
      const ev = eventsById.get(d.event_id);
      const brief = composePakantaBrief({
        coupleNames: ev?.display_name ?? 'The couple',
        loveStory: ev?.love_story ?? null,
        storyTone: ev?.story_tone ?? null,
        responses: d.responses ?? null,
      });
      return { draft: d, brief };
    })
    .sort((a, b) => {
      const rank = (s: DraftRow['status']) =>
        s === 'purchased' ? 0 : s === 'purchase_pending' ? 1 : 2;
      return rank(a.draft.status) - rank(b.draft.status);
    });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-terracotta/10 text-terracotta">
          <Music aria-hidden className="h-6 w-6" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Pakanta queue</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink/65">
            Each couple’s custom-song brief, auto-composed from the love story they told in
            onboarding plus any Pakanta music preferences. Copy the brief into Suno to write the
            song — no re-interview needed.
          </p>
        </div>
      </header>

      {queryError ? (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Couldn’t load the Pakanta queue ({queryError}). The table may not be migrated on this
          environment yet.
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-ink/10 bg-cream p-8 text-center">
          <Sparkles aria-hidden className="mx-auto mb-3 h-8 w-8 text-ink/30" strokeWidth={1.5} />
          <p className="text-sm font-medium text-ink">No Pakanta intakes yet.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink/60">
            When a couple orders Pakanta, their brief — built from the onboarding love story —
            appears here for the music team.
          </p>
        </div>
      ) : (
        <ul className="space-y-5">
          {rows.map(({ draft, brief }) => {
            const status = STATUS_LABEL[draft.status];
            return (
              <li
                key={draft.draft_id}
                className="rounded-xl border border-ink/10 bg-white p-5 shadow-sm"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold tracking-tight text-ink">
                    {brief.coupleNames}
                  </h2>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.cls}`}
                    >
                      {status.label}
                    </span>
                    <span className="text-xs text-ink/45">{relativeTime(draft.updated_at)}</span>
                  </div>
                </div>

                {brief.petNames ? (
                  <p className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink/70">
                    <Heart aria-hidden className="h-4 w-4 text-mulberry" strokeWidth={1.75} />
                    They call each other <span className="font-medium">{brief.petNames}</span>
                  </p>
                ) : null}

                {!brief.hasMaterial ? (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    No story material yet — the couple hasn’t finished the love-story onboarding or
                    a Pakanta intake.
                  </p>
                ) : (
                  <>
                    {brief.storyParagraphs.length > 0 ? (
                      <div className="mb-3">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink/45">
                          Their story
                        </p>
                        <ul className="space-y-1 text-sm text-ink/75">
                          {brief.storyParagraphs.map((p, i) => (
                            <li key={i}>• {p}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {brief.keyMoments.length > 0 ? (
                      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/70">
                        {brief.keyMoments.map((k, i) => (
                          <span key={i}>
                            <span className="text-ink/45">{k.label}:</span> {k.value}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <div className="mb-3 text-sm text-ink/70">
                      <span className="text-xs font-semibold uppercase tracking-wide text-ink/45">
                        Music
                      </span>
                      <div className="mt-1 space-y-0.5">
                        {brief.musicalDirection.moodFromTone ? (
                          <p>Mood: {brief.musicalDirection.moodFromTone}</p>
                        ) : null}
                        {brief.musicalDirection.favoriteSingers.length > 0 ? (
                          <p>
                            Reference artists (style only):{' '}
                            {brief.musicalDirection.favoriteSingers.join(', ')}
                          </p>
                        ) : null}
                        {brief.musicalDirection.musicType ? (
                          <p>Music type: {brief.musicalDirection.musicType}</p>
                        ) : null}
                        {brief.musicalDirection.suggestedFeel ? (
                          <p className="text-ink/55">
                            Suggested catalogue feel (couple left music blank):{' '}
                            {brief.musicalDirection.suggestedFeel}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {brief.extraWishes ? (
                      <p className="mb-3 text-sm text-ink/70">
                        <span className="text-ink/45">Extra wish:</span> {brief.extraWishes}
                      </p>
                    ) : null}
                  </>
                )}

                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-terracotta">
                    Copy-paste brief for Suno
                  </summary>
                  <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-ink/5 p-3 text-xs leading-relaxed text-ink/80">
                    {brief.copyBlock}
                  </pre>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
