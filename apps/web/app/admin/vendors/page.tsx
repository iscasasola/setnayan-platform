import { redirect } from 'next/navigation';

/**
 * Legacy /admin/vendors → Accounts Studio redirect (Accounts Studio slice 3).
 *
 * The Vendors LIST now lives at /admin/accounts?tab=vendors; its body was
 * re-homed byte-identical into app/admin/accounts/_surfaces/vendors-surface.tsx.
 * This stub forwards every incoming search param (q, status) onto the studio
 * route so bookmarks + deep-links land on the Vendors tab. The
 * createAdminVendorInvite/revokeAdminVendorInvite server actions
 * revalidatePath('/admin/vendors') still fires harmlessly against this stub;
 * neither redirects the LIST with banner params (the invite form surfaces its
 * result inline via AdminInviteResult, and the grant/tier actions redirect to
 * the standalone /admin/vendors/[id]/tokens route, which is untouched).
 *
 * NOTE: actions.ts + _components/invite-vendor-form.tsx + loading.tsx +
 * [vendorProfileId]/ (edit + tokens + team detail routes) are intentionally
 * NOT moved — the re-homed surface imports the invite form + revoke action
 * from here, and the row links point at those standalone detail routes.
 */
export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminVendorsRedirect({ searchParams }: Props) {
  const search = await searchParams;
  const params = new URLSearchParams();
  params.set('tab', 'vendors');
  for (const key of ['q', 'status']) {
    const val = first(search[key]);
    if (val !== undefined) params.set(key, val);
  }
  redirect(`/admin/accounts?${params.toString()}`);
}
