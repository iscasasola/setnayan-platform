import { Video } from 'lucide-react';

import { TemplateEmpty, TemplateFail, TemplateSection } from '@/app/_components/template-rows';

import { r2SignedGet, R2_BUCKETS } from '@/lib/r2';
import { parseR2Ref } from '@/lib/nsfw-screen';
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
  if (error) console.error('[supabase-error] app/vendor-dashboard/on-the-day/live/[eventId]/_components/own-captures-strip.tsx · from:vendor_papic_captures.select', error);

  // A read failure must not read as "you have taken nothing" — that is the same
  // value as an empty gallery and it would tell a vendor their work is gone.
  if (error) {
    return (
      <TemplateSection label="What you’ve shot" data="own-captures">
        <TemplateFail data="own-captures">
          Couldn&rsquo;t load what you&rsquo;ve shot just now. Your photos are safe — this is
          only the view.
        </TemplateFail>
      </TemplateSection>
    );
  }

  const captures = visibleVendorCaptures(data ?? []);
  if (captures.length === 0) {
    return (
      <TemplateSection label="What you’ve shot" data="own-captures">
        <TemplateEmpty data="own-captures">
          Nothing yet. A photo appears here a moment after you take it — it is checked
          first.
        </TemplateEmpty>
      </TemplateSection>
    );
  }

  // 🪤 THE STORED VALUE IS A REF, NOT A KEY. The capture route writes
  // `r2://setnayan-media/papic/...` into `r2_object_key` / `poster_r2_key`,
  // while the object itself lives at the bare `papic/...`. Handing the raw
  // column to `r2SignedGet` as an S3 Key produces a PERFECTLY VALID signed URL
  // for an object that does not exist — signing is offline, so nothing throws,
  // the `.catch` never fires, and every tile 404s in the browser instead.
  //
  // That is precisely how the first version of this strip shipped: green CI, a
  // grid of broken images. The couple's own gallery has always routed these two
  // columns through a parser; this was the one consumer that skipped it.
  //
  // Signed for an hour: long enough for a working shift, short enough that a
  // link copied out of the page dies the same night.
  const tiles = await Promise.all(
    captures.map(async (c) => {
      // The ref names its own bucket; ignore it and use the media bucket the
      // capture route actually writes to. Trusting a bucket name out of a
      // stored string would let a bad row point the signer anywhere.
      const { key } = parseR2Ref(c.tileKey);
      return {
        capture: c,
        url: await r2SignedGet({
          bucket: R2_BUCKETS.media,
          key,
          expiresIn: 3600,
        }).catch(() => null),
      };
    }),
  );

  return (
    <TemplateSection
      label="What you’ve shot"
      data="own-captures"
      right={captureSummary(captures)}
      tip="These are in the couple’s Memories too. If they take one down, it leaves here as well."
    >
      <ul className="mt-1 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        {tiles.map(({ capture, url }) => {
          const length = clipLengthLabel(capture);
          return (
            <li
              key={capture.captureId}
              className="relative aspect-square overflow-hidden rounded-lg bg-[color:var(--m-paper-2)]"
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

    </TemplateSection>
  );
}
