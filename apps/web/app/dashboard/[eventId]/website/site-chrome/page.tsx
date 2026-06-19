import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Music, Video } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { FileUpload } from '@/app/_components/file-upload';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { updateSiteChrome } from './actions';
import { SubmitButton } from '@/app/_components/submit-button';

export const metadata = { title: 'Music & video hero · Setnayan' };

/**
 * /dashboard/[eventId]/website/site-chrome — looping background music + a
 * video hero (Increment B · Wedding_Website_Lifecycle_Spec_2026-06-07 §6.2).
 * Writes the chrome columns from the lifecycle foundation. The page reads them
 * back to seed the uploaders + the enable toggle. Audio/video bytes upload via
 * the shared <FileUpload> → /api/upload (Increment B widened its MIME
 * whitelist + per-type size caps). Music never autoplays — guests tap a
 * visible control to start it.
 */
export default async function SiteChromeEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { eventId } = await params;
  const search = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { data: event } = await supabase
    .from('events')
    .select(
      'event_id, display_name, slug, site_bg_music_r2_key, site_bg_music_enabled, landing_page_hero_video_r2_key',
    )
    .eq('event_id', eventId)
    .maybeSingle();

  if (!event) redirect(`/dashboard/${eventId}`);

  const musicRef =
    typeof event.site_bg_music_r2_key === 'string' && event.site_bg_music_r2_key.startsWith('r2://')
      ? event.site_bg_music_r2_key
      : null;
  const videoRef =
    typeof event.landing_page_hero_video_r2_key === 'string' &&
    event.landing_page_hero_video_r2_key.startsWith('r2://')
      ? event.landing_page_hero_video_r2_key
      : null;
  const musicEnabled = event.site_bg_music_enabled === true;

  const [musicUrl, videoUrl] = await Promise.all([
    musicRef ? displayUrlForStoredAsset(musicRef) : Promise.resolve(null),
    videoRef ? displayUrlForStoredAsset(videoRef) : Promise.resolve(null),
  ]);
  const musicDisplay: Record<string, string> = {};
  if (musicRef && musicUrl) musicDisplay[musicRef] = musicUrl;
  const videoDisplay: Record<string, string> = {};
  if (videoRef && videoUrl) videoDisplay[videoRef] = videoUrl;

  const updateAction = updateSiteChrome.bind(null, eventId);
  const saved = search.saved === '1';
  const error = search.error;

  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <Link
          href={`/dashboard/${eventId}/website`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-terracotta hover:text-terracotta-700"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Back to website
        </Link>
        <div>
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
            <Music aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Music &amp; video hero
          </p>
          <h1 className="mt-1 font-serif text-3xl italic tracking-tight sm:text-4xl">
            Set the mood
          </h1>
          <p className="mt-2 max-w-prose text-sm text-ink/65">
            Add a soft background song and a short video behind your monogram.
            Both are optional — leave either empty to keep things simple.
          </p>
        </div>

        {saved ? (
          <div
            role="status"
            className="inline-flex items-center gap-2 rounded-md border border-success-300/60 bg-success-50 px-3 py-2 text-sm text-success-800"
          >
            <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Saved — your guests will see this on the wedding website.
          </div>
        ) : null}
        {error ? (
          <div
            role="alert"
            className="rounded-md border border-red-300/60 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </div>
        ) : null}
      </header>

      <form action={updateAction} className="space-y-8">
        {/* Background music */}
        <fieldset className="space-y-3 rounded-2xl border border-ink/10 bg-cream/40 p-5">
          <legend className="flex items-center gap-2 px-1 font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            <Music aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Background music
          </legend>
          <p className="text-sm text-ink/60">
            A looping song while guests browse. It never plays on its own — a
            small “Play music” button lets each guest start or pause it.
          </p>
          <FileUpload
            bucket="media"
            pathPrefix={`events/${eventId}/site-music`}
            name="bg_music_url"
            multiple={false}
            maxSizeMB={20}
            acceptedTypes={['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav']}
            currentValue={musicRef}
            initialDisplayUrls={musicDisplay}
            variant="wide"
            label="Song file"
            help="MP3, M4A, AAC, OGG, or WAV. Up to 20 MB."
          />
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="bg_music_enabled"
              defaultChecked={musicEnabled}
              className="h-4 w-4 rounded border-ink/30 text-terracotta focus:ring-terracotta"
            />
            Turn background music on for guests
          </label>
        </fieldset>

        {/* Video hero */}
        <fieldset className="space-y-3 rounded-2xl border border-ink/10 bg-cream/40 p-5">
          <legend className="flex items-center gap-2 px-1 font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            <Video aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Video hero
          </legend>
          <p className="text-sm text-ink/60">
            A short, silent clip that loops behind your monogram instead of a
            still photo. Keep it brief and lightly compressed. If you set both a
            hero photo and a video, the video wins (the photo becomes its
            first-frame poster).
          </p>
          <FileUpload
            bucket="media"
            pathPrefix={`events/${eventId}/hero-video`}
            name="hero_video_url"
            multiple={false}
            maxSizeMB={60}
            acceptedTypes={['video/mp4', 'video/webm', 'video/quicktime']}
            currentValue={videoRef}
            initialDisplayUrls={videoDisplay}
            variant="wide"
            label="Hero video"
            help="MP4, WebM, or MOV. Up to 60 MB. Short loops work best."
          />
        </fieldset>

        <SubmitButton pendingLabel="Saving…" className="button-primary">Save music &amp; video</SubmitButton>
      </form>
    </section>
  );
}
