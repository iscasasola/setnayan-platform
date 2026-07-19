import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Music, Heart, Sparkles, CheckCircle2, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { eventSkuActive } from '@/lib/entitlements';
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

export const metadata = { title: 'Pakanta · Setnayan' };

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

type Props = { params: Promise<{ eventId: string }> };

export default async function PakantaPage({ params }: Props) {
  const { eventId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  // Select the delivery columns too. Graceful-degrade: if they don't exist on
  // this environment yet (42703), retry with the base columns so the page still
  // renders the buy/intake form (the owned-state just won't show).
  let { data: event } = await supabase
    .from('events')
    .select(
      'event_id, display_name, love_story, story_tone, pakanta_song_r2_key, pakanta_song_status, pakanta_song_filename, pakanta_song_adopted_as_site_music',
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
  const owned = await eventSkuActive(createAdminClient(), eventId, 'PAKANTA').catch(() => false);
  const songReady = event.pakanta_song_status === 'ready' && !!event.pakanta_song_r2_key;
  const songPreviewUrl =
    owned && songReady
      ? await displayUrlForStoredAsset(event.pakanta_song_r2_key).catch(() => null)
      : null;
  const adopted = event.pakanta_song_adopted_as_site_music === true;

  const { data: draft } = await supabase
    .from('pakanta_intake_drafts')
    .select('responses')
    .eq('event_id', eventId)
    .maybeSingle<{ responses: PakantaResponses }>();
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
  const settings = await fetchPlatformSettings(supabase);

  return (
    <section className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 sm:px-6">
      <Link
        href={`/dashboard/${eventId}/studio`}
        className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back to services
      </Link>

      <header className="sn-reveal flex items-start gap-3">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-mulberry/10 text-mulberry">
          <Music aria-hidden className="h-6 w-6" strokeWidth={1.75} />
        </span>
        <div>
          <p className="sn-eye">Music</p>
          <h1 className="sn-h1">Pakanta</h1>
          {owned ? (
            <p className="mt-1 text-sm text-ink/65">
              Your original wedding song. Add or refine the music notes below — we write the
              lyrics from the story you already told us.
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink/65">
              An original song written for your wedding — yours, forever. We write it from{' '}
              <span className="font-medium">the story you already told us</span>, so you only need to
              add a few music notes.
            </p>
          )}
        </div>
      </header>

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

      {/* ── OWNED + DELIVERED — the finished song is on file. ────────────── */}
      {owned && songReady ? (
        <div className="rounded-xl border border-success-200 bg-success-50 p-5">
          <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-success-800">
            <CheckCircle2 aria-hidden className="h-5 w-5" strokeWidth={2} /> Delivered
            {event.pakanta_song_filename ? ` — ${event.pakanta_song_filename}` : ''}
          </p>
          <p className="text-sm text-ink/70">
            Your custom wedding song is ready. Have a listen.
          </p>
          {songPreviewUrl ? (
            <>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio controls preload="none" src={songPreviewUrl} className="mt-3 w-full" />
              <AiDisclosure generator="song" className="mt-2" />
            </>
          ) : null}
          {adopted ? (
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-success-800">
              <Music aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Now playing on your
              wedding page as guests browse.
            </p>
          ) : (
            <UseSongButton eventId={eventId} />
          )}
        </div>
      ) : owned ? (
        /* ── OWNED + IN PRODUCTION — paid, song not yet delivered. ──────── */
        <div className="space-y-4">
          <div className="rounded-xl border border-mulberry/20 bg-mulberry/5 p-5">
            <p className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold text-mulberry">
              <Clock aria-hidden className="h-5 w-5" strokeWidth={1.75} /> Your song is in production
            </p>
            <p className="text-sm text-ink/70">
              Your song is being composed with Setnayan AI from your story. When it’s ready it will
              appear here — and play on your wedding page automatically.
            </p>
          </div>
          {/* Keep the brief/intake visible while in production so the couple
              can still add or refine their music notes before it's written. */}
          {pricePhp != null ? (
            <PakantaMusicForm
              eventId={eventId}
              initial={responses}
              pricePhp={pricePhp}
              settings={settings}
              paid
            />
          ) : null}
        </div>
      ) : pricePhp != null ? (
        /* ── NOT OWNED — buy + intake form (unchanged). ────────────────── */
        <PakantaMusicForm eventId={eventId} initial={responses} pricePhp={pricePhp} settings={settings} />
      ) : (
        <p className="text-sm text-ink/65">
          Pricing loads from your catalog &mdash; please refresh in a moment.
        </p>
      )}
    </section>
  );
}
