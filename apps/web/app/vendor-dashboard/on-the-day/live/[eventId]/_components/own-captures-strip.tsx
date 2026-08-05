import { Images, Video } from 'lucide-react';

import { r2SignedGet, R2_BUCKETS } from '@/lib/r2';
import {
  captureSummary,
  clipLengthLabel,
  visibleVendorCaptures,
} from '@/lib/vendor-own-captures';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * "What you shot" — a vendor looking back at their own captures.
 *
 * ── WHY THIS SITS UNDER THE CAMERA ──────────────────────────────────────────
 * Everything a vendor shoots goes into the COUPLE'S gallery, and until now the
 * vendor could never see it again. They pressed the shutter and the pictures
 * disappeared into someone else's album — no confirmation it worked, no way to
 * check a shot landed, nothing.
 *
 * It belongs directly beneath the shutter because that is where the doubt is:
 * on a dark reception floor, "did that upload?" is the question, and the answer
 * should be visible without leaving the screen.
 *
 * Read with the vendor's OWN client, never the admin one — the
 * `vendor_papic_captures_vendor_read` policy is the boundary, and using a
 * service-role client here would quietly replace it with our own idea of one.
 *
 * 🪤 A just-taken photo is briefly ABSENT, not briefly unscreened. The NSFW
 * check runs in the background after upload, and an unchecked frame is shown to
 * nobody — including the person who took it. The copy says so, because "my
 * photo is missing" is otherwise a support ticket.
 */
export async function OwnCapturesStrip({
  supabase,
  eventId,
}: {
  supabase: SupabaseClient;
  eventId: string;
}) {
  const { data, error } = await supabase
    .from('vendor_papic_captures')
    .select(
      'capture_id, event_id, r2_object_key, poster_r2_key, media_type, clip_duration_ms, captured_at, hidden_at, nsfw_checked',
    )
    .eq('event_id', eventId)
    .order('captured_at', { ascending: false })
    .limit(60);

  // A read failure must not read as "you have taken nothing" — that is the same
  // value as an empty gallery and it would tell a vendor their work is gone.
  if (error) {
    return (
      <section className="mt-6">
        <p className="text-sm" style={{ color: 'var(--m-slate-2)' }}>
          Couldn&rsquo;t load what you&rsquo;ve shot just now. Your photos are safe — this is
          only the view.
        </p>
      </section>
    );
  }

  const captures = visibleVendorCaptures(data ?? []);
  if (captures.length === 0) {
    return (
      <section className="mt-6">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: 'var(--m-slate-3)' }}>
          What you&rsquo;ve shot
        </h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--m-slate-2)' }}>
          Nothing yet. A photo appears here a moment after you take it — it is checked
          first.
        </p>
      </section>
    );
  }

  // Signed for an hour: long enough for a working shift, short enough that a
  // link copied out of the page dies the same night.
  const tiles = await Promise.all(
    captures.map(async (c) => ({
      capture: c,
      url: await r2SignedGet({
        bucket: R2_BUCKETS.media,
        key: c.tileKey,
        expiresIn: 3600,
      }).catch(() => null),
    })),
  );

  return (
    <section className="mt-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: 'var(--m-slate-3)' }}>
          What you&rsquo;ve shot
        </h2>
        <p className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
          {captureSummary(captures)}
        </p>
      </div>

      <ul className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        {tiles.map(({ capture, url }) => {
          const length = clipLengthLabel(capture);
          return (
            <li
              key={capture.captureId}
              className="relative aspect-square overflow-hidden rounded-lg bg-ink/10"
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : null}
              {capture.mediaType === 'clip' ? (
                <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-cream">
                  <Video aria-hidden className="h-3 w-3" strokeWidth={2} />
                  {length ?? 'Clip'}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      <p className="mt-3 flex items-start gap-1.5 text-xs" style={{ color: 'var(--m-slate-3)' }}>
        <Images aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        <span>
          These are in the couple&rsquo;s gallery too. If they take one down, it leaves here
          as well.
        </span>
      </p>
    </section>
  );
}
