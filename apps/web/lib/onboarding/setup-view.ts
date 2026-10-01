/**
 * setup-view.ts — the ONE server-side composition of a type's setup view
 * (G1). The onboarding pages hand it to the wizard; the commits re-read the
 * wire answers against the very same view, so what the cards offered and what
 * the commit accepts can never disagree.
 */
import { profileSetup, type EventTypeProfile } from '@/lib/event-type-profile';
import { pickableInviteThemes } from '@/lib/invite-themes';
import { resolveWeddingOnlyParts } from '@/lib/wedding-only-parts';
import { setupViewFor } from './flow-config';
import type { SetupView } from './setup-answers';

export function setupViewForProfile(profile: EventTypeProfile): SetupView {
  const pickable = pickableInviteThemes({
    mayShowStdFilm: resolveWeddingOnlyParts(profile).save_the_date_film,
  });
  return setupViewFor(profile, profileSetup(profile), pickable);
}
