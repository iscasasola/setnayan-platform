/**
 * /dev/onboarding-lab — "WHAT DO YOU NEED?" (Level 1, owner 2026-10-08) for any of the twenty types,
 * on fixtures: no sign-in, no database. DEV-ONLY: production builds 404 it, the same kill-switch as
 * `/dev/home-lab`.
 *
 * It mounts the REAL wizard (`GenericOnboarding`) and the REAL Get-together form (`SimpleSetupFlow`)
 * with the type admitted to the setup engine — exactly what migration 20271276545380 does for the
 * fifteen types still on yesterday's quiz in production — so the needs screen and every card after it
 * can be walked before that migration is applied. The words, presets and rows are the shipped ones
 * (`lib/event-needs.ts`); only the profile is a code fallback. Never press "Make the event" here: the
 * button calls the real commit.
 *
 *   ?type=<event_type>   one of the twenty (default: hangout)
 */
import { notFound } from 'next/navigation';
import { GenericOnboarding } from '@/app/onboarding/[type]/_components/generic-onboarding';
import { SimpleSetupFlow } from '@/app/onboarding/simple/_components/simple-setup-flow';
import { toProfile, type ProfileRow } from '@/lib/event-type-profile';
import { CREATION_ASKS, resolveOnboardingFlow, resolveSetupSteps } from '@/lib/onboarding/flow-config';
import { setupViewForProfile } from '@/lib/onboarding/setup-view';
import { DEFAULT_PRESET_BY_TYPE } from '@/lib/event-needs';
import { manilaToday } from '@/lib/std-views';

export const dynamic = 'force-dynamic';

/** The twenty labels as production's `event_type_vocab` names them (measured 2026-10-18). */
const LABEL: Record<string, { label: string; emoji: string }> = {
  wedding: { label: 'Wedding', emoji: '💍' },
  debut: { label: 'Debut', emoji: '👑' },
  gender_reveal: { label: 'Gender Reveal', emoji: '🎈' },
  birthday: { label: 'Birthday', emoji: '🎂' },
  celebration: { label: 'Celebration', emoji: '🥂' },
  travel: { label: 'Travel', emoji: '✈️' },
  corporate: { label: 'Corporate', emoji: '🏢' },
  tournament: { label: 'Tournament', emoji: '🏆' },
  christening: { label: 'Christening', emoji: '🕯️' },
  anniversary: { label: 'Anniversary', emoji: '💞' },
  graduation: { label: 'Graduation', emoji: '🎓' },
  reunion: { label: 'Reunion', emoji: '🤝' },
  gala_night: { label: 'Gala Night', emoji: '🌟' },
  simple_event: { label: 'Get-together', emoji: '📅' },
  date: { label: 'Date', emoji: '💕' },
  hangout: { label: 'Hangout', emoji: '🍿' },
  wake: { label: 'Wake', emoji: '🕊️' },
  concert: { label: 'Concert', emoji: '🎤' },
  open_house: { label: 'Open house', emoji: '🏡' },
  grand_opening: { label: 'Grand opening', emoji: '🎀' },
};

export default async function OnboardingLabPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const type = sp.type && sp.type in DEFAULT_PRESET_BY_TYPE ? sp.type : 'hangout';
  if (type === 'wedding') notFound(); // its own wizard — not this screen (matrix §3)
  // The real reader over a row shaped like the seed (a look set admits the type to the engine); every
  // other field takes the type's own code fallback (a wake stays solemn). A vendor-free kind stays
  // vendor-free; everything else has a marketplace (prod, measured 2026-10-18).
  const profile = toProfile({
    event_type: type,
    terminology: null,
    enabled_surfaces: null,
    marketplace_enabled: type !== 'simple_event',
    look_set: type === 'wake' ? ['vintage', 'galeriya', 'house'] : ['house', 'galeriya', 'cyber'],
    camera_default: type === 'wake' ? 'quiet' : 'on',
  } as unknown as ProfileRow);
  const view = setupViewForProfile(profile);
  const row = LABEL[type]!;

  if (type === 'simple_event') {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6 lg:px-8" data-onboarding-lab="simple">
        {/* A plain GET back to the lab — nothing is created here. */}
        <form action="/dev/onboarding-lab" method="get" className="space-y-6">
          <input type="hidden" name="type" value="simple_event" />
          <SimpleSetupFlow
            view={view}
            steps={resolveSetupSteps(view, CREATION_ASKS.simple)}
            label={row.label}
            marketplace={false}
            start={null}
            finish={<p className="text-sm text-ink/60">(The Papic picks and Create event follow here.)</p>}
          />
        </form>
      </div>
    );
  }

  const flow = resolveOnboardingFlow(profile);
  return (
    <GenericOnboarding
      eventType={type}
      label={row.label}
      emoji={row.emoji}
      organizerNoun={profile.terminology.organizerNoun}
      eventWord={profile.terminology.eventWord}
      flowKey={flow.flowKey}
      personaPackKey={flow.personaPackKey}
      tiles={[]}
      vendorFree={!profile.marketplaceEnabled}
      intro={null}
      questions={[]}
      personaPack={null}
      register={profile.terminology.register}
      revealByPersona={{}}
      quizAxes={[]}
      authed
      anonEnabled={false}
      resume={false}
      nextPath={null}
      todayISO={manilaToday()}
      setupView={view}
      setupSteps={resolveSetupSteps(view, CREATION_ASKS.generic)}
    />
  );
}
