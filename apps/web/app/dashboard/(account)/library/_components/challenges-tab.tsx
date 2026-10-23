import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { memoriesRefs } from '@/lib/papic-display-ref';
import { challengeGroups, type MemoriesChallenge } from '@/lib/event-memories';
import { formatCount } from '@/lib/format-number';
import { InfoTip } from '@/app/_components/info-tip';
import type { Album } from '../_data/photos-albums';
import { MEMORIES_HEADING, MemoriesUnreadable } from './memories-chapters';

/**
 * challenges-tab.tsx — MEMORIES › CHALLENGES, ACROSS YOUR EVENTS (owner 2026-10-23: *"on the memories. a place for the
 * papic challenges also. how they are categorized"*; controller's call: the same album as an event's Memories, and
 * at account level it lists only the events that had challenges). One gold chapter per event you host, then one
 * heading per challenge in that event's board order ("title · count"; a supplier's challenge names its supplier in
 * the ⓘ), then the frames — the small compressed copy only, never anything the content screen held back or the host
 * hid. A frame opens that event's Memories.
 *
 * The link is the one that exists: a challenge answer is a guest capture, `papic_mission_completions.capture_id`.
 */
export async function ChallengesTab({ albums }: { albums: Album[] }) {
  const hosted = albums.filter((a) => a.role === 'couple');
  if (hosted.length === 0) {
    return <p className="px-1 pt-4 text-[14px] text-ink/60">Challenges from the events you host land here.</p>;
  }
  const ids = hosted.map((a) => a.event.event_id);
  const supabase = await createClient();
  const [missionsRes, completionsRes] = await Promise.all([
    supabase
      .from('papic_missions')
      .select('mission_id, event_id, prompt, source, vendor_id, board_slot')
      .in('event_id', ids)
      .eq('approved', true)
      .order('board_slot', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true }),
    supabase.from('papic_mission_completions').select('mission_id, event_id, capture_id').in('event_id', ids).not('capture_id', 'is', null),
  ]);
  if (missionsRes.error || completionsRes.error) {
    if (missionsRes.error) logQueryError('ChallengesTab.missions', missionsRes.error, {}, 'graceful_degrade');
    if (completionsRes.error) logQueryError('ChallengesTab.completions', completionsRes.error, {}, 'graceful_degrade');
    return <MemoriesUnreadable what="memories" />;
  }
  const completions = (completionsRes.data ?? []) as { mission_id: string; event_id: string; capture_id: string }[];
  if (completions.length === 0) {
    return <p className="px-1 pt-4 text-[14px] text-ink/60">No challenge photos yet. When your guests answer a challenge, the photos gather here, by challenge.</p>;
  }
  const capRes = await supabase
    .from('papic_guest_captures')
    .select('capture_id, event_id, media_type, thumb_r2_key, tile_r2_key, display_r2_key, poster_r2_key, clip_web_r2_key, full_res_dropped_at, r2_object_key, moderation_state, hidden_at')
    .in('capture_id', completions.map((c) => c.capture_id));
  if (capRes.error) {
    logQueryError('ChallengesTab.captures', capRes.error, {}, 'graceful_degrade');
    return <MemoriesUnreadable what="memories" />;
  }
  // The screening rule holds here too: a frame the screen held back, or the host hid, is never drawn.
  const shownCaps = new Map(
    (capRes.data ?? [])
      .filter((c) => c.moderation_state !== 'nsfw_blocked' && !c.hidden_at)
      .map((c) => [c.capture_id as string, c]),
  );
  const vendorIds = [...new Set(((missionsRes.data ?? []) as { source: string | null; vendor_id: string | null }[]).filter((m) => m.source === 'vendor' && m.vendor_id).map((m) => m.vendor_id as string))];
  const { data: vendorRows } = vendorIds.length
    ? await supabase.from('event_vendors').select('vendor_id, vendor_name').in('vendor_id', vendorIds)
    : { data: [] as { vendor_id: string; vendor_name: string | null }[] };
  const vendorName = new Map((vendorRows ?? []).map((v) => [v.vendor_id as string, (v.vendor_name as string | null) ?? null]));

  const chapters = await Promise.all(
    hosted.map(async (album) => {
      const eventId = album.event.event_id;
      const board: MemoriesChallenge[] = ((missionsRes.data ?? []) as { mission_id: string; event_id: string; prompt: string | null; source: string | null; vendor_id: string | null }[])
        .filter((m) => m.event_id === eventId)
        .map((m) => ({ id: m.mission_id, title: (m.prompt ?? '').trim() || 'A challenge', supplier: m.source === 'vendor' && m.vendor_id ? (vendorName.get(m.vendor_id) ?? null) : null }));
      const items = await Promise.all(
        completions
          .filter((c) => c.event_id === eventId && shownCaps.has(c.capture_id))
          .map(async (c) => {
            const cap = shownCaps.get(c.capture_id)!;
            const ref = memoriesRefs(cap as Parameters<typeof memoriesRefs>[0]).grid;
            return { id: c.capture_id, challengeId: c.mission_id, url: ref ? await displayUrlForStoredAsset(ref) : null, clip: cap.media_type === 'clip' };
          }),
      );
      return { album, groups: challengeGroups(items, board) };
    }),
  );
  const withAny = chapters.filter((c) => c.groups.length > 0);
  if (withAny.length === 0) {
    return <p className="px-1 pt-4 text-[14px] text-ink/60">No challenge photos yet. When your guests answer a challenge, the photos gather here, by challenge.</p>;
  }
  return (
    <div className="pt-2" data-memories-body="challenges">
      {withAny.map(({ album, groups }) => (
        <section key={album.event.event_id} data-memories-chapter-event={album.event.event_id}>
          <h3 className={`mt-3 min-h-[44px] content-center truncate ${MEMORIES_HEADING}`}>{album.event.display_name}</h3>
          {groups.map(({ challenge, items }) => (
            <div key={challenge.id} className="pb-3" data-memories-challenge={challenge.id}>
              <div className="flex min-h-[40px] items-center">
                {challenge.supplier ? (
                  <InfoTip label={`${challenge.title} · ${formatCount(items.length)}`} labelClassName="text-[14.5px] font-semibold text-ink" align="start">
                    Added by {challenge.supplier}, a supplier you booked.
                  </InfoTip>
                ) : (
                  <span className="truncate text-[14.5px] font-semibold text-ink">{`${challenge.title} · ${formatCount(items.length)}`}</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                {items.map((it) => (
                  <Link
                    key={it.id}
                    href={`/dashboard/${album.event.event_id}/memories`}
                    aria-label={`${it.clip ? 'Clip' : 'Photo'} — ${challenge.title}`}
                    className="relative block aspect-square overflow-hidden rounded-xl bg-ink/[0.06]"
                    data-memories-tile=""
                  >
                    {it.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.url} alt="" className="h-full w-full object-cover" loading="lazy" draggable={false} />
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
