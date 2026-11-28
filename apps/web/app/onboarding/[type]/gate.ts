import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import { resolveProfile } from '@/lib/event-type-profile';
import { experienceQuizEnabled } from '@/lib/experience-quiz';

/**
 * Every answer the generic wizard gives that is not the wizard — the flag off (404), a type that is not creatable or
 * is 'wedding' (404), and a vendor-free type with its own page (sent there) — decided by `./layout.tsx` BEFORE
 * `./loading.tsx` streams, so a 404 / 307 is never sent as a 200, a skeleton and a client hop.
 * `cache()`: one set of reads per request; the page asks again and gets the same answer.
 * 🔒 app/_components/a-route-decides-before-it-streams.test.ts
 */
export const gateGenericOnboarding = cache(async (type: string) => {
  // Dark until the experience-quiz flag is flipped on (the go-live switch).
  if (!experienceQuizEnabled()) notFound();

  // Validate the type against the LIVE vocab: must be creatable (active AND
  // enabled) and NOT 'wedding'. events.event_type is a FK to event_type_vocab,
  // so this guards the commit's FK before we ever insert.
  const creatable = await getCreatableEventTypes();
  const row = creatable.find((t) => t.key === type);
  if (!row || type === 'wedding') notFound();

  const profile = await resolveProfile(type);

  // ── VENDOR-FREE GATE (owner 2026-09-25) — see the page for the whole rule: a vendor-free type with its own
  // clean onboarding page is sent there instead of rendering the full wizard under a second URL.
  const vendorFree = profile.marketplaceEnabled !== true;
  if (vendorFree && row.onboardingHref && row.onboardingHref !== `/onboarding/${type}`) {
    redirect(row.onboardingHref);
  }
  return { row, profile, vendorFree };
});
