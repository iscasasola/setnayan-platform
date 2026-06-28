/**
 * /onboarding/[type] — the GENERIC (non-wedding) onboarding flow (0053 Phase 3,
 * PR2). A thin Server Component; all interactivity lives in the GenericOnboarding
 * client shell. Wedding keeps its own dedicated wizard at /onboarding/wedding —
 * this route refuses 'wedding'.
 *
 * DARK until go-live: the whole route 404s unless NEXT_PUBLIC_EXPERIENCE_QUIZ_ENABLED
 * is on (the owner's go-live switch). Until then the create-event picker keeps its
 * inline name-form for non-wedding types (PR3 wires the picker to this route).
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import { resolveProfile } from '@/lib/event-type-profile';
import { resolveOnboardingFlow } from '@/lib/onboarding/flow-config';
import { getOnboardingSpec } from '@/lib/onboarding/onboarding-db';
import { getOnboardingTiles } from '@/lib/onboarding-refinements';
import { experienceQuizEnabled } from '@/lib/experience-quiz';
import { anonOnboardingEnabled } from '@/lib/anon-onboarding';
import { GenericOnboarding } from './_components/generic-onboarding';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Plan your event · Setnayan',
  description:
    "A few quick questions and we'll shape a plan made for your celebration. Free to start, always.",
  robots: { index: false, follow: false },
};

export default async function GenericOnboardingPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ resume?: string }>;
}) {
  const { type } = await params;
  const sp = await searchParams;

  // Dark until the experience-quiz flag is flipped on (the go-live switch).
  if (!experienceQuizEnabled()) notFound();

  // Validate the type against the LIVE vocab: must be creatable (active AND
  // enabled) and NOT 'wedding'. events.event_type is a FK to event_type_vocab,
  // so this guards the commit's FK before we ever insert.
  const creatable = await getCreatableEventTypes();
  const row = creatable.find((t) => t.key === type);
  if (!row || type === 'wedding') notFound();

  const profile = await resolveProfile(type);
  const flow = resolveOnboardingFlow(profile);

  const supabase = await createClient();
  // The type's applicable taxonomy categories (PR3) drive the experience-quiz's
  // derived starter plan; getOnboardingTiles scopes to the type + degrades to [].
  // getOnboardingSpec resolves the admin-editable content (questions / plan /
  // reveal / intro) for this type — DB override OR the TS default (0053 2026-06-28).
  const [{ data: userData }, tiles, spec] = await Promise.all([
    supabase.auth.getUser(),
    getOnboardingTiles(type),
    getOnboardingSpec(type, flow.personaPackKey),
  ]);
  const user = userData.user;

  return (
    <GenericOnboarding
      eventType={type}
      label={row.label}
      emoji={row.emoji ?? '🎉'}
      organizerNoun={profile.terminology.organizerNoun}
      eventWord={profile.terminology.eventWord}
      flowKey={flow.flowKey}
      personaPackKey={flow.personaPackKey}
      tiles={tiles}
      intro={spec.intro}
      questions={spec.questions}
      personaPack={spec.personaPack}
      revealByPersona={spec.revealByPersona}
      quizAxes={spec.axes}
      authed={!!user}
      anonEnabled={anonOnboardingEnabled()}
      resume={sp.resume === '1'}
    />
  );
}
