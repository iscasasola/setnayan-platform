import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchBooths } from '@/lib/seating';

/**
 * A7-01 (final check 25 Nov): THE booth join the venue walk's first scene makes — each booth vendor's public shop slug
 * ("Book this supplier"), `bookable` (verified only) and the paid 3D Booth add-on (`boothAddonActive`, the branding
 * gate). The `public_venue_scene` RPC predates these fields. The page AND the live-refresh route
 * (`/api/venue-scene/[slug]`) call this one function, so a refresh never drops them and never "differs" from the first
 * scene only because one side skipped the join. Fail-soft: no event → the scene unchanged.
 */
export async function withBoothShopFacts<
  S extends { booths?: Array<{ id: string; vendor?: Record<string, unknown> | null }> | null },
>(admin: SupabaseClient, scene: S, eventId: string | null): Promise<S> {
  if (!eventId || !scene.booths || scene.booths.length === 0) return scene;
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
  return {
    ...scene,
    booths: scene.booths.map((b) =>
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
