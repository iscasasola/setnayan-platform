import { redirect } from 'next/navigation';

/**
 * Legacy /admin/addons → studio redirect (Money split · 2026-07-10). The surface
 * now lives at /admin/pricing?tab=addons; its body was re-homed into a _surfaces/*
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
  out.set('tab', 'addons');
  const sku = first(search.sku);
  if (sku !== undefined) out.set('sku', sku);
  redirect(`/admin/pricing?${out.toString()}`);
}
