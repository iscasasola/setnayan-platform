import { redirect } from 'next/navigation';

/**
 * Legacy /admin/settings/demo-mode → avatar › Switches › Demo mode (owner go 14 Nov 2026, the approved drawing
 * `admin_five_tabs_2026-11-13/admin.html` `page('switches' …)`). `toggled` is forwarded so an old post-toggle
 * redirect still shows its line.
 */
export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function Redirect({ searchParams }: Props) {
  const search = await searchParams;
  const out = new URLSearchParams();
  const toggled = first(search.toggled);
  if (toggled !== undefined) out.set('toggled', toggled);
  const q = out.toString();
  redirect(`/admin/switches${q ? `?${q}` : ''}#demo-mode`);
}
