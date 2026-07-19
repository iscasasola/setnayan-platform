import { redirect } from 'next/navigation';

/**
 * Legacy /admin/social-queue → Studio Studio redirect (Studio Studio slice 4 ·
 * the final slice).
 *
 * The Social queue now lives at /admin/studio?tab=social-queue; its full body
 * (~1,693 LOC — the whole auto-publish pipeline, take-downs, evergreen library,
 * announce composer, and the manual copy-paste fallback lane) was re-homed
 * byte-identical into app/admin/studio/_surfaces/social-queue-surface.tsx. This
 * stub forwards the incoming success-banner + error params onto the studio route
 * so the markConsentPosted / markConsentTakenDown / markVendorFeatured /
 * postSocialPostNow / pullSocialPost / retrySocialPost / updateSocialPostBody /
 * updatePublishSettings / createAnnouncement / saveEvergreenItem server actions
 * (which all still redirect back to /admin/social-queue?…) surface their banner
 * on the Social queue tab.
 *
 * actions.ts stays STANDALONE and is NOT touched — the re-homed surface imports
 * it from @/app/admin/social-queue/actions. The sidebar item's matchPrefix
 * (/admin/social-queue) keeps Social queue lit while an action's redirect
 * momentarily lands here before this stub forwards it on, and the live count
 * badge (keyed off the unchanged item key) keeps working.
 */
export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminSocialQueueRedirect({ searchParams }: Props) {
  const search = await searchParams;
  const params = new URLSearchParams();
  params.set('tab', 'social-queue');
  for (const key of [
    'posted',
    'vendor_posted',
    'taken_down',
    'settings_saved',
    'pulled',
    'posted_now',
    'retried',
    'body_saved',
    'announcement_created',
    'evergreen_saved',
    'error',
  ]) {
    const val = first(search[key]);
    if (val !== undefined) params.set(key, val);
  }
  redirect(`/admin/studio?${params.toString()}`);
}
