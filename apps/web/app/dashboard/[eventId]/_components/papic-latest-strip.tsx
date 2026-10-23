import Link from 'next/link';
import { ChevronRight, Clapperboard, Play } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchPapicGallery } from '@/lib/papic-gallery';
import { ActionButton } from '@/components/action-button';

/**
 * 📷 THE LATEST FIVE — the Papic widget's strip on Home (owner 2026-10-23): five small thumbnails, newest first, and
 * "See all" → the event's Memories tab. The compressed copies only (`compressedOnly`), five signed, never the page's
 * 360. After the day the widget's Add more becomes Thank-You Video, drawn here beside them.
 *
 * Nothing shot yet draws nothing — the row above already says "No photos yet". (A refused read is an empty list
 * from `fetchPapicGallery`; the row's own count is the honest number, so the strip simply stays away.)
 */
export async function PapicLatestStrip({ eventId, after }: { eventId: string; after: boolean }) {
  const supabase = await createClient();
  const photos = await fetchPapicGallery(supabase, eventId, { compressedOnly: true, limit: 5 }).catch(() => []);
  const thankYou = after ? (
    // 🍎 Web only — Home draws this strip only outside the store shell (`papicWidget`, page.tsx).
    <ActionButton
      tone="brand"
      icon={<Clapperboard aria-hidden="true" strokeWidth={1.9} />}
      label="Thank-You Video"
      href={`/dashboard/${eventId}/studio/thank-you`}
      data-web-only=""
    />
  ) : null;
  if (photos.length === 0) return thankYou ? <div className="flex">{thankYou}</div> : null;
  return (
    <div className="flex flex-col gap-2" data-papic-strip="">
      <div className="flex items-center gap-1.5">
        <ul className="grid min-w-0 flex-1 grid-cols-5 gap-1">
          {photos.map((p) => (
            <li key={p.id} className="relative aspect-square overflow-hidden rounded-md bg-ink/[0.06]">
              {p.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.url} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
              ) : null}
              {p.kind === 'clip' ? (
                <span aria-hidden className="absolute right-0.5 top-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-black/55 text-white">
                  <Play className="h-2 w-2 fill-current" strokeWidth={0} />
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        <Link
          href={`/dashboard/${eventId}/memories`}
          className="inline-flex shrink-0 items-center gap-0.5 text-[13px] font-medium text-mulberry"
          data-papic-strip-all=""
        >
          See all
          <ChevronRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </div>
      {thankYou ? <div className="flex">{thankYou}</div> : null}
    </div>
  );
}
