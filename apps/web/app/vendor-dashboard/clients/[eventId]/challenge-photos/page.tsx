import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Trophy, ImageIcon, PlayCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { papicGamesEnabled } from '@/lib/papic-games-flag';
import { fetchVendorChallengePhotos } from '@/lib/papic-games';

export const metadata = { title: 'Challenge photos · Vendor' };
export const dynamic = 'force-dynamic';

// Papic Games — Phase 5: the sponsoring vendor collects the CONSENTED guest photos
// from their challenges. The RPC (papic_vendor_challenge_photos) is the gate —
// sponsored + consent_to_share + moderation clean + not hidden — and returns
// web-copy refs only; this page just presigns them (short TTL) into a grid.

type Tile = {
  captureId: string;
  isClip: boolean;
  tileUrl: string;
  openUrl: string;
};

export default async function VendorChallengePhotosPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  if (!papicGamesEnabled()) redirect(`/vendor-dashboard/clients/${eventId}`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // Booked-gate via the canonical vendor↔event brief RPC (also what the parent
  // client card uses); the photo RPC additionally requires a paid sponsorship.
  const { data: brief, error: briefErr } = await supabase.rpc('get_vendor_event_brief', {
    p_event_id: eventId,
  });
  if (briefErr || !brief) redirect('/vendor-dashboard/clients');

  const photos = await fetchVendorChallengePhotos(supabase, eventId).catch(() => []);

  // Group by challenge (mission), presigning each tile + open ref server-side.
  const groups = new Map<string, { prompt: string; tiles: Tile[] }>();
  for (const p of photos) {
    const isClip = p.media_type === 'clip';
    const tileRef = isClip
      ? (p.poster_r2_key ?? p.thumb_r2_key ?? p.display_r2_key)
      : (p.thumb_r2_key ?? p.display_r2_key);
    const openRef = isClip
      ? (p.clip_web_r2_key ?? p.display_r2_key ?? tileRef)
      : (p.display_r2_key ?? tileRef);
    const [tileUrl, openUrl] = await Promise.all([
      displayUrlForStoredAsset(tileRef, { ttlSeconds: 3600 }),
      displayUrlForStoredAsset(openRef, { ttlSeconds: 3600 }),
    ]);
    if (!tileUrl) continue; // no web copy → skip (never serve the raw original)
    const g = groups.get(p.mission_id) ?? { prompt: p.prompt, tiles: [] };
    g.tiles.push({ captureId: p.capture_id, isClip, tileUrl, openUrl: openUrl ?? tileUrl });
    groups.set(p.mission_id, g);
  }
  const sections = [...groups.values()];
  const total = sections.reduce((n, s) => n + s.tiles.length, 0);

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-6">
      <Link
        href={`/vendor-dashboard/clients/${eventId}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
        Back to client
      </Link>

      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-ink">
          <Trophy aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={2} />
          Challenge photos
        </h1>
        <p className="mt-1 text-sm text-ink/60">
          Guest photos and videos from the challenges you sponsored — only the ones a
          guest chose to share with you. Yours to use.
        </p>
      </header>

      {total === 0 ? (
        <div className="rounded-2xl border border-ink/10 bg-white p-8 text-center">
          <ImageIcon aria-hidden className="mx-auto h-8 w-8 text-ink/25" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-ink/55">
            No shared photos yet. They appear here as guests complete your challenges and
            tap “share” — once you’ve sponsored Papic Challenges for this event.
          </p>
        </div>
      ) : (
        sections.map((s, i) => (
          <div key={i} className="rounded-2xl border border-ink/10 bg-white p-5 sm:p-6">
            <p className="text-sm font-medium text-ink">{s.prompt}</p>
            <p className="mt-0.5 text-xs text-ink/45">
              {s.tiles.length} shared {s.tiles.length === 1 ? 'shot' : 'shots'}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {s.tiles.map((t) => (
                <a
                  key={t.captureId}
                  href={t.openUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block aspect-square overflow-hidden rounded-xl border border-ink/10 bg-ink/5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t.tileUrl}
                    alt="Shared guest photo"
                    className="h-full w-full object-cover transition group-hover:opacity-90"
                    loading="lazy"
                  />
                  {t.isClip ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-ink/20">
                      <PlayCircle aria-hidden className="h-8 w-8 text-white" strokeWidth={1.75} />
                    </span>
                  ) : null}
                </a>
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
