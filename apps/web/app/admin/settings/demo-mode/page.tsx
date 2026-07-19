import { redirect } from 'next/navigation';

/**
 * Legacy /admin/settings/demo-mode → studio redirect (Money split · 2026-07-10). The surface
 * now lives at /admin/settings?tab=demo-mode; its body was re-homed into a _surfaces/*
 * file. actions/_components stay in this dir. Params are forwarded so deep-links
 * + post-mutation redirects land on the right tab with their flash intact.
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
  out.set('tab', 'demo-mode');
  const toggled = first(search.toggled);
  if (toggled !== undefined) out.set('toggled', toggled);
  redirect(`/admin/settings?${out.toString()}`);
}
