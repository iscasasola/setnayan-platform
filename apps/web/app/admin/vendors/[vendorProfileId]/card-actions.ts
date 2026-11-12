'use server';

import { revalidatePath } from 'next/cache';
import { revalidateShopPage } from '@/lib/shop-page-cache';
import { redirect } from 'next/navigation';

import { requireAdminAction } from '@/lib/admin/require-admin';
import { emitNotification } from '@/lib/notification-emit';
import { createAdminClient } from '@/lib/supabase/admin';
import { clearHomeShelf } from '@/lib/home-shelf-clear';
import {
  CARD_AUDIT_ACTION,
  REASON_REFUSAL,
  cardModerationNotice,
  isPhotoSlot,
  parseModerationReason,
  supplierCardUrl,
  withoutShowcasePhoto,
  type CardModerationNotice,
} from '@/lib/service-card-moderation';

/**
 * Admin moderation of ONE service card, from the admin supplier page's
 * "Service cards" section (admin minimum for the 7 Nov 2026 supplier
 * registration). ONE exported dispatcher, `moderateServiceCard` (the form's
 * `op` picks the action) — every export of a "use server" file is a Vercel
 * route (scripts/lint-server-action-budget.mjs), so three operations cost one.
 * Three actions:
 *
 *   · takeDownServiceCard — hides the card from couples with a reason. Sets the
 *     card's own public switch `is_active = false` plus the hold the database
 *     keeps the supplier from lifting (20271309211124).
 *   · putBackServiceCard  — lifts the hold and returns the card to what it was
 *     before: live if it was live (when it still passes the publish gate),
 *     otherwise a draft.
 *   · removeServiceCardPhoto — detaches the cover or one showcase photo. The
 *     file stays in storage; its key is kept in the audit row.
 *
 * Every action: admin-only (`requireAdminAction` throws Forbidden for anyone
 * else, BEFORE any read or write), audited in `admin_audit_log` with the actor
 * and the reason, and the supplier gets an in-app notice
 * (`service_card_moderated`, NOT on the email allowlist). The notice and the
 * audit row are fail-soft: the card has already changed by then, and a failed
 * side-write must not read as a failed take-down.
 */

const CHANGED_MEANWHILE = 'The card changed while you were looking, so nothing was changed. Refresh and try again.';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CardRow = {
  vendor_service_id: string;
  vendor_profile_id: string;
  title: string | null;
  is_active: boolean | null;
  taken_down_at: string | null;
  taken_down_reason: string | null;
  primary_photo_r2_key: string | null;
  showcase_photo_r2_keys: string[] | null;
  updated_at: string | null;
};

function back(shopId: string, query: string): never {
  redirect(`/admin/vendors/${shopId}?${query}#cards`);
}
function backWithError(shopId: string, message: string): never {
  back(shopId, `card_error=${encodeURIComponent(message)}`);
}

/** The ids from the form, checked, and the card read through the service role. */
async function loadCard(formData: FormData): Promise<{ shopId: string; card: CardRow }> {
  const shopId = String(formData.get('vendor_profile_id') ?? '').trim();
  const cardId = String(formData.get('vendor_service_id') ?? '').trim();
  if (!UUID_RE.test(shopId)) throw new Error('Missing supplier.');
  if (!UUID_RE.test(cardId)) backWithError(shopId, 'Missing card.');

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('vendor_services')
    .select(
      'vendor_service_id, vendor_profile_id, title, is_active, taken_down_at, taken_down_reason, primary_photo_r2_key, showcase_photo_r2_keys, updated_at',
    )
    .eq('vendor_service_id', cardId)
    .eq('vendor_profile_id', shopId)
    .maybeSingle();
  // A refused read is not "no such card" — say which one it was.
  if (error) backWithError(shopId, 'Couldn’t read this card just now, so nothing changed. Try again.');
  if (!data) backWithError(shopId, 'That card is not on this shop any more.');
  return { shopId, card: data as CardRow };
}

async function audit(row: {
  action: string;
  cardId: string;
  shopId: string;
  actor: string;
  reason: string | null;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from('admin_audit_log').insert({
    action: row.action,
    target_table: 'vendor_services',
    target_id: row.cardId,
    actor_user_id: row.actor,
    reason: row.reason,
    before_json: row.before,
    after_json: row.after,
    metadata: { vendor_profile_id: row.shopId },
  });
  if (error) console.error(`[${row.action}] audit log insert failed`, error.message);
}

/** Tell the shop's owner. An unclaimed shop has no account to reach. */
async function tellTheSupplier(shopId: string, cardId: string, notice: CardModerationNotice): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('vendor_profiles')
      .select('user_id')
      .eq('vendor_profile_id', shopId)
      .maybeSingle();
    if (error) {
      console.error('[card moderation] could not find the supplier to tell:', error.message);
      return;
    }
    const userId = (data as { user_id?: string | null } | null)?.user_id;
    if (!userId) return;
    await emitNotification({
      userId,
      type: 'service_card_moderated',
      title: notice.title,
      body: notice.body,
      relatedUrl: supplierCardUrl(cardId),
    });
  } catch (e) {
    console.error('[card moderation] supplier notice threw:', e);
  }
}

async function refreshPublic(shopId: string): Promise<void> {
  revalidatePath(`/admin/vendors/${shopId}`);
  revalidateShopPage(shopId);
  const admin = createAdminClient();
  const { data } = await admin
    .from('vendor_profiles')
    .select('business_slug')
    .eq('vendor_profile_id', shopId)
    .maybeSingle();
  const slug = (data as { business_slug?: string | null } | null)?.business_slug;
  if (slug) revalidatePath(`/v/${slug}`);
  revalidatePath('/'); // 2026-11-12: the marketplace lives on Discover now (/explore forwards to /)
}

// ── Take down ────────────────────────────────────────────────────────────────

async function takeDownServiceCard(formData: FormData): Promise<void> {
  const { userId } = await requireAdminAction();
  const { shopId, card } = await loadCard(formData);
  const reason = parseModerationReason(formData.get('reason'));
  if (!reason) backWithError(shopId, REASON_REFUSAL);
  if (card.taken_down_at) backWithError(shopId, 'This card is already taken down.');

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('vendor_services')
    .update({
      is_active: false,
      taken_down_at: new Date().toISOString(),
      taken_down_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('vendor_service_id', card.vendor_service_id)
    .eq('vendor_profile_id', shopId)
    .is('taken_down_at', null)
    .select('vendor_service_id');
  if (error) {
    console.error('[takeDownServiceCard] update failed', error.message);
    backWithError(shopId, 'The card could not be taken down — nothing changed. Try again.');
  }
  // Zero rows is not a take-down: somebody else took it down a moment ago.
  if (!data || data.length === 0) backWithError(shopId, CHANGED_MEANWHILE);

  await audit({
    action: CARD_AUDIT_ACTION.takenDown,
    cardId: card.vendor_service_id,
    shopId,
    actor: userId,
    reason,
    before: { is_active: card.is_active === true, title: card.title },
    after: { is_active: false, taken_down: true },
  });
  await tellTheSupplier(shopId, card.vendor_service_id, cardModerationNotice({ kind: 'taken_down', reason }, card.title));
  await refreshPublic(shopId);
  back(shopId, 'card=taken-down');
}

// ── Put back ─────────────────────────────────────────────────────────────────

async function putBackServiceCard(formData: FormData): Promise<void> {
  const { userId } = await requireAdminAction();
  const { shopId, card } = await loadCard(formData);
  if (!card.taken_down_at) backWithError(shopId, 'This card is not taken down.');

  // Was it live before the take-down? The take-down's audit row says. Unknown
  // (no row, or the read refused) → put it back as a DRAFT: the supplier can
  // publish a draft in one tap, but a card made public on a guess cannot be
  // un-seen.
  const admin = createAdminClient();
  const { data: lastTakeDown, error: auditReadError } = await admin
    .from('admin_audit_log')
    .select('before_json')
    .eq('action', CARD_AUDIT_ACTION.takenDown)
    .eq('target_table', 'vendor_services')
    .eq('target_id', card.vendor_service_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (auditReadError) console.error('[putBackServiceCard] audit read failed', auditReadError.message);
  const wasLive =
    !auditReadError &&
    (lastTakeDown as { before_json?: { is_active?: unknown } | null } | null)?.before_json?.is_active === true;

  const lift = { taken_down_at: null, taken_down_reason: null, updated_at: new Date().toISOString() };
  let live = false;
  if (wasLive) {
    // The publish gate still judges a card going live (cover · price · what's
    // included). If a photo was removed meanwhile, it may refuse — then the
    // card comes back as a draft and the admin is told so.
    const { error } = await admin
      .from('vendor_services')
      .update({ ...lift, is_active: true })
      .eq('vendor_service_id', card.vendor_service_id)
      .eq('vendor_profile_id', shopId);
    live = !error;
    if (error) console.warn('[putBackServiceCard] could not go live again:', error.message);
  }
  if (!live) {
    const { error } = await admin
      .from('vendor_services')
      .update(lift)
      .eq('vendor_service_id', card.vendor_service_id)
      .eq('vendor_profile_id', shopId);
    if (error) {
      console.error('[putBackServiceCard] update failed', error.message);
      backWithError(shopId, 'The card could not be put back — nothing changed. Try again.');
    }
  }

  await audit({
    action: CARD_AUDIT_ACTION.putBack,
    cardId: card.vendor_service_id,
    shopId,
    actor: userId,
    reason: card.taken_down_reason,
    before: { is_active: false, taken_down: true },
    after: { is_active: live, taken_down: false },
  });
  await tellTheSupplier(shopId, card.vendor_service_id, cardModerationNotice({ kind: 'put_back', live }, card.title));
  await refreshPublic(shopId);
  back(shopId, `card=${live ? 'back-live' : wasLive ? 'back-draft-gate' : 'back-draft'}`);
}

// ── Remove a photo ───────────────────────────────────────────────────────────

async function removeServiceCardPhoto(formData: FormData): Promise<void> {
  const { userId } = await requireAdminAction();
  const { shopId, card } = await loadCard(formData);
  const slot = formData.get('slot');
  const key = String(formData.get('photo_key') ?? '').trim();
  const reason = parseModerationReason(formData.get('reason'));
  if (!isPhotoSlot(slot) || !key) backWithError(shopId, 'Missing photo.');
  if (!reason) backWithError(shopId, REASON_REFUSAL);

  const admin = createAdminClient();
  let error: { message: string } | null = null;
  let changed: unknown[] | null = null;
  let before: Record<string, unknown>;
  let after: Record<string, unknown>;
  if (slot === 'cover') {
    if (card.primary_photo_r2_key !== key) backWithError(shopId, 'That photo is no longer this card’s cover.');
    before = { primary_photo_r2_key: key };
    after = { primary_photo_r2_key: null };
    ({ data: changed, error } = await admin
      .from('vendor_services')
      .update({ primary_photo_r2_key: null, updated_at: new Date().toISOString() })
      .eq('vendor_service_id', card.vendor_service_id)
      .eq('vendor_profile_id', shopId)
      .eq('primary_photo_r2_key', key)
      .select('vendor_service_id'));
  } else {
    const current = card.showcase_photo_r2_keys ?? [];
    if (!current.includes(key)) backWithError(shopId, 'That photo is no longer on this card.');
    const next = withoutShowcasePhoto(current, key);
    before = { showcase_photo_r2_keys: current, removed: key };
    after = { showcase_photo_r2_keys: next };
    // Guarded on the row we read, so a supplier's save in between is not
    // overwritten with a stale list.
    let q = admin
      .from('vendor_services')
      .update({ showcase_photo_r2_keys: next, updated_at: new Date().toISOString() })
      .eq('vendor_service_id', card.vendor_service_id)
      .eq('vendor_profile_id', shopId);
    q = card.updated_at ? q.eq('updated_at', card.updated_at) : q;
    ({ data: changed, error } = await q.select('vendor_service_id'));
  }
  if (error) {
    console.error('[removeServiceCardPhoto] update failed', error.message);
    backWithError(shopId, 'The photo could not be removed — nothing changed. Try again.');
  }
  if (!changed || changed.length === 0) backWithError(shopId, CHANGED_MEANWHILE);

  await audit({
    action: CARD_AUDIT_ACTION.photoRemoved,
    cardId: card.vendor_service_id,
    shopId,
    actor: userId,
    reason,
    before: { slot, ...before },
    after,
  });
  await tellTheSupplier(
    shopId,
    card.vendor_service_id,
    cardModerationNotice({ kind: 'photo_removed', slot, reason }, card.title),
  );
  await refreshPublic(shopId);
  back(shopId, 'card=photo-removed');
}

// ── Sample shop (the shop, not a card) ───────────────────────────────────────

/** The audit actions for the shop-level "Sample shop" switch. */
const SAMPLE_SHOP_AUDIT = { on: 'vendor_sample_shop_on', off: 'vendor_sample_shop_off' } as const;

/**
 * The admin's "Sample shop" switch (owner, 6 Nov 2026: *"They are demo shops. The only real shop is the wedding
 * planner."*). It writes the EXISTING `vendor_profiles.is_demo` — no second column: every public reader already reads
 * that one flag (`shopPageGate`, the marketplace, the sitemap, Discover's Shops shelf), so a second "sample" column
 * would be a competing answer to one question. The shop's page and card then wear "Sample shop"
 * (`app/_components/sample-marker.tsx`).
 *
 * SAVES IN PLACE: no redirect — the switch stays where it was tapped, and a failure THROWS so the switch puts itself
 * back and says nothing changed. Explicit `on`/`off` (never a checkbox's absence). Guarded on the value it read, so a
 * second admin's tap in between is not silently undone. Owned shops are never deleted by the demo cleanups (they
 * delete only ownerless rows — `lib/a-demo-cleanup-never-deletes-an-owned-shop.test.ts`), so this switch hides, it
 * never removes.
 */
async function setSampleShop(formData: FormData): Promise<void> {
  const { userId } = await requireAdminAction();
  const shopId = String(formData.get('vendor_profile_id') ?? '').trim();
  const raw = String(formData.get('sample') ?? '').trim();
  if (!UUID_RE.test(shopId)) throw new Error('Missing supplier.');
  if (raw !== 'on' && raw !== 'off') throw new Error('Invalid sample-shop value.');
  const next = raw === 'on';

  const admin = createAdminClient();
  // A refused read resolves with `{ error }`; it is not "no such shop".
  const { data: before, error: readErr } = await admin
    .from('vendor_profiles')
    .select('is_demo, business_name, public_id')
    .eq('vendor_profile_id', shopId)
    .maybeSingle();
  if (readErr) throw new Error('Couldn’t read this shop just now, so nothing changed.');
  if (!before) throw new Error('Supplier not found.');
  const row = before as { is_demo?: boolean | null; business_name?: string | null; public_id?: string | null };
  const was = row.is_demo === true;
  if (was === next) return;

  const { data: changed, error } = await admin
    .from('vendor_profiles')
    .update({ is_demo: next })
    .eq('vendor_profile_id', shopId)
    .eq('is_demo', was)
    .select('vendor_profile_id');
  if (error) {
    console.error('[setSampleShop] update failed', error.message);
    throw new Error('The shop could not be changed — nothing changed.');
  }
  // Zero rows is not a save: another admin flipped it a moment ago.
  if (!changed || changed.length === 0) throw new Error(CHANGED_MEANWHILE);

  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: next ? SAMPLE_SHOP_AUDIT.on : SAMPLE_SHOP_AUDIT.off,
    target_table: 'vendor_profiles',
    target_id: shopId,
    actor_user_id: userId,
    before_json: { is_demo: was },
    after_json: { is_demo: next },
    metadata: { business_name: row.business_name ?? null, public_id: row.public_id ?? null },
  });
  if (auditErr) console.error('[setSampleShop] audit log insert failed', auditErr.message);

  // `is_demo` takes a shop off (or puts it back on) the home page's shop shelf — clear what the page remembers.
  clearHomeShelf('shops');
  await refreshPublic(shopId);
}

// ── The one export ───────────────────────────────────────────────────────────

/**
 * The form posts `op` = take_down | put_back | remove_photo | sample_shop. The admin gate runs
 * FIRST — before the op is even read — so a non-admin learns nothing.
 *
 * `sample_shop` is the one SHOP-level op (the admin page's "Sample shop" switch). It rides this dispatcher instead of a
 * new export because every export of a "use server" file is a Vercel route and the budget
 * (`scripts/lint-server-action-budget.mjs`) sits at its measured ceiling.
 */
export async function moderateServiceCard(formData: FormData): Promise<void> {
  await requireAdminAction();
  const op = formData.get('op');
  if (op === 'take_down') return takeDownServiceCard(formData);
  if (op === 'put_back') return putBackServiceCard(formData);
  if (op === 'remove_photo') return removeServiceCardPhoto(formData);
  if (op === 'sample_shop') return setSampleShop(formData);
  throw new Error('Unknown card action.');
}
