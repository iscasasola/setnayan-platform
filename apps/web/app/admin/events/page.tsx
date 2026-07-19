import { redirect } from 'next/navigation';

/**
 * Legacy /admin/events → Accounts Studio redirect (Accounts Studio slice 1).
 *
 * The Events LIST now lives at /admin/accounts?tab=events; its body was
 * re-homed byte-identical into app/admin/accounts/_surfaces/events-surface.tsx.
 * This stub forwards every incoming search param (q, archived) onto the studio
 * route so bookmarks + deep-links land on the Events tab. deleteEvent's
 * revalidatePath('/admin/events') still fires harmlessly against this stub.
 *
 * NOTE: actions.ts is intentionally NOT moved — the re-homed surface imports
 * deleteEvent from here.
 */
export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminEventsRedirect({ searchParams }: Props) {
  const search = await searchParams;
  const params = new URLSearchParams();
  params.set('tab', 'events');
  for (const key of ['q', 'archived']) {
    const val = first(search[key]);
    if (val !== undefined) params.set(key, val);
  }
  redirect(`/admin/accounts?${params.toString()}`);
}
