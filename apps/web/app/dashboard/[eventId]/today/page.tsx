import { redirect } from 'next/navigation';

/**
 * /dashboard/[eventId]/today — RETIRED 2026-06-03.
 *
 * The Setnayan AI wizard (9-card DIY / 65-card paid sequence, rendered by
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
 * the V1 "Setnayan AI active" emails don't 404. The wizard RENDER layer
 * (wizard-hero.tsx, wizard-carousel.tsx, wizard-card.tsx, wizard-cards/,
 * in-flight-tray.tsx) was DELETED 2026-06-13 (owner: tear down the retired
 * wizard). The shared lib modules it used (lib/wizard.ts, lib/planner.ts,
 * wizard-actions.ts) stay — live features (pakanta, mood board, the 9-step
 * journey) still import them. The dormant Concierge SKU machinery + DB
 * teardown (concierge_* columns, admin trial-abuse queue, TODAYS_FOCUS
 * catalog SKU) remain a deliberate later schema-cleanup pass, not this change.
 */
export default async function RetiredTodaysFocus({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  redirect(`/dashboard/${eventId}`);
}
