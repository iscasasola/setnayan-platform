import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import Link from 'next/link';
import { studioHubHref } from '@/lib/studio-hub';
import { ServiceParts } from '../_components/service-parts';
import { redirect } from 'next/navigation';
import { ArrowLeft, Music, Heart, Sparkles, ListMusic, Settings2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { getCurrentUser } from '@/lib/auth';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { eventOwnsSku, eventSkuActive } from '@/lib/entitlements';
import { resolveProfileByEvent } from '@/lib/event-type-profile';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import {
  composePakantaBrief,
  type LoveStoryBlob,
  type PakantaResponses,
  type StoryTone,
} from '@/lib/pakanta-brief';
import { PakantaMusicForm } from './_components/pakanta-music-form';
import { UseSongButton } from './_components/use-song-button';
import { AiDisclosure } from '@/components/AiDisclosure';
import { PageMasthead } from '@/app/_components/page-masthead';
import { SERVICE_NAMES } from '@/lib/service-names';
import { ServicePageBand } from '@/app/dashboard/[eventId]/studio/_components/service-page-band';
import { MusicSections } from './_components/music-sections';
import { musicGlance, serviceDayOf } from '@/lib/services-glance';
import { getMenuLifecyclePhase } from '@/lib/day-of-mode';
import { isStoreShellRequest } from '@/lib/request-platform';

export const metadata = { title: 'Music Maker' };

const SKU_CODE = 'PAKANTA';
// Price comes ONLY from the admin V2 catalog (owner rule 2026-06-14 — no
// hardcoded price). The old ₱1,999 fallback diverged from the live catalog
// (₱3,499); removed. When the row is unreadable the page degrades gracefully.

/**
 * /dashboard/[eventId]/studio/pakanta — the couple-facing Pakanta surface.
 *
 * Pakanta is a custom song written for the couple. The SONG IS COMPOSED FROM
 * THE ONBOARDING LOVE STORY (events.love_story → lib/pakanta-brief.ts), so this
 * page does NOT re-ask the couple to tell their story — it SHOWS the story we
 * already have ("your song will be written from this") and only collects the
 * MUSIC top-up the love story doesn't carry: what they call each other, each
 * side's favourite singer, the music type. The form writes pakanta_intake_
 * drafts (the /admin/pakanta queue reads it); [Continue to payment] forwards to
 * the existing orders flow.
 *
 * Replaces the retired wizard Pakanta card (deleted #1320). Auth: dashboard
 * layout gates membership; we also redirect home if the event can't be read.
 */

type EventRow = {
  event_id: string;
  display_name: string | null;
  love_story: LoveStoryBlob;
  story_tone: StoryTone;
  pakanta_song_r2_key: string | null;
  pakanta_song_status: 'in_production' | 'ready' | null;
  pakanta_song_filename: string | null;
  pakanta_song_adopted_as_site_music: boolean | null;
};

type Props = { params: Promise<{ eventId: string }>; searchParams?: Promise<{ buy_error?: string }> };

export default async function PakantaPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = (await searchParams) ?? {};

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  // Select the delivery columns too. Graceful-degrade: if they don't exist on
  // this environment yet (42703), retry with the base columns so the page still
  // renders the buy/intake form (the owned-state just won't show).
  let { data: event } = await supabase
    .from('events')
    .select(
      'event_id, display_name, love_story, story_tone, pakanta_song_r2_key, pakanta_song_status, pakanta_song_filename, pakanta_song_adopted_as_site_music, event_date, cleared_at, timezone, event_end_date',
    )
    .eq('event_id', eventId)
    .maybeSingle<EventRow>();
  if (!event) {
    const fallback = await supabase
      .from('events')
      .select('event_id, display_name, love_story, story_tone')
      .eq('event_id', eventId)
      .maybeSingle<Partial<EventRow>>();
    event = fallback.data
      ? ({
          event_id: fallback.data.event_id ?? eventId,
          display_name: fallback.data.display_name ?? null,
          love_story: fallback.data.love_story ?? null,
          story_tone: fallback.data.story_tone ?? null,
          pakanta_song_r2_key: null,
          pakanta_song_status: null,
          pakanta_song_filename: null,
          pakanta_song_adopted_as_site_music: null,
        } as EventRow)
      : null;
  }
  if (!event) redirect(`/dashboard/${eventId}`);

  // Owned gate (bundle-aware, admin-approved). Drives the three owned-states:
  // not-owned → buy/intake form; owned + in-production/no-song → "in production";
  // owned + 'ready' → delivered preview + "use this song" button.
  const ent = await eventEntitlementClient(eventId);
  const [owned, ownsOrWaits] = await Promise.all([
    eventSkuActive(ent, eventId, 'PAKANTA').catch(() => false),
    eventOwnsSku(ent, eventId, 'PAKANTA').catch(() => false),
  ]);
  const songReady = event.pakanta_song_status === 'ready' && !!event.pakanta_song_r2_key;
  const songPreviewUrl =
    owned && songReady
      ? await displayUrlForStoredAsset(event.pakanta_song_r2_key).catch(() => null)
      : null;
  const adopted = event.pakanta_song_adopted_as_site_music === true;

  //
  // 🚨 A REFUSED READ HERE COSTS THE COUPLE THEIR OWN WORDS. Supabase RESOLVES
  // 🚨 with { error } rather than throwing, so a refusal arrives as `null`, the
  // 🚨 form below renders BLANK — and saving it upserts on `event_id`, so the
  // 🚨 answers they wrote before are overwritten by the empty ones they were
  // 🚨 just shown. An unread draft is not an absent draft; say so before they
  // 🚨 type over it.
  const { data: draft, error: draftError } = await supabase
    .from('pakanta_intake_drafts')
    .select('responses')
    .eq('event_id', eventId)
    .maybeSingle<{ responses: PakantaResponses }>();
  if (draftError) {
    logQueryError(
      'PakantaPage.draft',
      draftError,
      { event_id: eventId },
      'graceful_degrade',
    );
  }
  const draftMeasured = !draftError;
  const responses = draft?.responses ?? null;

  // Iteration 0053: frame the song brief by the event type ('couple' for a
  // wedding → byte-identical; 'host' for other event types).
  const profile = await resolveProfileByEvent(eventId);
  const brief = composePakantaBrief({
    coupleNames: event.display_name ?? '',
    loveStory: event.love_story ?? null,
    storyTone: event.story_tone ?? null,
    responses,
    organizerNoun: profile.terminology.organizerNoun,
  });

  // The story half comes from onboarding — true when they finished the love
  // stage. When empty we nudge them there instead of pretending we have it.
  const hasStory = brief.storyParagraphs.length > 0 || brief.keyMoments.length > 0;

  const skuRecord = await formatV2Sku(SKU_CODE).catch(() => null);
  const pricePhp = skuRecord?.price_php ?? null;

  /* ✅ THE MUSIC PAGE'S ONE BAND (owner "approve all", 2026-10-14 — services prototype):
     the glance Home's row reads. "In production" is a word — no clock, no promise (🧩 4). */
  const ev = event as EventRow & { event_date?: string | null; cleared_at?: string | null; timezone?: string | null; event_end_date?: string | null };
  const phase = ev.event_date
    ? getMenuLifecyclePhase(ev.event_date, ev.cleared_at ?? null, ev.timezone ?? undefined, undefined, ev.event_end_date ?? null)
    : 'plan';
  const glance = musicGlance({
    ownership: owned ? 'on' : ownsOrWaits ? 'waiting' : 'none',
    price: pricePhp,
    day: serviceDayOf(phase),
    offered: true,
    song: songReady ? 'ready' : 'in_production',
    playing: adopted,
  });
  const storeShell = await isStoreShellRequest();
  const briefWords = [responses?.music_type, responses?.pet_names].map((x) => (x ?? '').trim()).filter(Boolean).join(' · ');

  return (
    <section className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 sm:px-6">
      <Link
        href={studioHubHref(eventId)}
        className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back to services
      </Link>

      <PageMasthead
        titleNode={
          <span>
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mulberry/10 text-mulberry">
              <Music aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            </span>
            Music Maker
          </span>
        }
      />

      <div>
        <ServicePageBand name={SERVICE_NAMES['music-maker'].plain} brand={SERVICE_NAMES['music-maker'].brand} eventId={eventId} glance={glance} label="Your song" storeShell={storeShell} buyError={search.buy_error ?? null} />
        {/* ✅ THE SECTIONS AS DRAWN (prototype `sections('music')`) — dim until it is added. */}
        <MusicSections
          eventId={eventId}
          added={glance.ownership === 'on'}
          owned={owned}
          songReady={songReady}
          songFilename={event.pakanta_song_filename}
          songPreviewUrl={songPreviewUrl}
          adopted={adopted}
          briefWords={briefWords}
          hasBrief={Boolean(responses)}
        />
      </div>

      {/* 🧩 Playlist, under Music Maker (it sat under the Music Maker card on
          the retired More Services page — owner, tracker d1). */}
      <ServiceParts eventId={eventId} service="music-maker" />

      {!draftMeasured ? (
        <p
          role="alert"
          className="rounded-2xl border-t-[3px] border-mulberry/70 bg-mulberry/5 p-4 text-sm text-ink/70"
        >
          <strong className="text-ink">
            We couldn&rsquo;t load the answers you saved before.
          </strong>{' '}
          The form below is showing empty because of that, not because your
          answers are gone. Reload before filling it in again &mdash; saving now
          would replace what you wrote.
        </p>
      ) : null}

      {/* The story we already have — pulled from onboarding, read-only. */}
      <div className="sn-tile p-5">
        <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink/45">
          <Heart aria-hidden className="h-3.5 w-3.5 text-mulberry" /> Your song will be written from
          this
        </p>
        {hasStory ? (
          <ul className="space-y-1.5 text-sm text-ink/75">
            {brief.storyParagraphs.map((p, i) => (
              <li key={i}>• {p}</li>
            ))}
            {brief.keyMoments.length > 0 ? (
              <li className="pt-1 text-ink/60">
                {brief.keyMoments.map((k) => `${k.label}: ${k.value}`).join(' · ')}
              </li>
            ) : null}
          </ul>
        ) : (
          <div className="text-sm text-ink/70">
            <p className="inline-flex items-center gap-1.5">
              <Sparkles aria-hidden className="h-4 w-4 text-ink/40" /> We don’t have your love story
              yet.
            </p>
            <p className="mt-1">
              Finish the{' '}
              <Link
                href={`/dashboard/${eventId}/details`}
                className="font-medium text-terracotta underline-offset-4 hover:underline"
              >
                love-story details
              </Link>{' '}
              and your song will be written from it — no need to retype anything here.
            </p>
          </div>
        )}
      </div>

      {/* The brief itself — the three questions. Before it is added, "Continue to payment" saves
          it and opens /pay (`buyService`); once added, it saves only, while the song is written. */}
      <div id="brief-form" className="scroll-mt-24">
        {pricePhp != null ? (
          <PakantaMusicForm eventId={eventId} initial={responses} pricePhp={pricePhp} paid={ownsOrWaits} />
        ) : (
          <p className="text-sm text-ink/65">
            Pricing loads from your catalog &mdash; please refresh in a moment.
          </p>
        )}
      </div>
    </section>
  );
}
