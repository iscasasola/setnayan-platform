import { redirect } from 'next/navigation';

/**
 * Legacy /admin/onboarding → Ugat Studio redirect (2026-07-10). The surface now lives
 * at /admin/ugat?tab=onboarding; its body was re-homed into ugat/_surfaces/*.
 * actions/_components stay in this dir (the surface imports them absolutely).
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
  out.set('tab', 'onboarding');
  const saved = first(search.saved);
  if (saved !== undefined) out.set('saved', saved);
  const error = first(search.error);
  if (error !== undefined) out.set('error', error);
  redirect(`/admin/ugat?${out.toString()}`);
}
