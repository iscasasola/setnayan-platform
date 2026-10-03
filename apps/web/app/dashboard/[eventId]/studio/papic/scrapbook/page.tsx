import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPapicGallery } from '@/lib/papic-gallery';
import { readCoupleUploadsCamera } from '@/lib/papic-uploads-camera';
import { logQueryError } from '@/lib/supabase/error-detect';
import { ScrapbookMaker, type ScrapbookPhoto } from '@/app/_components/scrapbook/scrapbook-maker';
import type { SaveTarget } from '@/lib/scrapbook/scrapbook-save';

/**
 * Kwento scrapbook page — the COUPLE's door (owner 2026-10-03: "both get it").
 *
 * The same maker a guest opens from /papic/decorate?make=scrapbook, fed from
 * the whole event gallery (what the Papic studio's gallery grid shows, at its
 * lightbox size) and saved through the couple's own UPLOADS camera — exactly
 * the door "Add to your library" uses, so a saved page costs one Papic credit
 * like any uploaded photo, and downloading one costs nothing.
 *
 * When the uploads camera is not theirs to use (switched off, or not claimed by
 * this user) the page still works: it says why it cannot save and where to fix
 * it, and keeping the page on the phone stays free.
 */

export const metadata = { title: 'Scrapbook page' };
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ eventId: string }> };

export default async function CoupleScrapbookPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('event_id, display_name')
    .eq('event_id', eventId)
    .maybeSingle();
  if (eventError) logQueryError('CoupleScrapbookPage.event', eventError, { eventId }, 'graceful_degrade');
  if (!event) notFound();

  const papicHref = `/dashboard/${eventId}/studio/papic`;

  // The couple's own switch for hand-added photos. Read on its own round trip
  // and falling OPEN on a refused read, exactly as the Papic page reads it.
  const { data: uploadsRow, error: uploadsRowError } = await supabase
    .from('events')
    .select('papic_uploads_open')
    .eq('event_id', eventId)
    .maybeSingle();
  if (uploadsRowError) logQueryError('CoupleScrapbookPage.uploadsRow', uploadsRowError, { eventId }, 'graceful_degrade');
  const uploadsOpen = ((uploadsRow as { papic_uploads_open?: boolean | null } | null)?.papic_uploads_open ?? true) !== false;

  const [gallery, uploads] = await Promise.all([
    fetchPapicGallery(supabase, eventId),
    readCoupleUploadsCamera(createAdminClient(), eventId, user.id, 'CoupleScrapbookPage.uploadsCamera'),
  ]);

  const photos: ScrapbookPhoto[] = gallery
    .filter((p) => p.kind === 'photo' && (p.viewUrl || p.url))
    .map((p) => ({ id: p.id, url: (p.viewUrl ?? p.url)!, thumbUrl: p.url }));

  // 🔴 fetchPapicGallery reads a refused query as an EMPTY gallery. An empty
  // gallery is a real answer for a new event, so before the page says "nothing
  // yet", ask once whether the two tables answered at all. (Only an ERROR counts:
  // rows that exist but are hidden, blocked or clips are rightly not offered.)
  let photosRead: 'ok' | 'unavailable' = 'ok';
  if (photos.length === 0) {
    const [seat, guest] = await Promise.all([
      supabase.from('papic_photos').select('photo_id', { head: true, count: 'exact' }).eq('event_id', eventId),
      supabase.from('papic_guest_captures').select('capture_id', { head: true, count: 'exact' }).eq('event_id', eventId),
    ]);
    const refused = seat.error ?? guest.error;
    if (refused) {
      photosRead = 'unavailable';
      logQueryError('CoupleScrapbookPage.galleryProbe', refused, { eventId }, 'graceful_degrade');
    }
  }

  const saveTarget: SaveTarget = !uploadsOpen
    ? {
        kind: 'none',
        reason: 'Adding photos by hand is switched off for this celebration, so pages can’t go into the gallery.',
        href: papicHref,
        hrefLabel: 'Turn “Your uploads” on in Papic',
      }
    : uploads.token
      ? { kind: 'couple', uploadsToken: uploads.token }
      : {
          kind: 'none',
          reason: 'To save pages to your gallery, open “Your uploads” in Papic and turn it on first.',
          href: papicHref,
          hrefLabel: 'Open Papic',
        };

  return (
    <ScrapbookMaker
      eventName={(event.display_name as string | null) || 'your celebration'}
      who="couple"
      photos={photos}
      photosRead={photosRead}
      saveTarget={saveTarget}
      backHref={papicHref}
      backLabel="Back to Papic"
      inShell
    />
  );
}
