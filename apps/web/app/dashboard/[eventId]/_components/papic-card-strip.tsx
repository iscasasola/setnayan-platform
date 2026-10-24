import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { memoriesRefs } from '@/lib/papic-display-ref';
import { formatCount } from '@/lib/format-number';
import type { PapicCardPhase } from '@/lib/papic-home-card';

/**
 * papic-card-strip.tsx — THE LATEST FIVE on Home's Papic card (owner 2026-10-23; approved
 * `prototypes/papic_controller_one_page_2026-10-23.html` "Home — the Papic widget"): four frames and "+N", then
 * "N in your Memories · latest first · See all ›" — every press opens the event's MEMORIES tab (Papic is the camera,
 * Memories the photos). The small compressed copy only (`memoriesRefs`), never a frame the content screen held back
 * or the host hid. Streamed under its own Suspense, so Home never waits on it. A refused read says so.
 */
export async function PapicCardStrip({
  eventId,
  total,
  phase,
}: {
  eventId: string;
  /** Home's own photo count (the glance) — null when not measured. */
  total: number | null;
  phase: PapicCardPhase | null;
}) {
  const supabase = await createClient();
  const [seat, guest] = await Promise.all([
    supabase
      .from('papic_photos')
      .select('photo_id, photo_type, thumb_r2_key, tile_r2_key, display_r2_key, poster_r2_key, captured_at')
      .eq('event_id', eventId)
      .is('hidden_at', null)
      // Not past its `expires_at` — the same rule the Memories grid and its count keep (`lib/papic-gallery.ts`).
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      // 🧼 'clean' only — the screen PASSED (relay 2026-10-23); 'unscreened' is unseen, not safe.
      .eq('moderation_state', 'clean')
      .order('captured_at', { ascending: false })
      .limit(5),
    supabase
      .from('papic_guest_captures')
      .select('capture_id, media_type, thumb_r2_key, tile_r2_key, display_r2_key, poster_r2_key, captured_at')
      .eq('event_id', eventId)
      .is('hidden_at', null)
      .eq('moderation_state', 'clean')
      .order('captured_at', { ascending: false })
      .limit(5),
  ]);
  if (seat.error) logQueryError('PapicCardStrip.seat', seat.error, { eventId }, 'graceful_degrade');
  if (guest.error) logQueryError('PapicCardStrip.guest', guest.error, { eventId }, 'graceful_degrade');
  if (seat.error || guest.error) return <PapicCardStripView eventId={eventId} frames={null} total={total} phase={phase} />;
  type Row = { id: string; at: string; ref: string | null };
  const rows: Row[] = [
    ...(seat.data ?? []).map((r) => ({ id: r.photo_id as string, at: r.captured_at as string, ref: memoriesRefs(r as Parameters<typeof memoriesRefs>[0]).grid })),
    ...(guest.data ?? []).map((r) => ({ id: r.capture_id as string, at: r.captured_at as string, ref: memoriesRefs(r as Parameters<typeof memoriesRefs>[0]).grid })),
  ]
    .filter((r) => r.ref)
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 5);
  const frames = await Promise.all(rows.map(async (r) => ({ id: r.id, url: await displayUrlForStoredAsset(r.ref!) })));
  return <PapicCardStripView eventId={eventId} frames={frames} total={total} phase={phase} />;
}

const EMPTY_FRAME = 'block aspect-square rounded-lg border border-dashed border-ink/20 bg-ink/[0.03]'; // no-card-ok: an empty photo frame the sketch draws (a placeholder tile, not a section box)

/** The strip as drawn — `frames` null = the read was refused (said, never an empty strip). */
export function PapicCardStripView({
  eventId,
  frames,
  total,
  phase,
}: {
  eventId: string;
  frames: { id: string; url: string | null }[] | null;
  total: number | null;
  phase: PapicCardPhase | null;
}) {
  if (frames === null) {
    return (
      <p role="status" className="mt-2 text-[12.5px] text-ink/60" data-papic-strip="refused">
        Couldn’t load your photos — nothing has changed
      </p>
    );
  }
  if (frames.length === 0) {
    // 🖼 THE SKETCH'S EMPTY ROW (approved 2026-10-24): five empty dashed frames and one line — the same row the photos
    // fill, latest first, once they come. The card's status line then says no "No photos yet" of its own.
    return (
      <div className="mt-2" data-papic-strip="empty">
        <div className="grid grid-cols-5 gap-1.5" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={EMPTY_FRAME} />
          ))}
        </div>
        <p className="mt-1.5 text-[12.5px] text-ink/60">Frames fill as your guests shoot</p>
      </div>
    );
  }
  const memories = `/dashboard/${eventId}/memories`;
  // Five tiles: all five frames, or four and "+N" for the rest (N counts everything not drawn).
  const overflow = total !== null && total > frames.length;
  const drawn = frames.slice(0, overflow ? 4 : 5);
  const more = overflow ? total! - drawn.length : 0;
  return (
    <div className="mt-2" data-papic-strip="">
      <div className="grid grid-cols-5 gap-1.5">
        {drawn.map((f) => (
          <Link key={f.id} href={memories} aria-label="Open your Memories" className="block aspect-square overflow-hidden rounded-lg bg-ink/[0.06]">
            {f.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            ) : null}
          </Link>
        ))}
        {more > 0 ? (
          <Link
            href={memories}
            aria-label={`${formatCount(more)} more in your Memories`}
            className="grid aspect-square place-items-center rounded-lg bg-ink/[0.06] text-[12px] font-semibold text-terracotta"
          >
            +{formatCount(more)}
          </Link>
        ) : null}
      </div>
      <p className="mt-1.5 flex items-center justify-between gap-2 text-[12.5px] text-ink/60">
        <span className="min-w-0 truncate">
          {total !== null ? (
            <>
              <b className="font-semibold text-ink">{formatCount(total)}</b> in your Memories · latest first
            </>
          ) : (
            'In your Memories · latest first'
          )}
        </span>
        <Link href={memories} className="shrink-0 font-medium text-terracotta" data-papic-see-all="">
          See all ›
        </Link>
      </p>
    </div>
  );
}
