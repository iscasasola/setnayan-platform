import { redirect } from 'next/navigation';

/**
 * /dashboard/[eventId]/today — RETIRED 2026-06-03.
 *
 * The Today's Focus wizard (9-card DIY / 65-card paid sequence, rendered by
 * <WizardHero>) is superseded by two surfaces that already do its job
 * better, anchored to the couple's real plan:
 *   - ONBOARDING (apps/web/app/onboarding/wedding) scopes "what do you
 *     want" once, up front.
 *   - The PER-SERVICE DEADLINE TIMELINE (lib/upcoming-items.ts) answers
 *     "what's next, by when" — counted back from the wedding date and
 *     surfaced on event-home via fetchUpcomingItems.
 *
 * The Filipino-wedding statutory deadlines (Pre-Cana, marriage-license
 * validity, PSA/CENOMAR) live in lib/upcoming-items.ts `PAPERWORK_DEADLINES`,
 * independent of the wizard — retiring this surface does NOT touch them.
 *
 * This route now redirects to event-home so existing links / bookmarks /
 * the V1 "Today's Focus active" emails don't 404. The wizard components
 * (wizard-hero.tsx, wizard-cards/, lib/wizard.ts) + the dormant Concierge
 * SKU machinery are left on disk as a quick-revert path — nothing renders
 * them now. Full teardown (the concierge_* DB columns, the admin trial-
 * abuse queue, the TODAYS_FOCUS catalog SKU) is a deliberate later
 * schema-cleanup pass, not this change.
 */
export default async function RetiredTodaysFocus({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  redirect(`/dashboard/${eventId}`);
}
