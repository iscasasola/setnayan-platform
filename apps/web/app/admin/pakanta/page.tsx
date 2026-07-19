import { Music, Sparkles, Heart, CheckCircle2 } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { relativeTime } from '@/lib/activity';
import { ACTIVE_STATUSES, eventSkuActive, BUNDLE_CHILD_SKUS } from '@/lib/entitlements';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { resolveProfile } from '@/lib/event-type-profile';
import {
  composePakantaBrief,
  type LoveStoryBlob,
  type PakantaResponses,
  type StoryTone,
} from '@/lib/pakanta-brief';
import { PakantaDeliver } from './pakanta-deliver';

import { requireAdmin } from '@/lib/admin/require-admin';
export const metadata = { title: 'Pakanta queue · Admin' };

/**
 * /admin/pakanta — the back-office Pakanta songwriting + DELIVERY queue.
 *
 * The queue lists every couple the music team must write a song for, then lets
 * them UPLOAD the finished song right on the row. The candidate set is the UNION
 * of two sources, so a BUNDLE buyer with no intake draft is never invisible:
 *   1. Events with an APPROVED order granting PAKANTA — a direct PAKANTA order
 *      OR a bundle (MEDIA_PACK) that includes it. We seed candidates from
 *      orders, then confirm each with the bundle-aware eventSkuActive() gate.
 *   2. Events with a pakanta_intake_drafts row (the brief-collection surface).
 *
 * For each candidate we compose the SONG BRIEF from the ONBOARDING love story
 * (events.love_story) + any Pakanta music preferences (draft.responses) — see
 * lib/pakanta-brief.ts — and show the delivery state from the events.
 * pakanta_song_* columns. The music team copies the brief into Suno, writes the
 * song, and uploads it; the finished song auto-plays on the couple's site.
 *
 * Auth is enforced at the layout level (apps/web/app/admin/layout.tsx
 * notFound()s non-admins). Reads go through createAdminClient() (service role),
 * matching /admin/account-deletions + /admin/disputes. Every read of the new
 * pakanta_song_* columns graceful-degrades (42703/42P01 → not-delivered).
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
  event_type: string | null;
  display_name: string | null;
  love_story: LoveStoryBlob;
  story_tone: StoryTone;
  pakanta_song_r2_key: string | null;
  pakanta_song_status: 'in_production' | 'ready' | null;
  pakanta_song_filename: string | null;
  pakanta_song_adopted_as_site_music: boolean | null;
};

type RowStatus = 'delivered' | 'approved' | 'purchased' | 'purchase_pending' | 'draft';

const STATUS_LABEL: Record<RowStatus, { label: string; cls: string }> = {
  delivered: { label: 'Delivered ✓', cls: 'bg-success-100 text-success-800' },
  approved: { label: 'Approved — write the song', cls: 'bg-success-100 text-success-800' },
  purchased: { label: 'Purchased — write the song', cls: 'bg-success-100 text-success-800' },
  purchase_pending: { label: 'Purchase pending', cls: 'bg-warn-100 text-warn-800' },
  draft: { label: 'Draft (not ordered)', cls: 'bg-ink/5 text-ink/60' },
};

// The bundle codes that grant PAKANTA (MEDIA_PACK / "Complete"). Derived from the
// canonical BUNDLE_CHILD_SKUS so a re-bundle never silently drops a buyer here.
const BUNDLES_GRANTING_PAKANTA = (
  Object.entries(BUNDLE_CHILD_SKUS) as Array<[string, ReadonlyArray<string>]>
)
  .filter(([, children]) => children.includes('PAKANTA'))
  .map(([bundleKey]) => bundleKey);
const ORDER_KEYS_FOR_PAKANTA = ['PAKANTA', ...BUNDLES_GRANTING_PAKANTA];

export default async function AdminPakantaPage() {
  await requireAdmin();
  const admin = createAdminClient();
  let queryError: string | null = null;

  // ── Source 1: events with an APPROVED order granting PAKANTA (direct OR a
  // bundle). Seed candidate event_ids from active-status orders for any granting
  // key, then confirm each with the bundle-aware gate below. Graceful-degrade.
  const orderEventIds = new Set<string>();
  {
    const { data: orderData, error: orderErr } = await admin
      .from('orders')
      .select('event_id,service_key,status')
      .in('service_key', ORDER_KEYS_FOR_PAKANTA)
      .in('status', Array.from(ACTIVE_STATUSES))
      .limit(500);
    if (orderErr) {
      logQueryError('AdminPakantaPage (orders)', orderErr, {}, 'graceful_degrade');
    }
    for (const o of (orderData ?? []) as Array<{ event_id: string | null }>) {
      if (o.event_id) orderEventIds.add(o.event_id);
    }
  }

  // ── Source 2: intake drafts (brief-collection). Keyed for brief composition.
  const draftsByEvent = new Map<string, DraftRow>();
  {
    const { data: draftData, error: draftErr } = await admin
      .from('pakanta_intake_drafts')
      .select('draft_id,event_id,responses,status,updated_at')
      .order('updated_at', { ascending: false })
      .limit(200);
    if (draftErr) {
      logQueryError('AdminPakantaPage (drafts)', draftErr, {}, 'graceful_degrade');
      queryError = draftErr.message;
    }
    for (const d of (draftData ?? []) as DraftRow[]) {
      // Newest-first ordering means the first row per event is the latest.
      if (!draftsByEvent.has(d.event_id)) draftsByEvent.set(d.event_id, d);
    }
  }

  // Candidate event set = order-granted ∪ has-a-draft. Resolve each event's
  // names + love story + delivery state. pakanta_song_* graceful-degrades.
  const candidateIds = Array.from(new Set([...orderEventIds, ...draftsByEvent.keys()]));
  const eventsById = new Map<string, EventLite>();
  if (candidateIds.length > 0) {
    let { data: eventsData, error: eventsErr } = await admin
      .from('events')
      .select(
        'event_id,event_type,display_name,love_story,story_tone,pakanta_song_r2_key,pakanta_song_status,pakanta_song_filename,pakanta_song_adopted_as_site_music',
      )
      .in('event_id', candidateIds);
    if (eventsErr) {
      // New columns may not exist on this environment yet — retry without them.
      logQueryError('AdminPakantaPage (events delivery cols)', eventsErr, {}, 'graceful_degrade');
      const fallback = await admin
        .from('events')
        .select('event_id,event_type,display_name,love_story,story_tone')
        .in('event_id', candidateIds);
      eventsData = fallback.data as typeof eventsData;
      if (fallback.error) {
        logQueryError('AdminPakantaPage (events)', fallback.error, {}, 'graceful_degrade');
      }
    }
    for (const e of (eventsData ?? []) as Partial<EventLite>[]) {
      if (!e.event_id) continue;
      eventsById.set(e.event_id, {
        event_id: e.event_id,
        event_type: e.event_type ?? null,
        display_name: e.display_name ?? null,
        love_story: e.love_story ?? null,
        story_tone: e.story_tone ?? null,
        pakanta_song_r2_key: e.pakanta_song_r2_key ?? null,
        pakanta_song_status: e.pakanta_song_status ?? null,
        pakanta_song_filename: e.pakanta_song_filename ?? null,
        pakanta_song_adopted_as_site_music: e.pakanta_song_adopted_as_site_music ?? null,
      });
    }
  }

  // Confirm the entitlement per candidate (bundle-aware, admin-approved) and
  // build a render row per EVENT. Resolve a preview URL for delivered songs.
  const rows = (
    await Promise.all(
      candidateIds.map(async (eventId) => {
        const ev = eventsById.get(eventId);
        const draft = draftsByEvent.get(eventId) ?? null;

        // An event with an order seed must clear the active-entitlement gate to
        // appear (a refunded bundle drops out). Draft-only events still show so
        // the team sees in-progress briefs.
        const cameFromOrder = orderEventIds.has(eventId);
        const active = cameFromOrder ? await eventSkuActive(admin, eventId, 'PAKANTA') : false;
        if (cameFromOrder && !active && !draft) return null;

        // Iteration 0053: frame the brief by the event type ('couple' for a
        // wedding → byte-identical; 'host' etc. for other event types). The empty
        // coupleNames fallback lets the composer apply its organizer-aware default
        // ("The couple" for a wedding — unchanged).
        const organizerNoun = (await resolveProfile(ev?.event_type ?? 'wedding'))
          .terminology.organizerNoun;
        const brief = composePakantaBrief({
          coupleNames: ev?.display_name ?? '',
          loveStory: ev?.love_story ?? null,
          storyTone: ev?.story_tone ?? null,
          responses: draft?.responses ?? null,
          organizerNoun,
        });

        const delivered = ev?.pakanta_song_status === 'ready' && !!ev?.pakanta_song_r2_key;
        const previewUrl = delivered
          ? await displayUrlForStoredAsset(ev?.pakanta_song_r2_key).catch(() => null)
          : null;

        const status: RowStatus = delivered
          ? 'delivered'
          : active
            ? 'approved'
            : draft
              ? draft.status === 'purchased'
                ? 'purchased'
                : draft.status === 'purchase_pending'
                  ? 'purchase_pending'
                  : 'draft'
              : 'approved';

        return {
          eventId,
          brief,
          status,
          updatedAt: draft?.updated_at ?? null,
          delivered,
          previewUrl,
          deliveredFilename: ev?.pakanta_song_filename ?? null,
          adopted: ev?.pakanta_song_adopted_as_site_music === true,
          // Only let the team deliver when the entitlement is actually active —
          // a draft-only (unpaid) row shows the brief but no upload control.
          canDeliver: active,
        };
      }),
    )
  )
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => {
      const rank = (s: RowStatus) =>
        s === 'approved' || s === 'purchased' ? 0 : s === 'delivered' ? 1 : s === 'purchase_pending' ? 2 : 3;
      return rank(a.status) - rank(b.status);
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
        <div className="mb-6 rounded-lg border border-warn-300 bg-warn-50 px-4 py-3 text-sm text-warn-900">
          Couldn’t load the Pakanta queue ({queryError}). The table may not be migrated on this
          environment yet.
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="sn-tile p-8 text-center">
          <Sparkles aria-hidden className="mx-auto mb-3 h-8 w-8 text-ink/30" strokeWidth={1.5} />
          <p className="text-sm font-medium text-ink">No Pakanta orders yet.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink/60">
            When a couple buys Pakanta (on its own or inside a bundle), their brief — built from
            the onboarding love story — appears here for the music team to write and deliver.
          </p>
        </div>
      ) : (
        <ul className="space-y-5">
          {rows.map((row) => {
            const { eventId, brief } = row;
            const status = STATUS_LABEL[row.status];
            return (
              <li
                key={eventId}
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
                    {row.updatedAt ? (
                      <span className="text-xs text-ink/45">{relativeTime(row.updatedAt)}</span>
                    ) : null}
                  </div>
                </div>

                {brief.petNames ? (
                  <p className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink/70">
                    <Heart aria-hidden className="h-4 w-4 text-mulberry" strokeWidth={1.75} />
                    They call each other <span className="font-medium">{brief.petNames}</span>
                  </p>
                ) : null}

                {!brief.hasMaterial ? (
                  <p className="rounded-lg bg-warn-50 px-3 py-2 text-sm text-warn-800">
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

                {/* Delivered-song preview (when a finished song is on file). */}
                {row.delivered && row.previewUrl ? (
                  <div className="mt-4 rounded-xl border border-success-200 bg-success-50 p-4">
                    <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-success-800">
                      <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={2} />
                      Delivered{row.deliveredFilename ? ` — ${row.deliveredFilename}` : ''}
                      {row.adopted ? ' · playing on their site' : ' · couple kept their own song'}
                    </p>
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <audio controls preload="none" src={row.previewUrl} className="w-full" />
                  </div>
                ) : null}

                {/* Upload the finished song — only on an active (paid+approved) row. */}
                {row.canDeliver ? (
                  <PakantaDeliver
                    eventId={eventId}
                    alreadyDelivered={row.delivered}
                    deliveredFilename={row.deliveredFilename}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
