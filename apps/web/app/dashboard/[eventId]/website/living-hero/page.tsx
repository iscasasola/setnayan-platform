import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { LivingHeroStudio } from './_components/living-hero-studio';

/**
 * Living Hero editor (iteration 0046). The couple picks a ≤5-second moment from
 * a video; their browser bakes it into a forward→reverse boomerang + a freeze
 * still (lib/boomerang-encoder, WebCodecs — no server pipeline), and both save
 * to the EXISTING hero columns: landing_page_hero_video_r2_key (the loop) +
 * landing_page_hero_image_url (the still = poster + print + slow-net fallback).
 * The public /[slug] hero (HeroBackgroundMedia) already autoplays the video
 * looped with the still as poster, so a baked boomerang plays continuously.
 *
 * Auth + RLS: the events SELECT runs under the host session (RLS-scoped); the
 * save action re-checks event_moderators / legacy couple membership.
 */
export default async function LivingHeroPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: event, error } = await supabase
    .from('events')
    .select(
      'event_id, display_name, slug, landing_page_hero_image_url, landing_page_hero_video_r2_key',
    )
    .eq('event_id', eventId)
    .maybeSingle();

  if (error || !event) notFound();

  const currentClipUrl = await displayUrlForStoredAsset(
    event.landing_page_hero_video_r2_key,
  );
  const currentStillUrl = await displayUrlForStoredAsset(
    event.landing_page_hero_image_url,
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={`/dashboard/${eventId}/website/hero-photo`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink/65 transition-colors hover:text-burgundy focus-visible:text-burgundy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        <span>Back to hero photo</span>
      </Link>

      <header className="mb-8 space-y-2">
        <h1 className="font-display text-3xl italic text-ink sm:text-4xl">
          Living hero
        </h1>
        <p className="max-w-prose text-sm text-ink/65 sm:text-base">
          Turn a few seconds of video into a gentle, looping hero for your
          wedding page — it plays forward, then reverses, so it never feels cut.
          You pick the moment and the still frame; everything is made right on
          your device, and the still is your photo for print and slow
          connections.
        </p>
      </header>

      <LivingHeroStudio
        eventId={eventId}
        currentClipUrl={currentClipUrl}
        currentStillUrl={currentStillUrl}
      />
    </main>
  );
}
