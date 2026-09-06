import { Lock } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { r2SignedGet, R2_BUCKETS } from '@/lib/r2';
import { parseR2Ref } from '@/lib/nsfw-screen';
import { visiblePortfolioPhotos, portfolioAlbumSummary } from '@/lib/vendor-papic-portfolio-album';
import { PortfolioImportForm } from './portfolio-import-form';

/**
 * "Your private portfolio" — a supplier's OWN imported work for THIS booked
 * event, spent out of their Papic credits. Deliberately its own section,
 * visibly separate from "What you've shot" (own-captures-strip.tsx) just
 * above it: that strip is the couple's gallery reflected back at the vendor
 * (their captures of somebody else's wedding, which the couple can also see
 * and take down); this album is never shown to the couple at all, lives under
 * its own storage prefix, and does not shrink when the couple moderates
 * anything of theirs.
 *
 * Read with the vendor's OWN client, never the admin one — same reasoning as
 * OwnCapturesStrip: the RLS policy (vendor_papic_portfolio_photos_vendor_read)
 * is the boundary, and a service-role read here would quietly replace it with
 * our own idea of one.
 */
export async function PortfolioAlbumSection({
  supabase,
  eventId,
  creditsLeft,
}: {
  supabase: SupabaseClient;
  eventId: string;
  /** null = unlimited (Unli tier); a number is what's left to spend. */
  creditsLeft: number | null;
}) {
  const { data, error } = await supabase
    .from('vendor_papic_portfolio_photos')
    .select('photo_id, event_id, r2_object_key, credits_spent, created_at, hidden_at, nsfw_checked')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(60);

  // A read failure must not read as "you've imported nothing" — same posture
  // as own-captures-strip.tsx.
  if (error) {
    return (
      <section className="mt-8 border-t pt-6" style={{ borderColor: 'var(--m-line)' }}>
        <p className="text-sm" style={{ color: 'var(--m-slate-2)' }}>
          Couldn&rsquo;t load your portfolio just now. Your photos are safe — this is only
          the view.
        </p>
      </section>
    );
  }

  const photos = visiblePortfolioPhotos(data ?? []);

  // Same ref-vs-key trap as own-captures-strip.tsx: r2_object_key is a stored
  // `r2://bucket/key` reference, not a bare key, and must be parsed before
  // signing or every tile 404s in the browser with green CI.
  const tiles = await Promise.all(
    photos.map(async (p) => {
      const { key } = parseR2Ref(p.r2Key);
      return {
        photo: p,
        url: await r2SignedGet({ bucket: R2_BUCKETS.media, key, expiresIn: 3600 }).catch(() => null),
      };
    }),
  );

  const canImport = creditsLeft == null || creditsLeft >= 1;

  return (
    <section className="mt-8 border-t pt-6" style={{ borderColor: 'var(--m-line)' }}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: 'var(--m-slate-3)' }}>
          Your private portfolio
        </h2>
        <p className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
          {portfolioAlbumSummary(photos)}
        </p>
      </div>
      <p className="mt-1 flex items-start gap-1.5 text-xs" style={{ color: 'var(--m-slate-3)' }}>
        <Lock aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        <span>
          Only you can see this — never the couple, never their guests. 1 Papic credit
          imports 1 photo.
        </span>
      </p>

      <PortfolioImportForm eventId={eventId} canImport={canImport} />

      {tiles.length > 0 ? (
        <ul className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {tiles.map(({ photo, url }) => (
            <li
              key={photo.photoId}
              className="relative aspect-square overflow-hidden rounded-lg bg-ink/10"
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
