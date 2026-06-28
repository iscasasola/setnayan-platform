import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveProfile } from '@/lib/event-type-profile';
import { resolveOnboardingSpec, type OnboardingOverrideRow } from '@/lib/onboarding/onboarding-spec';
import { getOnboardingTiles } from '@/lib/onboarding-refinements';
import { INAPP_TO_SERVICE_CODE } from '@/app/onboarding/wedding/_components/onboarding-pricing';
import { OnboardingEditor } from './_components/onboarding-editor';

export const metadata = { title: 'Onboarding content · Event Types · Admin' };
export const dynamic = 'force-dynamic';

/**
 * Setnayan HQ · Event Types · Onboarding CONTENT editor (0053 · 2026-06-28).
 * Edit one non-wedding type's signature questions, persona starter-plan pack, and
 * reveal + intro copy of the generic onboarding flow — persisted as an override
 * row in event_type_onboarding (NULL fields fall back to the code defaults). The
 * live /onboarding/[type] flow reflects the edit with no redeploy. Reached from
 * the roster row's "Onboarding content →" link. Wedding owns its bespoke wizard
 * and is not editable here.
 */

type Params = Promise<{ eventType: string }>;
type SearchParams = Promise<{ ok?: string; error?: string }>;

/** key → human label (internal tool): papic_seats → "Papic Seats". */
function humanize(key: string): string {
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default async function EventTypeOnboardingPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { eventType } = await params;
  const sp = await searchParams;
  const admin = createAdminClient();

  const { data: vocab } = await admin
    .from('event_type_vocab')
    .select('event_type, label_en, emoji')
    .eq('event_type', eventType)
    .maybeSingle();
  if (!vocab) notFound();

  const okMsg = sp.ok ? decodeURIComponent(sp.ok) : null;
  const errMsg = sp.error ? decodeURIComponent(sp.error) : null;

  if (eventType === 'wedding') {
    return (
      <main className="mx-auto max-w-2xl px-5 py-8">
        <Link href="/admin/event-types" className="text-sm text-ink/55 hover:text-mulberry">
          ← Event Types
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-ink">
          {vocab.emoji} Wedding · Onboarding content
        </h1>
        <p className="mt-4 rounded-md border border-warn-200 bg-warn-50 px-3 py-3 text-sm text-warn-700">
          Wedding runs a <strong>bespoke guided wizard</strong> (its own screens, copy, and
          plan logic) — it isn&rsquo;t edited from this content editor. Adjust wedding
          terminology in <Link href="/admin/event-types/wedding/profile" className="underline">Onboarding profile</Link>.
        </p>
      </main>
    );
  }

  const profile = await resolveProfile(eventType);
  const packKey = profile.onboardingFlowKey ?? eventType;

  const [{ data: rowData }, tiles] = await Promise.all([
    admin
      .from('event_type_onboarding')
      .select('intro, questions, persona_pack, reveal_overrides, axis_overrides')
      .eq('event_type', eventType)
      .maybeSingle<OnboardingOverrideRow>(),
    getOnboardingTiles(eventType),
  ]);

  const hasOverride = !!rowData;
  const spec = resolveOnboardingSpec(eventType, packKey, rowData ?? null);

  const categoryOptions = tiles.map((t) => ({ value: t.cat, label: t.label }));
  const serviceOptions = Object.keys(INAPP_TO_SERVICE_CODE).map((k) => ({
    value: k,
    label: humanize(k),
  }));

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <Link href="/admin/event-types" className="text-sm text-ink/55 hover:text-mulberry">
        ← Event Types
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">
          {vocab.emoji} {vocab.label_en} · Onboarding content
        </h1>
        <Link
          href={`/onboarding/${eventType}`}
          target="_blank"
          className="rounded-full border border-ink/15 px-4 py-1.5 text-sm text-ink/70 hover:border-mulberry hover:text-mulberry"
        >
          Preview flow ↗
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink/55">
        The signature questions, starter-plan, and reveal copy for this type&rsquo;s onboarding.
        Saving overrides the built-in defaults; the live flow updates with no deploy.{' '}
        {hasOverride ? (
          <span className="text-mulberry">Custom content is active.</span>
        ) : (
          <span>Showing the built-in defaults.</span>
        )}
      </p>

      {okMsg ? (
        <div role="status" className="mt-4 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-800">
          {okMsg}
        </div>
      ) : null}
      {errMsg ? (
        <div role="alert" className="mt-4 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-800">
          {errMsg}
        </div>
      ) : null}

      <OnboardingEditor
        eventType={eventType}
        spec={spec}
        hasOverride={hasOverride}
        categoryOptions={categoryOptions}
        serviceOptions={serviceOptions}
      />
    </main>
  );
}
