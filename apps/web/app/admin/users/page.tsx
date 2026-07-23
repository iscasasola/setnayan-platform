import { redirect } from 'next/navigation';

/**
 * Legacy /admin/users → Accounts Studio redirect (Accounts Studio slice 1).
 *
 * The Users LIST now lives at /admin/accounts?tab=users; its body was
 * re-homed byte-identical into app/admin/accounts/_surfaces/users-surface.tsx.
 * This stub forwards every incoming search param (q, filter, plus the transient
 * flags the users server-actions still redirect here with — expand, grant_banner,
 * signed_out, error) onto the studio route so bookmarks, deep-links, AND every
 * post-action redirect land correctly on the Users tab. (The reset-password temp
 * password now rides a short-TTL httpOnly cookie, NOT a query param — see
 * resetUserPassword — so temp_password/for_email are deliberately not forwarded.)
 *
 * NOTE: actions.ts is intentionally NOT moved — the re-homed surface imports it
 * from here, and its redirects to /admin/users?… flow through this stub.
 */
export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminUsersRedirect({ searchParams }: Props) {
  const search = await searchParams;
  const params = new URLSearchParams();
  params.set('tab', 'users');
  for (const key of [
    'q',
    'filter',
    'expand',
    'grant_banner',
    'signed_out',
    'error',
  ]) {
    const val = first(search[key]);
    if (val !== undefined) params.set(key, val);
  }
  redirect(`/admin/accounts?${params.toString()}`);
}
