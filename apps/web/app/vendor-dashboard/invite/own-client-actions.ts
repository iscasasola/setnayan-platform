'use server';

/**
 * 🎁 OWN CLIENTS v3 + v4 — ONE action, two modes (the server-action budget, `scripts/lint-server-action-budget.mjs`):
 *
 *   · `mode=add` (Customers › QR codes › Add a client): saves the client and the gift(s) picked FROM STOCK, and answers
 *     the invite link the supplier then sends from their own phone's share sheet (owner 16 Nov: no Setnayan email, no
 *     SMS). Nothing leaves the stock here — one gift is used when the couple JOINS (`own_client_gift_give`).
 *   · `mode=own_link` (Shop › Promote › My page): sets the ONE gift on the shop's own link / QR (v4 answer 1).
 *
 * Every gift is read from the live catalogue by its code — the browser sends codes, never titles or credits. Only a
 * shop's BOUGHT stock may be picked (v4 answer 3: a badge reward does not count). No cap on how many clients (16 Nov).
 */

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { canManageVendor, resolveVendorRole } from '@/lib/vendor-role';
import { siteOrigin } from '@/lib/site-origin';
import { fetchShopGiftPacks, fetchShopGiftRewardStock, fetchShopGiftStock } from '@/lib/shop-gifts.server';
import { freeByKind, rewardFreeByKind } from '@/lib/shop-gifts';
import {
  OWN_GIFT_MAX_LINES,
  boughtFreePapic,
  clientInviteShareText,
  clientInviteUrl,
  isEmailOrPhone,
  ownGiftLinesOf,
  ownGiftWords,
} from '@/lib/own-clients';

export type OwnClientActionState =
  | { status: 'idle' }
  | { status: 'added'; url: string; shareText: string; to: string; name: string; gift: string; lines: number }
  | { status: 'set'; gift: string }
  | { status: 'error'; message: string };

const fail = (message: string): OwnClientActionState => ({ status: 'error', message });

export async function saveOwnClient(_prev: OwnClientActionState, formData: FormData): Promise<OwnClientActionState> {
  const mode = String(formData.get('mode') ?? 'add');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail('Sign in again, then try once more.');
  const profile = (await fetchOwnVendorProfile(supabase, user.id)) as
    | { vendor_profile_id: string; business_slug?: string | null; business_name?: string | null }
    | null;
  if (!profile) return fail('Your shop couldn’t be read. Reload and try again.');
  if (!canManageVendor(await resolveVendorRole(supabase, user.id).catch(() => null))) {
    return fail('Only the shop’s owner or an admin can do this.');
  }
  const shop = profile.vendor_profile_id;

  const codes = formData
    .getAll('gift')
    .map((v) => String(v).trim())
    .filter(Boolean)
    .slice(0, OWN_GIFT_MAX_LINES + 1);
  const admin = createAdminClient();
  const packs = await fetchShopGiftPacks(admin);
  if (packs === null) return fail('Your gifts couldn’t be read just now. Nothing was saved — try again.');
  const lines = ownGiftLinesOf(codes, packs);
  if (!lines) return fail('Pick at least one gift from your stock.');

  const [stock, reward] = await Promise.all([fetchShopGiftStock(supabase, shop, null), fetchShopGiftRewardStock(supabase, shop, null)]);
  const credits = boughtFreePapic(freeByKind(stock), rewardFreeByKind(reward, freeByKind(stock)));
  if (credits === null) return fail('Your gift stock couldn’t be read just now. Nothing was saved — try again.');
  const wanted = lines.reduce((s, l) => s + l.credits, 0);
  if (credits < wanted) return fail('Not enough in your stock for this gift. Buy more first — it goes into your stock.');

  if (mode === 'own_link') {
    // One gift on the code (v4 answer 1) — the first line is the one kept.
    const line = lines[0];
    if (!line) return fail('Pick a gift from your stock.');
    const { error } = await admin.from('vendor_own_link_gifts').upsert(
      { vendor_profile_id: shop, service_code: line.service_code, title: line.title, gift_kind: 'papic', credits: line.credits, set_by: user.id, updated_at: new Date().toISOString() },
      { onConflict: 'vendor_profile_id' },
    );
    if (error) {
      console.error('[supabase-error] own-clients: set own-link gift', error);
      return fail('The gift couldn’t be saved. Try again.');
    }
    revalidatePath('/vendor-dashboard/shop/promote');
    return { status: 'set', gift: line.title };
  }

  const slug = profile.business_slug ?? null;
  if (!slug) return fail('Name your shop first — the invite is built from your shop’s web address.');
  const name = String(formData.get('client_name') ?? '').trim().slice(0, 120);
  const contact = String(formData.get('client_contact') ?? '').trim().slice(0, 160);
  const note = String(formData.get('client_note') ?? '').trim().slice(0, 500);
  if (!name) return fail('Add their name.');
  if (!isEmailOrPhone(contact)) return fail('Add an email or a phone number to reach them.');

  const token = randomBytes(18).toString('base64url');
  const { error } = await admin.from('vendor_client_invites').insert({
    token,
    vendor_profile_id: shop,
    client_name: name,
    client_contact: contact,
    client_note: note || null,
    gift_lines: lines,
    created_by: user.id,
  });
  if (error) {
    console.error('[supabase-error] own-clients: insert invite', error);
    return fail('The client couldn’t be saved. Try again.');
  }
  revalidatePath('/vendor-dashboard/invite');
  return {
    status: 'added',
    url: clientInviteUrl(siteOrigin(), slug, token),
    shareText: clientInviteShareText(name, profile.business_name ?? null),
    to: contact,
    name,
    gift: ownGiftWords(lines),
    lines: lines.length,
  };
}
