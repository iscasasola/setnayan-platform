'use server';
/**
 * favorite-actions.ts — THE ONE FAVORITES ACTION (owner 2026-11-06, "Favorites after an event").
 *
 * ONE dispatcher instead of three exports — the app sits at its server-action ceiling
 * (`scripts/lint-server-action-budget.mjs`). It REPLACES `saveAttendedVendorAction` (app/[slug]/actions.ts), so the
 * count does not move.
 *
 *   op 'guest'  — the Hub's after-event list, a FORM (bound args + the posted FormData). Checked in at the door, and
 *                 the service was booked on the event → kept; then back to the Hub with `?save=`.
 *   op 'host'   — the Booked row and the review page. A host/co-host (never a coordinator), the day behind us, the
 *                 service booked on the event → kept. Answers in place.
 *   op 'remove' — Library › Favorites, the row's swipe (after the Undo window). The person's own rows only (RLS).
 *
 * 🔒 EVERY op re-checks on the server (`favoriteGate`). The bound ids are claims from the client, never facts.
 */
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { favoriteGate, removeFavorite, writeFavorite } from '@/lib/favorites.server';
import { favoriteRefusalWords, type FavoriteRefusal } from '@/lib/favorites';

export type FavoriteInput =
  | { op: 'guest'; eventId: string; slug: string; shopId: string; serviceId: string | null }
  | { op: 'host'; eventId: string; shopId: string; serviceId: string | null }
  | { op: 'remove'; shopId: string; serviceId: string | null };

export type FavoriteResult = { ok: true } | { ok: false; why: FavoriteRefusal | 'failed'; error: string };

const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export async function favoriteAction(input: FavoriteInput, _form?: FormData): Promise<FavoriteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const shopId = clean(input?.shopId);
  const serviceId = clean(input?.serviceId) || null;

  if (input?.op === 'guest') {
    const slug = clean(input.slug);
    // No real account (signed out OR an unsecured anon draft) → make/secure one first (the page's claim box).
    if (!user || user.is_anonymous) return redirect(`/${slug}?save=needs_account`);
    const eventId = clean(input.eventId);
    if (!eventId || !shopId) return redirect(`/${slug}?save=error`);
    const admin = createAdminClient();
    const verdict = await favoriteGate(admin, { userId: user.id, eventId, shopId, serviceId, as: 'guest' });
    if (!verdict.ok) return redirect(`/${slug}?save=${verdict.why === 'not_checked_in' ? 'not_there' : 'error'}`);
    const wrote = await writeFavorite(admin, { userId: user.id, eventId, shopId, serviceId });
    return redirect(`/${slug}?save=${wrote.ok ? 'ok' : 'error'}`);
  }

  if (!user || user.is_anonymous) return { ok: false, why: 'signed_out', error: favoriteRefusalWords('signed_out') };
  if (!shopId) return { ok: false, why: 'failed', error: 'That did not save. Nothing changed.' };

  if (input?.op === 'host') {
    const eventId = clean(input.eventId);
    if (!eventId) return { ok: false, why: 'failed', error: 'That did not save. Nothing changed.' };
    const admin = createAdminClient();
    const verdict = await favoriteGate(admin, { userId: user.id, eventId, shopId, serviceId, as: 'host' });
    if (!verdict.ok) return { ok: false, why: verdict.why, error: favoriteRefusalWords(verdict.why) };
    const wrote = await writeFavorite(admin, { userId: user.id, eventId, shopId, serviceId });
    if (!wrote.ok) return { ok: false, why: 'failed', error: 'That did not save. Nothing changed.' };
    revalidatePath('/dashboard/library');
    return { ok: true };
  }

  if (input?.op === 'remove') {
    const gone = await removeFavorite(supabase, { userId: user.id, shopId, serviceId });
    if (!gone.ok) return { ok: false, why: 'failed', error: 'Couldn’t remove that favorite. It’s back — try again.' };
    return { ok: true };
  }

  return { ok: false, why: 'failed', error: 'That did not save. Nothing changed.' };
}
