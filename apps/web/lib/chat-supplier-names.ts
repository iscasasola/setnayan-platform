/**
 * THE NAME OF THE SUPPLIER IN A COUPLE'S CHAT — every thread, every shop state.
 *
 * 🔴 THE BUG (owner, live, 2026-10-28): the couple's Chats list drew one thread as "Supplier" (avatar "S") beside
 * another drawn as its shop name, and the thread head said "Supplier" too — "the 1 supplier is not named on chat".
 * The list and the head read the shop through a `vendor_profiles` embed under the COUPLE's session, and the only
 * policy that lets a couple read another person's shop is `vendor_profiles_public_read` (public + verified). A free
 * shop not yet verified, one pending review, a verified shop that is hidden or coming soon — RLS refuses the row,
 * PostgREST returns the embed as NULL, and the page printed the literal `'Supplier'` for NULL. A refused read
 * rendered as a plausible name. Proven per shop state in
 * `tests/db/a-couple-sees-every-suppliers-chat-name.db.test.ts`.
 *
 * ✅ NOW: one definer function, `couple_thread_supplier_names(event)` (migration 20271295352678), returns the
 * name inputs for every thread on the couple's event, and this module turns each row into a label with the SAME
 * `resolveVendorDisplayName` every other surface uses. `vendor_profiles` RLS is not widened.
 *
 * 🏷 REAL NAME EVERYWHERE (owner ruling 2026-11-16 (15), migration 20271350551812): the function returns the shop's
 * real business name and logo for EVERY shop, verified or not, and the label is that name. The screen name or
 * "<Service> · <City>" draws only for a shop with no business name on file. `name_revealed` (the SQL twin of
 * `isVendorNameRevealed`) is still carried: it decides whether the shop's STAFF names show in read receipts.
 *
 * 🔑 A READ THAT FAILS SAYS SO. When the function errors, or a thread is missing from its answer, the label is
 * `SUPPLIER_NAME_UNREADABLE` — never a generic word that looks like a real name.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveVendorDisplayName } from '@/lib/vendors';
import { logQueryError } from '@/lib/supabase/error-detect';
import { SUPPLIER_NAME_UNREADABLE } from '@/lib/conversation-list';

export { SUPPLIER_NAME_UNREADABLE };

/** One row of `public.couple_thread_supplier_names(p_event_id)`. */
export type CoupleThreadSupplierRow = {
  thread_id: string;
  vendor_profile_id: string;
  name_revealed: boolean;
  /** The shop's real name — sent for every shop since ruling 2026-11-16 (15); NULL/blank only when none is on file. */
  business_name: string | null;
  /** The shop's stored logo — sent for every shop since ruling 2026-11-16 (15). */
  logo_url: string | null;
  screen_name: string | null;
  primary_service: string | null;
  location_city: string | null;
};

export type ThreadSupplierName = {
  /** The label to print — already anonymity-safe. */
  name: string;
  /** The reveal predicate's answer; FALSE when unreadable. Drives only the receipts' STAFF names now. */
  revealed: boolean;
  /** The stored logo ref (any shop that has one). */
  logoUrl: string | null;
  /** FALSE when the read failed or the thread was missing — `name` is then `SUPPLIER_NAME_UNREADABLE`. */
  readable: boolean;
  /** The shop's first service (for "see similar suppliers"); null when unknown. */
  primaryService: string | null;
};

const UNREADABLE: ThreadSupplierName = {
  name: SUPPLIER_NAME_UNREADABLE,
  revealed: false,
  logoUrl: null,
  readable: false,
  primaryService: null,
};

/** The label for one row. Pure — the db test runs it on the function's real answers. */
export function threadSupplierName(row: CoupleThreadSupplierRow | null | undefined): ThreadSupplierName {
  if (!row) return UNREADABLE;
  const revealed = row.name_revealed === true;
  // 🏷 Ruling 2026-11-16 (15): the real name whenever one is on file, revealed or not.
  const realName = (row.business_name ?? '').trim();
  // A real name → the resolver's named branch. No name on file (whose named branch would print the bare word
  // 'Supplier') → the resolver's stand-in branch: the screen name, else "<Service> · <City>".
  const name = resolveVendorDisplayName(
    realName
      ? {
          business_name: realName,
          name_revealed_at: 'revealed',
          isPaidTier: true,
          services: null,
          primary_canonical_service: row.primary_service,
          location_city: row.location_city,
        }
      : {
          business_name: null,
          name_revealed_at: null,
          isPaidTier: false,
          is_verified: false,
          services: null,
          screen_name: row.screen_name,
          primary_canonical_service: row.primary_service,
          location_city: row.location_city,
        },
  );
  return {
    name,
    revealed,
    logoUrl: row.logo_url ?? null,
    readable: true,
    primaryService: row.primary_service ?? null,
  };
}

export type CoupleThreadSupplierNames = {
  /** thread_id → label. A thread absent from the answer is NOT here — use `nameForThread`. */
  byThread: Map<string, ThreadSupplierName>;
  /** vendor_profile_id → label (one shop reads the same on every thread of the event). */
  byShop: Map<string, ThreadSupplierName>;
  /** TRUE when the function itself failed — every lookup is then unreadable. */
  failed: boolean;
};

/** The label for a thread, honest when it is missing. */
export function nameForThread(names: CoupleThreadSupplierNames, threadId: string): ThreadSupplierName {
  return names.byThread.get(threadId) ?? UNREADABLE;
}

/** Every supplier name on one of the couple's events, under the couple's own session. */
export async function readCoupleThreadSupplierNames(
  supabase: SupabaseClient,
  eventId: string,
): Promise<CoupleThreadSupplierNames> {
  const { data, error } = await supabase.rpc('couple_thread_supplier_names', { p_event_id: eventId });
  const byThread = new Map<string, ThreadSupplierName>();
  const byShop = new Map<string, ThreadSupplierName>();
  if (error) {
    logQueryError('readCoupleThreadSupplierNames', error, { event_id: eventId }, 'graceful_degrade');
    return { byThread, byShop, failed: true };
  }
  for (const row of (data ?? []) as CoupleThreadSupplierRow[]) {
    const label = threadSupplierName(row);
    byThread.set(row.thread_id, label);
    byShop.set(row.vendor_profile_id, label);
  }
  return { byThread, byShop, failed: false };
}
