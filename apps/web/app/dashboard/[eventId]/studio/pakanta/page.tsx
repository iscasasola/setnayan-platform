import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Music, Heart, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import {
  composePakantaBrief,
  type LoveStoryBlob,
  type PakantaResponses,
  type StoryTone,
} from '@/lib/pakanta-brief';
import { PakantaMusicForm } from './_components/pakanta-music-form';

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
};

type Props = { params: Promise<{ eventId: string }> };

export default async function PakantaPage({ params }: Props) {
  const { eventId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select('event_id, display_name, love_story, story_tone')
    .eq('event_id', eventId)
    .maybeSingle<EventRow>();
  if (!event) redirect(`/dashboard/${eventId}`);

  const { data: draft } = await supabase
    .from('pakanta_intake_drafts')
    .select('responses')
    .eq('event_id', eventId)
    .maybeSingle<{ responses: PakantaResponses }>();
  const responses = draft?.responses ?? null;

  const brief = composePakantaBrief({
    coupleNames: event.display_name ?? '',
    loveStory: event.love_story ?? null,
    storyTone: event.story_tone ?? null,
    responses,
  });

  // The story half comes from onboarding — true when they finished the love
  // stage. When empty we nudge them there instead of pretending we have it.
  const hasStory = brief.storyParagraphs.length > 0 || brief.keyMoments.length > 0;

  const skuRecord = await formatV2Sku(SKU_CODE).catch(() => null);
  const pricePhp = skuRecord?.price_php ?? null;

  return (
    <section className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 sm:px-6">
      <Link
        href={`/dashboard/${eventId}/studio`}
        className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back to services
      </Link>

      <header className="flex items-start gap-3">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-mulberry/10 text-mulberry">
          <Music aria-hidden className="h-6 w-6" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Pakanta</h1>
          <p className="mt-1 text-sm text-ink/65">
            An original song written for your wedding — yours, forever. We write it from{' '}
            <span className="font-medium">the story you already told us</span>, so you only need to
            add a few music notes.
          </p>
        </div>
      </header>

      {/* The story we already have — pulled from onboarding, read-only. */}
      <div className="rounded-xl border border-ink/10 bg-cream p-5">
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

      {/* The music top-up — the only thing the love story doesn't carry. */}
      {pricePhp != null ? (
        <PakantaMusicForm eventId={eventId} initial={responses} pricePhp={pricePhp} />
      ) : (
        <p className="text-sm text-ink/65">
          Pricing loads from your catalog &mdash; please refresh in a moment.
        </p>
      )}
    </section>
  );
}
