import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchBooths } from '@/lib/seating';
import { GuestVenueLoader } from './_components/guest-venue-loader';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { displayUrlForStoredAsset } from '@/lib/uploads';
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
    admin.from('events').select('event_id, role_palette').eq('slug', slug).maybeSingle(),
  ]);
  const rolePalette = sanitizeRolePalette(paletteRow.data?.role_palette ?? null);
  let scene = data ? ({ ...(data as object), rolePalette } as VenueScene) : null;

  // The RPC returns guest photos as RAW stored refs (r2:// or bare URL) — the
  // client can't resolve an r2:// ref, so we do it HERE. Mirrors the 3D-demo
  // resolver (`plan3d-demo-actions.ts`): dedupe the distinct refs, resolve them
  // all in parallel via `displayUrlForStoredAsset`, drop any that fail, then
  // rewrite each seat's `photoUrl` to its display URL. The RPC already privacy-
  // gates which photos appear (token-only, host setting) — this step is purely
  // ref → URL. `photos` is null/absent for 'none' and the tokenless view.
  if (scene?.photos && scene.photos.length > 0) {
    const distinctRefs = [...new Set(scene.photos.map((p) => p.photoUrl).filter((r): r is string => !!r))];
    const resolved: Record<string, string> = Object.fromEntries(
      (
        await Promise.all(distinctRefs.map(async (ref) => [ref, await displayUrlForStoredAsset(ref)] as const))
      ).filter((e): e is [string, string] => e[1] !== null),
    );
    scene = {
      ...scene,
      photos: scene.photos.map((p) => ({ ...p, photoUrl: p.photoUrl ? resolved[p.photoUrl] ?? null : null })),
    };
  }

  // Booth VENDOR logos ride as RAW stored refs too (v4 RPC) — resolve them the
  // same way, so the booth vendor card shows the business logo, not an r2:// ref.
  // Public business info (no token gate); this is purely ref → display URL.
  if (scene?.booths && scene.booths.length > 0) {
    const logoRefs = [
      ...new Set(scene.booths.map((b) => b.vendor?.logoUrl).filter((r): r is string => !!r)),
    ];
    if (logoRefs.length > 0) {
      const resolvedLogos: Record<string, string> = Object.fromEntries(
        (
          await Promise.all(logoRefs.map(async (ref) => [ref, await displayUrlForStoredAsset(ref)] as const))
        ).filter((e): e is [string, string] => e[1] !== null),
      );
      scene = {
        ...scene,
        booths: scene.booths.map((b) =>
          b.vendor?.logoUrl
            ? { ...b, vendor: { ...b.vendor, logoUrl: resolvedLogos[b.vendor.logoUrl] ?? null } }
            : b,
        ),
      };
    }

    // Booth vendors' marketplace profile slugs (the booth card's free
    // "Book this vendor" CTA — owner-locked surface D). The RPC payload
    // predates the slug field, so join it here via fetchBooths, which already
    // nulls the slug unless the profile is publicly visible — and carries
    // `bookable` (verified-only) so the card only says "Book" when the
    // profile can actually take bookings. Public business info only;
    // fail-soft (a missing event row just means no CTA).
    const eventId = (paletteRow.data as { event_id?: string } | null)?.event_id;
    if (eventId) {
      const boothRows = await fetchBooths(admin, eventId);
      const profileById = new Map(
        boothRows.map((b) => [
          b.booth_id,
          { slug: b.vendor?.slug ?? null, bookable: b.vendor?.bookable ?? false },
        ]),
      );
      scene = {
        ...scene,
        booths: (scene.booths ?? []).map((b) =>
          b.vendor
            ? {
                ...b,
                vendor: {
                  ...b.vendor,
                  slug: profileById.get(b.id)?.slug ?? null,
                  bookable: profileById.get(b.id)?.bookable ?? false,
                },
              }
            : b,
        ),
      };
    }
  }

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
