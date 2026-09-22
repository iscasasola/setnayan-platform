'use server';

/**
 * /signup/you — the one card after the account exists (owner 2026-09-22).
 *
 * `saveYou` writes what the You card asked: display name (required), the
 * formal name, the phone, the photo, and — for an account that has none yet —
 * the @account name. The fields go through the profile page's OWN plan builder
 * (`planYouCard` → `planPersonalInfoPatch`), and the @name through the same
 * availability answer every address in the product uses (`findSlugConflict`),
 * so this card can never disagree with Profile & settings about a value.
 *
 * `checkAccountName` is the live availability call the card makes while the
 * person types — the sibling of `checkShopAddress` on /open-shop, delegating
 * to the same `findSlugConflict`, and failing CLOSED (`unknown`) when the probe
 * errors, so a network hiccup never reads as "available".
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { safeNext } from '@/lib/auth';
import { findSlugConflict, SLUG_CONFLICT_MESSAGE, SLUG_FORMAT } from '@/lib/slug-availability';
import { isReservedSlug } from '@/lib/reserved-slugs';
import { insertFaultLog } from '@/lib/telemetry/fault-log';
import { planYouCard, youHref, YOU_ERRORS } from '@/lib/signup-landing';

function backWithError(next: string, error: string): never {
  const sep = youHref(next).includes('?') ? '&' : '?';
  redirect(`${youHref(next)}${sep}error=${encodeURIComponent(error)}`);
}

export async function saveYou(formData: FormData): Promise<void> {
  const next = safeNext(formData.get('next'));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/signup?next=${encodeURIComponent(next)}`);

  const { data: mine } = await supabase
    .from('users')
    .select('slug, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  const plan = planYouCard(formData, {
    slug: (mine?.slug as string | null) ?? null,
    accountType: (mine?.account_type as string | null) ?? null,
  });
  if (!plan.ok) backWithError(next, plan.error);

  if (plan.slug) {
    // The same four-namespace question every address answers (events, people,
    // shops, retired-but-forwarding). `unverified` fails closed: a probe that
    // could not run is not proof the word is free, and the word is public.
    const conflict = await findSlugConflict(createAdminClient(), plan.slug, { userId: user.id });
    if (conflict) backWithError(next, SLUG_CONFLICT_MESSAGE[conflict]);
  }

  const { error } = await supabase
    .from('users')
    .update({
      ...plan.patch,
      ...(plan.slug ? { slug: plan.slug } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id);
  if (error) {
    if (error.code === '23505') backWithError(next, YOU_ERRORS.slugJustTaken);
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Save the You card',
      file_path: 'app/signup/you/actions.ts',
      error_message: error.message,
      payload_snapshot: { userId: user.id, columns: Object.keys(plan.patch) },
    });
    backWithError(next, error.message);
  }

  revalidatePath('/dashboard', 'layout');
  redirect(next);
}

export type AccountNameCheck =
  | { state: 'empty' }
  | { state: 'invalid' }
  | { state: 'reserved' }
  | { state: 'free'; slug: string }
  | { state: 'taken'; slug: string; message: string }
  | { state: 'unknown'; slug: string };

export async function checkAccountName(raw: string): Promise<AccountNameCheck> {
  const slug = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!slug) return { state: 'empty' };
  if (!SLUG_FORMAT.test(slug)) return { state: 'invalid' };
  if (isReservedSlug(slug)) return { state: 'reserved' };
  try {
    const conflict = await findSlugConflict(createAdminClient(), slug);
    if (conflict === null) return { state: 'free', slug };
    if (conflict === 'unverified') return { state: 'unknown', slug };
    return { state: 'taken', slug, message: SLUG_CONFLICT_MESSAGE[conflict] };
  } catch {
    return { state: 'unknown', slug };
  }
}
