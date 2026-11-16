'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { cleanInviteSlug, supplierInvitePath } from '@/lib/supplier-invite';
import { revalidateShopPage } from '@/lib/shop-page-cache';

/**
 * 🤝 A shop that ALREADY exists joins through another shop's invite link ("I already have a Setnayan shop", signed
 * in). The handshake is made — one accepted `invited` partnership — but it never counts toward the inviter's Invites
 * badge (owner 16 Nov, answer 2). The joiner is always the caller's own shop, resolved by the database
 * (`join_supplier_invite`), never a form value.
 */
export async function joinSupplierInvite(formData: FormData) {
  const slug = cleanInviteSlug(formData.get('slug'));
  if (!slug) redirect('/vendor-dashboard/partnerships');
  const back = supplierInvitePath(slug);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(back)}&as=vendor`);

  const { data, error } = await supabase.rpc('join_supplier_invite', { p_inviter_slug: slug });
  if (error) {
    const msg = /not_your_shop/.test(error.message ?? '')
      ? 'Open your shop first, then join from this link.'
      : 'We couldn’t join you just now. Please try again.';
    redirect(`${back}?error=${encodeURIComponent(msg)}`);
  }
  const outcome = String(data ?? '');
  if (outcome === 'self') redirect(`${back}?error=${encodeURIComponent('This is your own invite link.')}`);
  if (outcome === 'no_shop') redirect(`${back}?error=${encodeURIComponent('This invite link no longer opens a shop.')}`);

  revalidatePath('/vendor-dashboard/partnerships');
  revalidateShopPage(null, slug);
  redirect(`/vendor-dashboard/partnerships?${outcome === 'already' ? 'already' : 'joined'}=1`);
}
