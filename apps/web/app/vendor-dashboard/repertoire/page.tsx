import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorSongs, searchSongs, fetchCuratedSongs, isMusicVendor } from '@/lib/songs';
import { createAdminClient } from '@/lib/supabase/admin';
import { readShopSpecialToolOpen } from '@/lib/paid-widget-open.server';
import { readPaidWidgetStatus } from '@/lib/supplier-store.server';
import type { ToolStatus } from '@/lib/supplier-store';
import { RepertoireLocked, RepertoireNotMusic, RepertoireUnread, RepertoireView } from './_components/repertoire-view';

export const metadata = { title: 'Your repertoire · Supplier' };

type Props = {
  searchParams: Promise<{ q?: string; saved?: string; error?: string; own?: string }>;
};

export default async function RepertoirePage({ searchParams }: Props) {
  const sp = await searchParams;
  const query = (sp.q ?? '').trim();

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // Not a music act → explain the surface rather than 404 (best-UX over a
  // silent redirect). Nav-level hiding for non-music vendors is a follow-up.
  if (!isMusicVendor(profile.services)) return <RepertoireNotMusic />;

  // 🔒 Song bank is a paid widget (owner a02673ac, 23 Nov): open only when bought once in the Toolkit AND on Plus, Pro or
  // Ultra — the database's one answer. Beside it, the Toolkit's own status for the widget, so a shut lock says WHICH
  // door: owned off-plan → "Works again when you subscribe" and the plans door, never a second Buy. One batch.
  const admin = createAdminClient();
  const [open, widget, repertoire, results] = await Promise.all([
    readShopSpecialToolOpen(admin, profile.vendor_profile_id, 'song_bank'),
    readPaidWidgetStatus(admin, profile.vendor_profile_id, 'song_bank').catch((): ToolStatus => ({ kind: 'unread' })),
    fetchVendorSongs(supabase, profile.vendor_profile_id),
    query ? searchSongs(supabase, query) : fetchCuratedSongs(supabase),
  ]);
  if (open.status === 'unread') return <RepertoireUnread />;
  if (open.status !== 'ok' || !open.data) {
    // A shut Song bank whose status could not be read is said as a failed read — never a Buy offered to an owner by guess.
    if (widget.kind === 'unread') return <RepertoireUnread />;
    return <RepertoireLocked saved={repertoire.length} owned={widget.kind === 'resubscribe'} />;
  }

  return (
    <RepertoireView
      repertoire={repertoire}
      results={results}
      query={query}
      own={sp.own === '1'}
      notice={{ error: sp.error ? decodeURIComponent(sp.error) : null, saved: Boolean(sp.saved) }}
    />
  );
}
