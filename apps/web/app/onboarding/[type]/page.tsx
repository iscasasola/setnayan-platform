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
import { safeNext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import { resolveProfile } from '@/lib/event-type-profile';
import { resolveOnboardingFlow } from '@/lib/onboarding/flow-config';
import { getOnboardingSpec } from '@/lib/onboarding/onboarding-db';
import { getOnboardingTiles } from '@/lib/onboarding-refinements';
import { experienceQuizEnabled } from '@/lib/experience-quiz';
import { manilaToday } from '@/lib/std-views';
import { anonOnboardingEnabled } from '@/lib/anon-onboarding';
import { onboardingV2BriefEnabled } from '@/lib/onboarding-v2-brief-flag';
import { getSelfPersonalization } from '@/lib/self-personalization';
import { nextBirthday } from '@/lib/event-anchor';
import { deriveOnboardingPrefill, EMPTY_PREFILL } from '@/lib/onboarding/prefill';
import { onboardingServicesStepEnabled } from '@/lib/onboarding/services-step-flag';
import { readServicesStepView } from '@/lib/onboarding/services-step-server';
import { SetnayanAiValue } from '@/app/dashboard/[eventId]/studio/setnayan-ai/_components/setnayan-ai-value';
import { isGatedLifeType } from '@/lib/life-event-gate';
import { getBlockingLifeEvent } from '@/app/dashboard/(account)/create-event/life-event-guard';
import { GenericOnboarding } from './_components/generic-onboarding';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Plan your event',
  description:
    "A few quick questions and we'll shape a plan made for your celebration. Free to start, always.",
  robots: { index: false, follow: false },
};

export default async function GenericOnboardingPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ resume?: string; next?: string }>;
}) {
  const { type } = await params;
  const sp = await searchParams;
  // Optional vendor-invite return path (2026-06-30): a 0-event couple sent here
  // from /vendor-invite/[slug] to create their first (non-wedding) event is
  // returned to it after the commit so they can finish shortlisting the vendor.
  // The create-event picker threads `next` via withNext() (#2452); the wedding
  // route already honors it — this closes the gap for the generic flow.
  // safeNext() keeps it to internal paths only.
  const nextPath = safeNext(sp.next);

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
    // The register rides along so a wake's quiz + reveal are solemn on EVERY
    // path, including the two where the override read fails (solemn-content.ts).
    getOnboardingSpec(type, flow.personaPackKey, profile.terminology.register),
  ]);
  const user = userData.user;

  // ── ENTRANCE GREY-OUT (owner ruling 2026-09-11, DECISION_LOG.md — "same
  // treatment for any other one-at-a-time event type"). PR #5447 did this for
  // wedding: a signed-in account already blocked is told BEFORE it walks the
  // whole wizard, not at the last screen (PR #5446 fixed the end-of-flow dead
  // end; this closes the entrance gap for the generic onboarding).
  //
  // Only the five gated life types (life-event-gate.ts: debut · christening ·
  // birthday · graduation · gender_reveal) cap at one in-planning per honoree —
  // isGatedLifeType() guards the read so every other type never spends it.
  //
  // ⚠ UNLIKE WEDDING, THIS IS A NOTICE, NOT A DEAD END. The wedding cap is
  // unconditional; this one is keyed on honoree_label/honoree_dependent_id
  // (life-event-gate.ts blocksLifeEventCreation), which the wizard does not ask
  // until the 'honoree' screen — a couple of screens past this one. So the
  // check here runs with the DEFAULT candidate (no honoree named yet, exactly
  // what a blank honoree has always meant — "for myself"): it tells the account
  // it is CURRENTLY blocked for that default, with a way to the existing event,
  // while the flow keeps going — naming a different celebrant on the honoree
  // screen still opens a new slot, exactly as it does today. This is why the
  // create-event picker's tile is deliberately NOT greyed for these five types
  // (see event-type-picker.tsx / event-type-photo-picker.tsx, unchanged): the
  // rule depends on an answer the tile is tapped before asking.
  //
  // Read failures fail OPEN here (unlike the commit-time gate, which must fail
  // closed): this is a courtesy heads-up, not the enforcement point — the real
  // cap is still enforced by commitOnboardingEvent on every submit regardless
  // of whether this notice rendered.
  let entranceBlocking: { eventId: string; displayName: string } | null = null;
  if (user && isGatedLifeType(type)) {
    try {
      entranceBlocking = await getBlockingLifeEvent(supabase, user.id, {
        eventType: type,
        honoreeLabel: null,
        honoreeDependentId: null,
      });
    } catch {
      entranceBlocking = null;
    }
  }

  // Profile prefill (onboarding_v2_brief · owner 2026-07-13): read the four
  // self-consented facts (religion/civil status/birthdate/gender) and derive the
  // per-type answers they already settle, so onboarding pre-fills those and only
  // asks what's missing. Flag OFF (default) → EMPTY_PREFILL → the flow is
  // byte-identical. SELF facts only; RLS scopes the read to this user.
  const self = await getSelfPersonalization();
  const prefill = onboardingV2BriefEnabled()
    ? deriveOnboardingPrefill(type, self)
    : EMPTY_PREFILL;

  // ── THE AGE OF THE PERSON SIGNED IN, WHEN THIS IS A BIRTHDAY ──────────────
  //
  // Owner, 2026-08-20: "since we already know it is for his birthday, then it
  // is not a question of what type of party." A birthday with no celebrant name
  // on it IS the account holder's — blank has always meant "mine" — so the
  // party-type question answers itself from a date already on their profile.
  //
  // 🔑 DELIBERATELY NOT ROUTED THROUGH `prefill`. That seam is gated by
  // `onboardingV2BriefEnabled()`, which is fail-closed and OFF, so a fix built
  // behind it would ship switched off — and the flag exists to hold back a
  // WIDER brief, not this one fact.
  //
  // 🔒 It is the reader's OWN age, derived from their OWN row (RLS-scoped, self
  // facts only), handed to their OWN wizard: nothing is disclosed that the
  // person on the screen does not already know about themselves. The AGE
  // crosses, never the birth date — the smaller of the two facts, and the only
  // one the question needs.
  const selfBirthdayAge =
    type === 'birthday' && self.birthdate
      ? (nextBirthday(self.birthdate, manilaToday())?.age ?? null)
      : null;

  // The services step (Papic + Setnayan AI). Flag OFF ⇒ null ⇒ the wizard drops
  // the screen from its sequence and the flow is byte-identical to today.
  //
  // Both halves are resolved HERE, on the server: the wizard is a client
  // component, so the live catalog + the vendor-free AI gate cannot be read
  // where the cards are shown. `aiValue` is the type-aware capability list
  // rendered as a Server Component and passed down as a node — its own copy is
  // owned by #3865 and is never re-authored in onboarding.
  const servicesStepView = onboardingServicesStepEnabled()
    ? await readServicesStepView(supabase, type)
    : null;
  const aiValueNode =
    servicesStepView?.ai != null ? (
      <SetnayanAiValue
        mode="preview"
        terms={{
          eventWord: profile.terminology.eventWord,
          organizerNoun: profile.terminology.organizerNoun,
          hasStatutoryPaperwork: profile.statutoryPackKey != null,
        }}
      />
    ) : null;

  return (
    <GenericOnboarding
      servicesStepView={servicesStepView}
      servicesStepAiValue={aiValueNode}
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
      register={spec.register}
      revealByPersona={spec.revealByPersona}
      quizAxes={spec.axes}
      authed={!!user}
      anonEnabled={anonOnboardingEnabled()}
      resume={sp.resume === '1'}
      nextPath={nextPath !== '/' ? nextPath : null}
      prefill={prefill}
      selfBirthdayAge={selfBirthdayAge}
      selfSex={self.gender}
      entranceBlocking={entranceBlocking}
      // Their own name, for the celebrant field on their own birthday. Same
      // scope as the age: a self fact, handed to their own wizard.
      selfName={self.displayName}
      // Manila today, so the anchor's next return is computed off the server's
      // clock rather than the visitor's device timezone.
      todayISO={manilaToday()}
    />
  );
}
