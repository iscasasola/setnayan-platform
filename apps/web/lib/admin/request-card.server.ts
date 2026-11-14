import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * The two lookups a Work request card needs beside its queue's own row (admin request cards, owner 2026-11-14): the
 * SHOP a request is about and the PERSON who asked. Kept out of `queue-peek.ts` on purpose — that file reads queue
 * tables only through `open()`, so the badge and the list can never disagree (queue-peek-coverage.test.ts). These are
 * not queue reads: they name a row, they do not count one.
 *
 * A failed read returns an empty map, and the card then says "A supplier" / "Someone" — plain words, never a code.
 */

export type ShopLite = { name: string; slug: string | null; logo: string | null; ownerId: string | null };

export async function readShops(ids: ReadonlyArray<string | null | undefined>): Promise<Map<string, ShopLite>> {
  const out = new Map<string, ShopLite>();
  const uniq = [...new Set(ids.filter((v): v is string => typeof v === 'string' && v.length > 0))];
  if (uniq.length === 0) return out;
  const { data, error } = await createAdminClient()
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name, business_slug, logo_url, user_id')
    .in('vendor_profile_id', uniq);
  if (error) {
    logQueryError('requestCard.readShops vendor_profiles', error, {}, 'graceful_degrade');
    return out;
  }
  for (const r of (data ?? []) as Array<{
    vendor_profile_id: string;
    business_name: string | null;
    business_slug: string | null;
    logo_url: string | null;
    user_id: string | null;
  }>) {
    out.set(r.vendor_profile_id, {
      name: r.business_name?.trim() || 'A supplier',
      slug: r.business_slug,
      logo: r.logo_url,
      ownerId: r.user_id,
    });
  }
  return out;
}

export async function readPeople(ids: ReadonlyArray<string | null | undefined>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const uniq = [...new Set(ids.filter((v): v is string => typeof v === 'string' && v.length > 0))];
  if (uniq.length === 0) return out;
  const { data, error } = await createAdminClient()
    .from('users')
    .select('user_id, display_name, first_name, last_name, email')
    .in('user_id', uniq);
  if (error) {
    logQueryError('requestCard.readPeople users', error, {}, 'graceful_degrade');
    return out;
  }
  for (const r of (data ?? []) as Array<{
    user_id: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  }>) {
    const full = [r.first_name, r.last_name].filter((x) => x && x.trim()).join(' ').trim();
    out.set(r.user_id, r.display_name?.trim() || full || r.email || 'Someone');
  }
  return out;
}

/** Display address for a stored image, or null — a presign failure is a missing picture, never a broken page. */
export async function picture(ref: string | null | undefined): Promise<string | null> {
  if (!ref) return null;
  try {
    return await displayUrlForStoredAsset(ref);
  } catch {
    return null;
  }
}

