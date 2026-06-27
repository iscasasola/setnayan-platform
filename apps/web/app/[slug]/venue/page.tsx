import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { GuestVenueLoader } from './_components/guest-venue-loader';
import { sanitizeRolePalette } from '@/lib/mood-board';
import type { VenueScene } from './_components/guest-venue-3d';

// Guest-facing 3D venue explorer (owner 2026-06-26, Sims-style). Public, no
// session: a guest opens this from their invite (the `?t=` personal token
// surfaces their own seat) or directly. All data + privacy scoping lives in the
// SECURITY DEFINER public_venue_scene() RPC — this page just calls it and hands
// the result to the WebGL scene. force-dynamic: the token + scene are per-request.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Explore the venue · Setnayan' };

export default async function VenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { slug } = await params;
  const { t } = await searchParams;
  const token = (t ?? '').trim() || null;

  const admin = createAdminClient();
  const [{ data, error }, paletteRow] = await Promise.all([
    admin.rpc('public_venue_scene', { p_slug: slug, p_token: token }),
    admin.from('events').select('role_palette').eq('slug', slug).maybeSingle(),
  ]);
  const rolePalette = sanitizeRolePalette(paletteRow.data?.role_palette ?? null);
  const scene = data ? ({ ...(data as object), rolePalette } as VenueScene) : null;

  if (error || !scene || !scene.published) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0d12] p-6 text-center">
        <div className="max-w-sm">
          <p className="text-lg font-medium text-white">The 3D venue isn&rsquo;t ready yet</p>
          <p className="mt-2 text-sm text-white/60">
            The couple hasn&rsquo;t posted their seating plan. Check back closer to the day.
          </p>
          <Link href={`/${slug}`} className="mt-5 inline-block rounded-xl bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20">
            ← Back to the wedding
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b0d12] p-3 sm:p-5">
      <div className="mx-auto max-w-5xl">
        <div className="mb-3 flex items-center justify-between px-1">
          <h1 className="text-lg font-medium text-white">Explore the venue</h1>
          <Link href={`/${slug}`} className="text-sm text-white/60 hover:text-white">
            ← Back
          </Link>
        </div>
        <GuestVenueLoader scene={scene} />
      </div>
    </main>
  );
}
