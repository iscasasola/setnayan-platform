import { redirect } from 'next/navigation';

/**
 * Legacy /admin/recaps → Studio Studio redirect (Studio Studio slice 1).
 *
 * Auto-Recap oversight now lives at /admin/studio?tab=recaps; its body was
 * re-homed byte-identical into app/admin/studio/_surfaces/recaps-surface.tsx.
 * This stub forwards the incoming ok / error search params onto the studio
 * route so the adminTakedownRecap redirect (which currently returns to
 * /admin/recaps?ok=… / ?error=…) still surfaces its banner on the Recaps tab.
 *
 * NOTE: actions.ts is intentionally NOT moved — the re-homed surface imports
 * adminTakedownRecap from here.
 */
export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminRecapsRedirect({ searchParams }: Props) {
  const search = await searchParams;
  const params = new URLSearchParams();
  params.set('tab', 'recaps');
  for (const key of ['ok', 'error']) {
    const val = first(search[key]);
    if (val !== undefined) params.set(key, val);
  }
  redirect(`/admin/studio?${params.toString()}`);
}
