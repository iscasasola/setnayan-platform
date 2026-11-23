import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorSongs, searchSongs, fetchCuratedSongs, isMusicVendor } from '@/lib/songs';
import { createAdminClient } from '@/lib/supabase/admin';
import { readShopSpecialToolOpen } from '@/lib/cake-maker.server';
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

  // 🔒 Song bank is a paid widget (owner via the controller, 23 Nov): open when bought once in the Toolkit or the plan
  // includes it — the Cake Maker's own gate. Asked with the page's reads, one batch.
  const [open, repertoire, results] = await Promise.all([
    readShopSpecialToolOpen(createAdminClient(), profile.vendor_profile_id, 'song_bank'),
    fetchVendorSongs(supabase, profile.vendor_profile_id),
    query ? searchSongs(supabase, query) : fetchCuratedSongs(supabase),
  ]);
  if (open.status === 'unread') return <RepertoireUnread />;
  if (open.status !== 'ok' || !open.data) return <RepertoireLocked saved={repertoire.length} />;

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
