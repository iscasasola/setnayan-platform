import { RoomFooter } from '../_components/room-footer';
import { loadRoomLinks } from '../_lib/room-links.server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eventNoun } from '@/lib/event-noun';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchBooths } from '@/lib/seating';
import { GuestVenueLoader } from './_components/guest-venue-loader';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { resolveBoothStudioContent } from '@/lib/booth-studio';
import type { VenueScene } from './_components/guest-venue-3d';

// Guest-facing 3D venue explorer (owner 2026-06-26, Sims-style). Public, no
// session: a guest opens this from their invite (the `?t=` personal token
// surfaces their own seat) or directly. All data + privacy scoping lives in the
// SECURITY DEFINER public_venue_scene() RPC — this page just calls it and hands
// the result to the WebGL scene. force-dynamic: the token + scene are per-request.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Explore the venue' };

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
    // `.ilike` like the main page and the other guest sub-routes — `.eq` made
    // `/Cale-Ice/venue` a dead end while `/Cale-Ice` opened fine.
    admin
      .from('events')
      // `event_date` joins the row that was ALREADY being read — the room strip
      // needs it to know whether the live hub's window is open. One more column
      // on an existing query, not a second round trip.
      .select('event_id, event_type, role_palette, event_date, slug')
      .ilike('slug', slug)
      .maybeSingle(),
  ]);
  // THE ONE CHECK THIS PAGE NEVER MADE: DOES THE EVENT EXIST?
  //
  // `public_venue_scene` returns `{"published": false}` — no error — when NO
  // EVENT MATCHES THE SLUG. So a mistyped address, or an old link, fell into
  // the same plate as a real event whose plan is not up yet, and a stranger was
  // told that a specific couple had not posted their seating plan for a couple
  // who does not exist. The "back to the wedding" button under it then
  // dead-ended on a 404. This is the only guest sub-route with no existence
  // check — seat, find-seat, find-my-table, hub, recap, pabuya and print all
  // call notFound().
  //
  // The row that answers it was already being read for the palette.
  if (paletteRow.error) {
    // Same rule as the rest of the guest site: a failed read is NOT a missing
    // event. Saying "no such wedding" because a query stumbled is the lie.
    throw new Error(`venue: could not read the event for "${slug}": ${paletteRow.error.message}`);
  }
  if (!paletteRow.data) notFound();

  const rolePalette = sanitizeRolePalette(paletteRow.data?.role_palette ?? null);
  const noun = eventNoun((paletteRow.data as { event_type?: string | null }).event_type);
  let scene = data ? ({ ...(data as object), rolePalette } as VenueScene) : null;
  // Event UUID (top-scope) — the shared-room channel scope for the 3D walk, and
  // the booth-slug join below.
  const eventId = (paletteRow.data as { event_id?: string } | null)?.event_id ?? null;

  // The other rooms this event has. EARNED: this page refuses a stranger on a
  // private event above, the same gate the money-gift page applies.
  const eventRow = paletteRow.data as {
    event_id: string;
    slug: string | null;
    event_type: string | null;
    event_date: string | null;
  };
  const roomLinks = await loadRoomLinks({
    event: eventRow,
    current: 'venue',
    guestToken: token,
    pabuyaViewerAllowed: true,
  });

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
    // Logos AND per-event posters are both raw refs on the same vendor block,
    // so resolve them in ONE batch — a booth commonly carries both.
    const logoRefs = [
      ...new Set(
        scene.booths
          .flatMap((b) => [b.vendor?.logoUrl, b.vendor?.posterUrl])
          .filter((r): r is string => !!r),
      ),
    ];
    if (logoRefs.length > 0) {
      const resolvedLogos: Record<string, string> = Object.fromEntries(
        (
          await Promise.all(logoRefs.map(async (ref) => [ref, await displayUrlForStoredAsset(ref)] as const))
        ).filter((e): e is [string, string] => e[1] !== null),
      );
      // Booth Studio: resolve the STRUCTURED poster content and attach the
      // vendor logo as a PUBLIC (never presigned) URL — read from the RAW logo
      // ref BEFORE it is overwritten with the presigned display URL. Harmless
      // when the render flag is off (nothing reads it).
      const publicBase = process.env.R2_PUBLIC_URL;
      scene = {
        ...scene,
        booths: scene.booths.map((b) => {
          const v = b.vendor;
          if (!v) return b;
          const studio = resolveBoothStudioContent(
            (v as { posterContent?: unknown }).posterContent,
            v.logoUrl,
            publicBase,
          );
          if (!v.logoUrl && !v.posterUrl && !studio) return b;
          return {
            ...b,
            vendor: {
              ...v,
              logoUrl: v.logoUrl ? resolvedLogos[v.logoUrl] ?? null : null,
              posterUrl: v.posterUrl ? resolvedLogos[v.posterUrl] ?? null : null,
              ...(studio ? { posterContent: studio } : {}),
            },
          };
        }),
      };
    }

    // Booth vendors' marketplace profile slugs (the booth card's free
    // "Book this vendor" CTA — owner-locked surface D) AND the paid 3D Booth
    // add-on entitlement (owner 2026-07-22 — gates whether the booth brands).
    // The RPC payload predates both fields, so join them here via fetchBooths,
    // which nulls the slug unless the profile is publicly visible, carries
    // `bookable` (verified-only), and resolves `boothAddonActive`
    // (isVendor3dBoothActive(booth_addon_expires_at)) — THE gate the client's
    // boothIsBranded render check requires on top of the Pro/Enterprise tier.
    // Public business info only; fail-soft (a missing event row → no CTA, and
    // boothAddonActive defaults false → the generic unbranded booth).
    if (eventId) {
      const boothRows = await fetchBooths(admin, eventId);
      const profileById = new Map(
        boothRows.map((b) => [
          b.booth_id,
          {
            slug: b.vendor?.slug ?? null,
            bookable: b.vendor?.bookable ?? false,
            boothAddonActive: b.vendor?.boothAddonActive ?? false,
          },
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
                  boothAddonActive: profileById.get(b.id)?.boothAddonActive ?? false,
                },
              }
            : b,
        ),
      };
    }
  }

  // Three unrelated causes used to share one plate. The event-does-not-exist
  // case is gone (notFound() above); these are the remaining two, and they need
  // different words because they ask different things of the reader: one says
  // come back later, the other says try again now.
  if (error || !scene) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0d12] p-6 text-center">
        <div className="max-w-sm">
          <p className="text-lg font-medium text-white">The 3D venue didn&rsquo;t load</p>
          <p className="mt-2 text-sm text-white/60">
            Your link is fine — something on our end is having trouble. Give it a
            moment and try again.
          </p>
          <Link href={`/${slug}/venue`} className="mt-5 inline-block rounded-xl bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20">
            Try again
          </Link>
        </div>
      </main>
    );
  }

  if (!scene.published) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0d12] p-6 text-center">
        <div className="max-w-sm">
          <p className="text-lg font-medium text-white">The 3D venue isn&rsquo;t ready yet</p>
          <p className="mt-2 text-sm text-white/60">
            The seating plan hasn&rsquo;t been posted. Check back closer to the day.
          </p>
          <Link href={`/${slug}`} className="mt-5 inline-block rounded-xl bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20">
            ← Back to the {noun}
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
        <GuestVenueLoader scene={scene} eventId={eventId} />
      </div>
      <RoomFooter links={roomLinks} tone="dark" />
    </main>
  );
}
