import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, CalendarClock, Check, Plus, Sparkles, Stamp } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { sealColorFromPalette, veilColorFromPalette } from '@/lib/site-palette';
import { fallbackSeedFromPublicId, sanitizeWaxSealConfig } from '@/lib/wax-seal/types';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { resolveStdFilmContent } from '@/lib/save-the-date-content';
import { REVEAL_TEMPLATE_IDS } from '@/lib/reveal-config';
import type { RevealTemplate } from '@/app/[slug]/_components/reveal/reveal-templates';
import { RevealPreviewCard } from '@/app/dashboard/[eventId]/_components/reveal-preview-card';
import { SaveTheDateFilm } from '@/app/[slug]/_components/save-the-date-film';
import { saveInvitationLaunchDate } from './actions';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { formatPhp } from '@/lib/orders';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { InlineCheckoutDrawer } from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';
import {
  eventOwnsStdOpenings,
  STD_PREMIUM_OPENINGS_SERVICE_KEY,
} from '@/lib/std-openings';

// 2026-06-17 — owner "replace": this page IS the Save-the-Date *builder* — the
// couple picks the opening reveal (one of 5), previews the auto-filled content
// FILM (PR4 P1/P2), and adds their touches (invitation-launch date · soundtrack
// · closing photos). FREE = the film; the cinematic OPENINGS are the premium
// "template unlock" — owner-priced ₱799 (admin-managed, /admin/pricing), sold
// here via the same InlineCheckoutDrawer flow as the other paid SKUs. The old
// paid ₱99 Save-the-Date VIDEO render SKU (`save_the_date_video`) + its template
// library are retired-but-intact (not surfaced here).

export const metadata = { title: 'Save the Date · Setnayan' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ std?: string; std_error?: string }>;
};

/** Coerce the stored template id to a known opening, else null (house default). */
function coerceTemplate(v: unknown): RevealTemplate | null {
  return typeof v === 'string' && (REVEAL_TEMPLATE_IDS as readonly string[]).includes(v)
    ? (v as RevealTemplate)
    : null;
}

export default async function SaveTheDatePage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const { std, std_error: stdError } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase
    .from('events')
    .select(
      'public_id, display_name, event_date, venue_name, venue_address, love_story, monogram_text, monogram_custom_svg, monogram_uploaded_svg, role_palette, wax_seal_config, std_reveal_template, std_invitation_launch_date, our_photos, site_bg_music_enabled, site_bg_music_r2_key, landing_page_hero_image_url',
    )
    .eq('event_id', eventId)
    .maybeSingle();

  // The couple's real monogram mark for the wax seal — their own upload outranks
  // the AI/Cipher mark (owner rule 2026-06-15); null → lettered seal fallback.
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

  // Premium openings unlock (the "template unlock"). The content film is FREE;
  // the cinematic openings (the reveal) play on the live page once the couple
  // unlocks them. Price is admin-managed (catalog · /admin/pricing) — read at
  // runtime via formatV2Sku, never hardcoded. Mirrors the Animated Monogram buy
  // flow; ownership reads the couple's own orders (eventOwnsStdOpenings).
  const [ownsOpenings, openingsSku, settings] = await Promise.all([
    eventOwnsStdOpenings(supabase, eventId),
    formatV2Sku(STD_PREMIUM_OPENINGS_SERVICE_KEY).catch(() => null),
    fetchPlatformSettings(supabase),
  ]);
  const openingsPricePhp = openingsSku?.price_php ?? null;

  // Resolve the same presigned media the live page uses, so the builder preview
  // is exactly what guests get: the couple's site music = the film soundtrack,
  // their curated photos (else hero) = the closing gallery.
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

  const content = resolveStdFilmContent({
    displayName: event?.display_name ?? '',
    monogramText: event?.monogram_text,
    dateIso: event?.event_date ?? null,
    launchDateIso: event?.std_invitation_launch_date,
    venueName: event?.venue_name,
    venueAddress: event?.venue_address,
    loveStory: event?.love_story,
    publicId: event?.public_id ?? eventId,
    musicUrl: bgMusicUrl,
    galleryUrls,
  });

  const launchDate =
    typeof event?.std_invitation_launch_date === 'string'
      ? event.std_invitation_launch_date.slice(0, 10)
      : '';

  // The "what your film shows" rows — each is either filled (✓) or a one-tap
  // link to the editor that fills it. Music + photos reuse the couple's existing
  // site assets (no STD-specific upload in V1).
  const rows: Array<{ label: string; done: boolean; value?: string; href?: string }> = [
    { label: 'Your monogram & names', done: true, value: `${content.monogram} · ${content.names}` },
    {
      label: 'Wedding date',
      done: Boolean(content.dateBig),
      value: content.dateLabel ?? undefined,
      href: `/dashboard/${eventId}`,
    },
    {
      label: 'Venue',
      done: Boolean(content.venueName),
      value: content.venueName ?? undefined,
      href: `/dashboard/${eventId}`,
    },
    {
      label: 'A line from your story',
      done: Boolean(content.storyTeaser),
      href: `/dashboard/${eventId}/website`,
    },
    {
      label: 'Soundtrack',
      done: Boolean(content.musicUrl),
      href: `/dashboard/${eventId}/website/site-chrome`,
    },
    {
      label: 'Closing photos',
      done: (content.gallery?.length ?? 0) > 0,
      value: content.gallery?.length ? `${content.gallery.length} photos` : undefined,
      href: `/dashboard/${eventId}/website/our-photos`,
    },
  ];

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
          Your Save the Date plays as a short, self-running film on your wedding page — it fills
          itself in from what you&rsquo;ve already added, and recolours to your Mood Board. Choose
          the opening it begins with, preview it, then add your finishing touches.
        </p>
      </header>

      {std === 'saved' ? (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          Saved.
        </p>
      ) : null}
      {stdError ? (
        <p className="rounded-lg border border-terracotta/30 bg-terracotta/10 px-4 py-2.5 text-sm text-terracotta-700">
          {stdError === 'bad-date'
            ? 'That date didn’t look right — please pick a valid date.'
            : 'Something went wrong saving that. Please try again.'}
        </p>
      ) : null}

      {/* 1 · Choose your opening (persists events.std_reveal_template). */}
      <RevealPreviewCard
        displayName={event?.display_name ?? ''}
        dateIso={event?.event_date ?? null}
        markSvg={markSvg}
        waxColor={waxColor}
        sealConfig={sealConfig}
        sealFallbackSeed={sealFallbackSeed}
        veilColor={veilColor}
        eventId={eventId}
        chosenTemplate={chosenTemplate}
      />

      {/* 1b · Unlock the cinematic openings (premium · admin-priced "template unlock"). */}
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
                <span className="font-medium text-ink">cinematic opening</span> — a veil or envelope
                that lifts to reveal your page — and it plays for every guest who opens your link.
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
        // Price not yet set (or a non-positive catalog misconfig) — never render a
        // ₱0 buy-CTA, which would submit a free order. Soft note, not a silent hide.
        <p className="rounded-2xl border border-ink/10 bg-white/60 px-5 py-4 text-sm text-ink/55">
          The cinematic openings are being set up — check back shortly.
        </p>
      )}

      {/* 2 · Preview the film itself — the exact piece guests see beneath the opening. */}
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="font-serif text-xl italic">Preview your film</h2>
          <p className="max-w-prose text-sm text-ink/65">
            This is your Save the Date. It plays on its own — tap a bar to jump, press and hold to
            pause.
          </p>
        </div>
        <SaveTheDateFilm content={content} />
      </section>

      {/* 3 · What your film shows (the auto-fill summary). */}
      <section className="space-y-3">
        <h2 className="font-serif text-xl italic">What your film shows</h2>
        <ul className="divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-white/70">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink/85">{r.label}</p>
                {r.done && r.value ? (
                  <p className="truncate text-xs text-ink/55">{r.value}</p>
                ) : null}
              </div>
              {r.done ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
                  Added
                </span>
              ) : r.href ? (
                <Link
                  href={r.href}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ink/15 bg-cream px-3 py-1 text-xs font-medium text-ink/70 hover:border-terracotta hover:text-terracotta"
                >
                  <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  Add
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="text-xs text-ink/50">
          Anything you haven&rsquo;t added simply isn&rsquo;t shown — the film adapts to what it has.
        </p>
      </section>

      {/* 4 · Add your touches. */}
      <section id="touches" className="space-y-4 scroll-mt-24">
        <h2 className="font-serif text-xl italic">Add your touches</h2>

        <form
          action={saveInvitationLaunchDate}
          className="space-y-2 rounded-2xl border border-ink/10 bg-white/70 p-4 sm:p-5"
        >
          <input type="hidden" name="event_id" value={eventId} />
          <label
            htmlFor="launch_date"
            className="flex items-center gap-2 text-sm font-medium text-ink/85"
          >
            <CalendarClock aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
            When does your full invitation go live?
          </label>
          <p className="text-xs text-ink/55">
            We&rsquo;ll add a gentle &ldquo;remind me when the invite arrives&rdquo; to the
            end-of-film calendar. Optional.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              id="launch_date"
              name="launch_date"
              type="date"
              defaultValue={launchDate}
              className="rounded-md border border-ink/20 bg-cream px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-mulberry px-4 py-2 text-sm font-semibold text-cream shadow-sm transition hover:bg-mulberry-600"
            >
              Save date
            </button>
          </div>
        </form>

        <Link
          href={`/dashboard/${eventId}/add-ons/save-the-date/stamp`}
          className="inline-flex items-center gap-2 rounded-full bg-mulberry px-5 py-2.5 text-sm font-semibold text-cream shadow-sm transition hover:bg-mulberry-600"
        >
          <Stamp aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          {hasMintedSeal ? 'Re-make your wax seal' : 'Make your wax seal'}
        </Link>
      </section>
    </section>
  );
}
