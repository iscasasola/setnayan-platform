import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Check, Sparkles, Stamp } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { sealColorFromPalette, veilColorFromPalette } from '@/lib/site-palette';
import { fallbackSeedFromPublicId, sanitizeWaxSealConfig } from '@/lib/wax-seal/types';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { resolveStdFilmContent } from '@/lib/save-the-date-content';
import { resolveStdTheme } from '@/lib/std-themes';
import { resolveRevealEffects } from '@/lib/std-reveal-effects';
import { resolveStdBackground } from '@/lib/std-backgrounds';
import { resolveStdMedia } from '@/lib/std-media';
import { REVEAL_TEMPLATE_IDS, fetchRevealConfig } from '@/lib/reveal-config';
import {
  NO_REVEAL,
  type RevealTemplate,
  type RevealChoice,
} from '@/app/[slug]/_components/reveal/reveal-templates';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { formatPhp } from '@/lib/orders';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { InlineCheckoutDrawer } from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';
import {
  eventOwnsStdOpenings,
  STD_PREMIUM_OPENINGS_SERVICE_KEY,
} from '@/lib/std-openings';
import { StdBuilderClient } from './_components/StdBuilderClient';

// 2026-06-19 — builder redesign: the 5-step builder (1 Background [+ theme:
// fonts/colours] · 2 Content · 3 Video/Gallery · 4 Music · 5 Opening/reveal) +
// a live preview that updates in real time, and ONE Render button that saves
// everything in a single write. The old per-field form rows (each with their own
// Save button + redirect) are replaced by this client-driven builder; server
// still resolves the initial data + presigned media URLs.

export const metadata = { title: 'Save the Date · Setnayan' };

type Props = {
  params: Promise<{ eventId: string }>;
};

function coerceTemplate(v: unknown): RevealChoice | null {
  if (v === NO_REVEAL) return NO_REVEAL; // the couple's explicit "No Reveal"
  return typeof v === 'string' && (REVEAL_TEMPLATE_IDS as readonly string[]).includes(v)
    ? (v as RevealTemplate)
    : null;
}

export default async function SaveTheDatePage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase
    .from('events')
    .select(
      'public_id, slug, display_name, event_date, venue_name, venue_address, love_story, monogram_text, monogram_custom_svg, monogram_uploaded_svg, role_palette, wax_seal_config, std_reveal_template, std_reveal_effects, std_invitation_launch_date, std_theme, std_film_date, std_film_venue_name, std_film_venue_city, std_film_story, std_background, std_media, our_photos, site_bg_music_enabled, site_bg_music_r2_key, landing_page_hero_image_url',
    )
    .eq('event_id', eventId)
    .maybeSingle();

  const markSvg =
    (typeof event?.monogram_uploaded_svg === 'string' && event.monogram_uploaded_svg.trim()
      ? event.monogram_uploaded_svg
      : null) ??
    (typeof event?.monogram_custom_svg === 'string' && event.monogram_custom_svg.trim()
      ? event.monogram_custom_svg
      : null);

  const palette = sanitizeRolePalette(event?.role_palette);
  const waxColor = sealColorFromPalette(palette);
  const veilColor = veilColorFromPalette(palette);
  const sealConfig = sanitizeWaxSealConfig(event?.wax_seal_config);
  const sealFallbackSeed = fallbackSeedFromPublicId(event?.public_id);
  const hasMintedSeal = sealConfig !== null;
  const chosenTemplate = coerceTemplate(event?.std_reveal_template);
  const themeId = resolveStdTheme(event?.std_theme);
  const effects = resolveRevealEffects(event?.std_reveal_effects);
  const stdBackground = resolveStdBackground(event?.std_background, veilColor);
  const stdBackgroundUploadUrl =
    stdBackground.kind === 'upload' ? await displayUrlForStoredAsset(stdBackground.value) : null;
  const stdMedia = resolveStdMedia(event?.std_media);
  const stdMediaVideoUrl =
    stdMedia.type === 'video' && stdMedia.videoKey
      ? await displayUrlForStoredAsset(stdMedia.videoKey)
      : null;

  const [ownsOpenings, openingsSku, settings, revealConfig] = await Promise.all([
    eventOwnsStdOpenings(supabase, eventId),
    formatV2Sku(STD_PREMIUM_OPENINGS_SERVICE_KEY).catch(() => null),
    fetchPlatformSettings(supabase),
    fetchRevealConfig(),
  ]);
  const openingsPricePhp = openingsSku?.price_php ?? null;

  // Presigned media — resolved server-side once; passed as initial content to
  // the client builder (so presigned URLs never expire mid-session).
  const bgMusicUrl =
    event?.site_bg_music_enabled && event.site_bg_music_r2_key
      ? await displayUrlForStoredAsset(event.site_bg_music_r2_key)
      : null;
  const heroPhotoUrl = await displayUrlForStoredAsset(event?.landing_page_hero_image_url);
  const ourPhotoRefs = Array.isArray(event?.our_photos)
    ? (event.our_photos as unknown[]).filter(
        (r): r is string => typeof r === 'string' && r.trim().length > 0,
      )
    : [];
  const ourPhotoUrls = (
    await Promise.all(ourPhotoRefs.map((ref) => displayUrlForStoredAsset(ref)))
  ).filter((u): u is string => Boolean(u));
  const galleryUrls = ourPhotoUrls.length ? ourPhotoUrls : heroPhotoUrl ? [heroPhotoUrl] : [];

  // Content snapshot (std_film_*) overrides live event columns when set —
  // lets the couple finalize their film content independently of subsequent
  // edits to the event date/venue/story.
  const stdDate =
    typeof event?.std_film_date === 'string' ? event.std_film_date.slice(0, 10) : null;
  const stdVenueName: string | null = event?.std_film_venue_name ?? null;
  const stdVenueCity: string | null = event?.std_film_venue_city ?? null;
  const stdStory: string | null = event?.std_film_story ?? null;

  const content = resolveStdFilmContent({
    displayName: event?.display_name ?? '',
    monogramText: event?.monogram_text,
    monogramSvg: markSvg,
    dateIso: stdDate ?? event?.event_date ?? null,
    launchDateIso: event?.std_invitation_launch_date,
    venueName: stdVenueName ?? event?.venue_name,
    venueAddress: stdVenueCity ?? event?.venue_address,
    loveStory: stdStory ?? event?.love_story,
    publicId: event?.public_id ?? eventId,
    musicUrl: bgMusicUrl,
    galleryUrls,
  });

  const launchDate =
    typeof event?.std_invitation_launch_date === 'string'
      ? event.std_invitation_launch_date.slice(0, 10)
      : '';


  return (
    <section className="space-y-8">
      <Link
        href={`/dashboard/${eventId}/add-ons`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to add-ons
      </Link>

      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Save the Date</h1>
        <p className="max-w-prose text-base text-ink/65">
          Your Save the Date plays as a short, self-running film — it fills itself from what
          you&rsquo;ve already added. Set the scene, fine-tune the details, add your video and
          song, choose how it opens — then hit Render.
        </p>
      </header>

      {/* Premium openings unlock */}
      {ownsOpenings ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50/60 px-5 py-4">
          <Check aria-hidden className="h-5 w-5 shrink-0 text-emerald-600" strokeWidth={2.5} />
          <p className="text-sm text-emerald-800">
            <span className="font-medium">Cinematic openings unlocked.</span> Your chosen opening
            lifts to reveal your page on your live site.
          </p>
        </div>
      ) : openingsPricePhp != null && openingsPricePhp > 0 ? (
        <section className="space-y-3 rounded-2xl border border-mulberry/20 bg-mulberry/5 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <Sparkles
              aria-hidden
              className="mt-0.5 h-5 w-5 shrink-0 text-mulberry"
              strokeWidth={1.75}
            />
            <div className="space-y-1">
              <h2 className="font-serif text-lg italic">Make your opening play live</h2>
              <p className="max-w-prose text-sm text-ink/70">
                Your film is free. Add a{' '}
                <span className="font-medium text-ink">cinematic opening</span> — a veil or
                envelope that lifts to reveal your page — and it plays for every guest who opens
                your link.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink/65">
              One price for your wedding ·{' '}
              <span className="font-mono text-base text-ink">{formatPhp(openingsPricePhp)}</span>
            </p>
            <InlineCheckoutDrawer
              eventId={eventId}
              serviceKey={STD_PREMIUM_OPENINGS_SERVICE_KEY}
              displayName={`Save-the-Date Cinematic Openings${
                event?.display_name ? ` · ${event.display_name}` : ''
              }`}
              originalPriceCentavos={String(Math.round(openingsPricePhp * 100))}
              settings={settings}
              triggerLabel="Unlock the openings"
              triggerClassName="inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600 disabled:opacity-70 sm:w-auto"
            />
          </div>
        </section>
      ) : (
        <p className="rounded-2xl border border-ink/10 bg-white/60 px-5 py-4 text-sm text-ink/55">
          The cinematic openings are being set up — check back shortly.
        </p>
      )}

      {/* Three-step live builder */}
      <StdBuilderClient
        eventId={eventId}
        slug={event?.slug ?? null}
        initialContent={content}
        initialThemeId={themeId}
        initialLaunchDate={launchDate}
        initialRevealTemplate={chosenTemplate}
        initialEffects={effects}
        initialBackground={stdBackground}
        initialUploadUrl={stdBackgroundUploadUrl}
        initialMedia={stdMedia}
        initialVideoUrl={stdMediaVideoUrl}
        galleryCount={ourPhotoUrls.length}
        initialFilmDate={stdDate}
        initialFilmVenueName={stdVenueName}
        initialFilmVenueCity={stdVenueCity}
        initialFilmStory={stdStory}
        displayName={event?.display_name ?? ''}
        dateIso={event?.event_date ?? null}
        markSvg={markSvg}
        waxColor={waxColor}
        sealConfig={sealConfig}
        sealFallbackSeed={sealFallbackSeed}
        veilColor={veilColor}
        petalsColor={revealConfig.petalsColor}
        veilLook={revealConfig.veil}
        effectLook={revealConfig.effects}
        allowedTemplates={revealConfig.templates}
      />

      {/* Wax seal */}
      <div className="pt-2">
        <Link
          href={`/dashboard/${eventId}/add-ons/save-the-date/stamp`}
          className="inline-flex items-center gap-2 rounded-full bg-mulberry px-5 py-2.5 text-sm font-semibold text-cream shadow-sm transition hover:bg-mulberry-600"
        >
          <Stamp aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          {hasMintedSeal ? 'Re-make your wax seal' : 'Make your wax seal'}
        </Link>
      </div>
    </section>
  );
}
