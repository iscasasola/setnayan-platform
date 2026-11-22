import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorSongs, searchSongs, fetchCuratedSongs, isMusicVendor } from '@/lib/songs';
import { RepertoireNotMusic, RepertoireView } from './_components/repertoire-view';

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

  const [repertoire, results] = await Promise.all([
    fetchVendorSongs(supabase, profile.vendor_profile_id),
    query ? searchSongs(supabase, query) : fetchCuratedSongs(supabase),
  ]);

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
