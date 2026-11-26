import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { TemplateFail } from '@/app/_components/template-rows';
import { ActivitiesView } from './_components/activities-view';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { offeredCatalogue, totalMinutes, type VendorActivity } from '@/lib/vendor-activities';
import { logQueryError } from '@/lib/supabase/error-detect';
import { QuestionsSection } from './questions-section';
import { startersForShopServices } from '@/lib/supplier-question-starters.server';

export const metadata = { title: 'Your segments · Supplier' };

/**
 * THE EMCEE'S SEGMENTS — where a host/MC writes down what he does, once.
 *
 * Sibling of `/vendor-dashboard/repertoire` (a band's songs), and deliberately
 * the same kind of screen: a vendor-owned reusable list, plain form posts, no
 * client state machine. What differs is the payload — a segment carries a
 * LENGTH, because that is what lets a picked one become a block on the
 * couple's timeline.
 *
 * WHY THIS IS WORTH THE VENDOR'S TIME (the copy says it, and it is true): the
 * list is written once and reused for every customer after. It is the emcee's
 * craft, and per the owner's 2026-07-27 split it travels with him while a
 * couple's answers never do.
 *
 * RETIRE, NEVER DELETE. Past couples' picks reference these rows; deleting one
 * would cascade their pick away and rewrite a day they can still look back on.
 * So the only removal on this screen is a soft "stop offering".
 */


export default async function VendorActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/vendor-dashboard/activities');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  // The one "no shop" landing, as every other tool (final check A5-G2-12).
  if (!profile) redirect('/vendor-dashboard');

  const { data, error: activitiesError } = await supabase
    .from('vendor_activities')
    .select(
      'activity_id, vendor_profile_id, label, blurb, duration_minutes, block_type, is_offered, display_order',
    )
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .order('display_order', { ascending: true });

  // ⚠ THE PROGRAMME THEY WROTE ONCE AND REUSE AT EVERY WEDDING. Refused, `?? []`
  // ⚠ empties it, and this page's whole promise — "you keep the list, it stays
  // ⚠ yours from wedding to wedding" — reads as broken.
  if (activitiesError) {
    logQueryError(
      'VendorActivitiesPage.activities',
      activitiesError,
      { vendorProfileId: profile.vendor_profile_id },
      'graceful_degrade',
    );
  }
  const measured = !activitiesError && data !== null;
  const all = (data ?? []) as VendorActivity[];
  const offered = offeredCatalogue(all);
  const retired = all.filter((a) => !a.is_offered);
  const minutes = totalMinutes(offered);

  return (
    <ActivitiesView
      offered={offered}
      retired={retired}
      minutes={minutes}
      measured={measured}
      sp={sp}
      unread={
                  <TemplateFail data="activities">
                    <strong>We couldn&rsquo;t load your segments.</strong> Your list has not been emptied
                    and couples can still pick from it — reload before writing it out again.
                  </TemplateFail>
      }
      questions={
        // DAY-7 · what only the couple can tell them — the supplier's reusable questions. ❓ Every supplier since
        // 2026-11-04 (owner "Yes, every supplier"): the shop's own doorway lands on `#questions`, and the starting
        // suggestions follow the shop's trade through the live taxonomy.
        <QuestionsSection
          supabase={supabase}
          vendorProfileId={profile.vendor_profile_id}
          starters={await startersForShopServices(profile.services)}
        />
      }
    />
  );
}
