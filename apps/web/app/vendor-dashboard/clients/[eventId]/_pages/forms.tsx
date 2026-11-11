/**
 * 🗂 FORMS — a picked-client page (THE ONE BUILD, 8 Nov 2026 · v113 `page=forms`). OWNER: C3 (B2 §2.7).
 *
 * Top to bottom, as v113 draws it:
 *   1. "Questions for the couple" — the SHIPPED set, moved here, not redrawn: `QuestionsSection` (write / edit /
 *      stop asking), `QuestionsSendPanel` ("Send the set into this event"), and `CoupleAnswers` ("What they told
 *      you"). Their reads are unchanged except the `form_id IS NULL` filter that keeps the library out of them.
 *   2. "Forms sent to <couple>" — each library form sent into this event (by the supplier or on booking), answered
 *      N of M; tapping one shows the couple's answers.
 *   3. "Your forms · the library" — every live form, "N questions · used with N"; tap opens it in the Form Maker.
 *   4. "Added from the service cards they booked" — the library forms linked to a card this booking holds.
 *   Thumb row: Load a form (the Forms Maker sheet: your forms · Suggested for <service> · Also useful for <group>) ·
 *   ＋ New form.
 *
 * Reads — one batched wave, then the dependent ones: the shop's library (5), its booking's cards (2, service role,
 * scoped to THIS shop on THIS event), the plan (1); then this event's sends (1–4) and the suggestions (1–4); plus the
 * three shipped sections' own reads (1 + 3 + 2). A refused part is SAID ("couldn't load"), never drawn as empty.
 */
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { maybeRunFormMediaSweep } from '@/lib/form-media-sweep.server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { asVendorTier, firstPlanWith, TIER_LABEL, tierCaps } from '@/lib/vendor-tier-caps';
import { startersForShopServices } from '@/lib/supplier-question-starters.server';
import { readBookedCardIds, readEventForms, readFormSuggestions, readShopForms } from '@/lib/vendor-forms.server';
import { QuestionsSection } from '@/app/vendor-dashboard/activities/questions-section';
import { QuestionsSendPanel } from '@/app/vendor-dashboard/messages/[threadId]/_components/questions-send-panel';
import { CoupleAnswers } from '../_components/couple-answers';
// ⚡ On-demand code (`./lazy`): the shipped `FormsPageBody`, loaded with this page rather than the route's first load.
import { FormsPageBody } from './lazy';
import type { PickedPageProps } from './context';

export async function FormsPage({ ctx }: PickedPageProps) {
  // 🧹 Cron-free: the daily form-media sweep rides this page's traffic (after the response).
  after(() => maybeRunFormMediaSweep());
  const supabase = await createClient();
  const [profile, library, booked, tierRes] = await Promise.all([
    fetchOwnVendorProfile(supabase, ctx.viewerUserId),
    readShopForms(supabase, ctx.vendorProfileId, ctx.eventId),
    readBookedCardIds(createAdminClient(), ctx.eventId, ctx.vendorProfileId),
    supabase.from('vendor_profiles').select('tier_state').eq('vendor_profile_id', ctx.vendorProfileId).maybeSingle(),
  ]);
  const caps = tierCaps(asVendorTier((tierRes.data as { tier_state: string | null } | null)?.tier_state));
  const lock = (has: boolean, pick: (c: ReturnType<typeof tierCaps>) => boolean) => {
    if (has) return null;
    const plan = firstPlanWith(pick);
    return plan ? TIER_LABEL[plan] : 'a higher plan';
  };
  const locks = { media: lock(caps.formMediaUploads, (c) => c.formMediaUploads), video: lock(caps.formVideoLinks, (c) => c.formVideoLinks) };

  const lib = library.status === 'ok' ? library : null;
  const bookedIds = booked.status === 'ok' ? booked.cardIds : [];
  const bookedCategories = lib ? lib.cards.filter((c) => bookedIds.includes(c.id)).map((c) => c.category) : [];
  const ownCategories = bookedCategories.length ? bookedCategories : (lib?.cards.map((c) => c.category) ?? []);

  const [event, suggestions, starters] = await Promise.all([
    lib
      ? readEventForms(supabase, {
          eventId: ctx.eventId,
          vendorProfileId: ctx.vendorProfileId,
          library: lib.forms,
          cards: lib.cards,
          bookedCardIds: bookedIds,
        })
      : Promise.resolve({ status: 'unread' as const }),
    readFormSuggestions(supabase, ownCategories),
    startersForShopServices(profile?.services ?? null),
  ]);

  return (
    <div className="space-y-8" data-picked-page="forms">
      <section className="space-y-4" aria-label="Questions for the couple">
        <QuestionsSection supabase={supabase} vendorProfileId={ctx.vendorProfileId} starters={starters} />
        {ctx.threadId ? (
          <QuestionsSendPanel
            supabase={supabase}
            threadId={ctx.threadId}
            eventId={ctx.eventId}
            vendorProfileId={ctx.vendorProfileId}
            coupleName={ctx.eventName}
          />
        ) : null}
        {/* The couple's own words open with the event, as on the shipped card (fee-gated). */}
        {ctx.feeUnlocked ? (
          <CoupleAnswers supabase={supabase} eventId={ctx.eventId} vendorProfileId={ctx.vendorProfileId} coupleName={ctx.eventName} />
        ) : null}
      </section>
      <FormsPageBody
        eventId={ctx.eventId}
        coupleName={ctx.eventName}
        canSend={Boolean(ctx.threadId)}
        returnPath={`/vendor-dashboard/clients/${ctx.eventId}`}
        library={lib ? lib.forms : null}
        eventForms={lib ? lib.eventForms : null}
        cards={lib ? lib.cards.map((c) => ({ id: c.id, title: c.title })) : []}
        event={event.status === 'ok' ? event : null}
        bookedUnread={booked.status !== 'ok'}
        suggestions={suggestions.status === 'ok' ? suggestions : null}
        locks={locks}
        answersOpen={ctx.feeUnlocked}
        shopId={ctx.vendorProfileId}
      />
    </div>
  );
}
