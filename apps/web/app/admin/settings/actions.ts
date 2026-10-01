'use server';

import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deletePublicAsset, uploadPublicAsset } from '@/lib/storage';
import { R2_BUCKETS, r2Upload } from '@/lib/r2';
import { packIco } from '@/lib/ico';
import { BRAND_SETTINGS_TAG } from '@/lib/brand-settings';
import { LOADER_SETTINGS_TAG } from '@/lib/loader-settings';
import { clampInt, coerceVariant } from '@/lib/loader-config';
import { isQrPhPayload } from '@/lib/emv-qr';
import {
  PAYMENT_DESTINATION_FIELDS,
  changedAccountDestinations,
  describeAccountChange,
} from '@/lib/payment-destination';
import { fetchPlatformSettingsMeasured } from '@/lib/platform-settings';
import {
  PAY_CHANNELS,
  isPayChannel,
  receivingAccounts,
  serializeReceivingAccounts,
  type AccountKind,
  type ReceivingAccount,
} from '@/lib/payment-channels';
import { formatCount } from '@/lib/format-number';

/**
 * Admin settings server actions — V2 publisher posture, split flows.
 *
 * 2026-05-29 restructure: the previous one-form-saves-everything pattern
 * (`savePlatformSettings`) is split into two role-aligned actions:
 *
 *   - `saveBusinessIdentity` lives on `/admin/settings` (business name, TIN,
 *     address, email, default VAT rate — values printed on every transaction
 *     receipt).
 *   - `savePaymentInstruments` lives on `/admin/settings/payment-methods`
 *     (BDO + GCash account name / number — the active V2 customer payment
 *     rails that couples reference when transferring for an order).
 *
 * Why split: BDO and GCash account fields are merchant payment configuration
 * and conceptually belong with the active payment-methods surface, not the
 * generic business-identity panel. Owner asked 2026-05-29 evening: "shouldn't
 * this be at payment methods?" — yes. Splitting also lets each surface
 * revalidate the right path on save and surface form-specific success/error
 * messages without conflating the two concerns.
 *
 * `uploadMerchantQr` + `removeMerchantQr` are scoped to QR codes and now
 * revalidate + redirect to the payment-methods surface (their canonical home).
 */
/**
 * Returns the admin's own user_id. It used to return `void`; the § 9.1
 * payment-account gate needs to record WHO proposed a change, and an approval
 * whose `initiated_by` is guessed is not four eyes.
 */
async function requireAdmin(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Forbidden');
  }
  return { userId: user.id };
}

/** Blank → NULL (no cap configured); otherwise a positive number. */
function nullIfBlankNumber(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().replace(/,/g, '');
  if (t.length === 0) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function nullIfBlank(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

// Onboarding background music moved to apps/web/app/admin/onboarding/actions.ts
// (updateOnboardingMusic) on 2026-06-09 — grouped into the new type-organized
// onboarding settings surface. It still writes the same platform_settings
// columns (onboarding_bg_music_r2_key / _enabled).

export async function saveBusinessIdentity(formData: FormData) {
  await requireAdmin();

  const vatRaw = formData.get('default_vat_rate_pct');
  const vatRate = typeof vatRaw === 'string' ? Number(vatRaw) : 12;
  if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
    return redirect(
      `/admin/settings?error=${encodeURIComponent('VAT rate must be 0–100')}`,
    );
  }

  // Reverse-image repost-watch match sensitivity (lib/vendor-image-repost-watch
  // resolveThreshold reads this). Hamming distance is a 64-bit pHash comparison,
  // so a valid threshold is 0..64. Reject non-numeric input; clamp in range.
  const thresholdRaw = formData.get('repost_watch_hamming_threshold');
  const thresholdNum =
    typeof thresholdRaw === 'string' ? Number(thresholdRaw) : NaN;
  if (!Number.isFinite(thresholdNum)) {
    return redirect(
      `/admin/settings?error=${encodeURIComponent(
        'Repost-watch threshold must be a number 0–64',
      )}`,
    );
  }
  const repostThreshold = Math.min(64, Math.max(0, Math.round(thresholdNum)));

  const payload = {
    business_name:
      (typeof formData.get('business_name') === 'string'
        ? (formData.get('business_name') as string).trim()
        : '') || 'Setnayan',
    business_tin: nullIfBlank(formData.get('business_tin')),
    business_address: nullIfBlank(formData.get('business_address')),
    business_email: nullIfBlank(formData.get('business_email')),
    default_vat_rate_pct: Math.round(vatRate * 100) / 100,
    repost_watch_hamming_threshold: repostThreshold,
    updated_at: new Date().toISOString(),
  };

  const admin = createAdminClient();
  const { error } = await admin
    .from('platform_settings')
    .update(payload)
    .eq('id', 1);
  if (error) {
    return redirect(`/admin/settings?tab=settings&error=${encodeURIComponent(error.message)}`);
  }

  // Vendor VALIDATE destinations (migration 20270503417266) — saved in a
  // SEPARATE update so a pre-migration database (columns missing) fails only
  // this pair with a specific message instead of bricking the whole
  // business-identity save above.
  const validateEmail =
    nullIfBlank(formData.get('vendor_validate_email')) ??
    'verify@setnayan.com';
  const validatePhone = nullIfBlank(formData.get('vendor_validate_phone'));
  const { error: validateErr } = await admin
    .from('platform_settings')
    .update({
      vendor_validate_email: validateEmail,
      vendor_validate_phone: validatePhone,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
  if (validateErr) {
    return redirect(
      `/admin/settings?error=${encodeURIComponent(
        `Business identity saved, but the VALIDATE contact fields couldn't save (is migration 20270503417266 applied?): ${validateErr.message}`,
      )}`,
    );
  }

  revalidatePath('/admin/settings');
  revalidatePath('/receipts', 'layout');
  redirect('/admin/settings?tab=settings&saved=1');
}

/**
 * Toggle the cron-free morning ops digest (lib/admin/digest-flush.ts). An
 * unchecked checkbox doesn't submit, so absence = off. Sending stays triple-
 * gated downstream (enabled + open work + Resend configured).
 */
export async function saveAdminDigest(formData: FormData) {
  await requireAdmin();
  const enabled = formData.get('admin_digest_enabled') === 'on';
  const admin = createAdminClient();
  const { error } = await admin
    .from('platform_settings')
    .update({ admin_digest_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) {
    return redirect(`/admin/settings?tab=settings&error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath('/admin/settings');
  redirect('/admin/settings?tab=settings&saved=1');
}

/**
 * Loading-animation appearance (owner 2026-07-05). Writes the four loader_*
 * columns on platform_settings; parse + clamp everything to the migration's
 * CHECK ranges so a malformed submit can never violate a constraint. Busts the
 * cached read (LOADER_SETTINGS_TAG — feeds the root layout) so the change shows
 * on the very next navigation.
 */
export async function saveLoaderAppearance(formData: FormData) {
  await requireAdmin();

  const variant = coerceVariant(formData.get('loader_variant'));
  const veilOpacity = clampInt(formData.get('loader_veil_opacity'), 70, 100, 90);
  const stepIntervalMs = clampInt(
    formData.get('loader_step_interval_ms'),
    800,
    3000,
    1500,
  );
  // Unchecked checkbox doesn't submit → absence = off.
  const popEnabled = formData.get('loader_pop_enabled') === 'on';

  const admin = createAdminClient();
  const { error } = await admin
    .from('platform_settings')
    .update({
      loader_variant: variant,
      loader_veil_opacity: veilOpacity,
      loader_step_interval_ms: stepIntervalMs,
      loader_pop_enabled: popEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
  if (error) {
    return redirect(`/admin/settings?tab=settings&error=${encodeURIComponent(error.message)}`);
  }

  revalidateTag(LOADER_SETTINGS_TAG);
  revalidatePath('/', 'layout');
  revalidatePath('/admin/settings');
  redirect('/admin/settings?tab=settings&loader_saved=1');
}

/**
 * Where every payment-methods action lands afterwards. One spelling, so an
 * error, a saved notice and a "needs a second admin" notice all reach the same
 * page.
 */
const PAYMENT_METHODS_PATH = '/admin/settings/payment-methods';

function backToPaymentMethods(query: string): never {
  return redirect(`${PAYMENT_METHODS_PATH}?${query}`);
}

/**
 * Write the receiving-accounts LIST — the only place it is written outside the
 * § 9.1 executor below.
 *
 * 🔑 THE TWO MIGRATED RAILS ARE MIRRORED INTO THEIR OLD SWITCHES. The fixed
 * `gcash_enabled` / `bdo_enabled` columns are the fallback checkout uses when
 * the list cannot be read (lib/payment-channels.ts · receivingAccounts). If they
 * kept saying ON after the owner switched GCash off in the list, a refused read
 * would quietly re-open an account at its cap. A removed rail mirrors as OFF for
 * the same reason.
 */
async function writeAccountList(
  admin: ReturnType<typeof createAdminClient>,
  list: readonly ReceivingAccount[],
  extra: Record<string, unknown> = {},
) {
  const mirror: Record<string, boolean> = {};
  for (const legacy of PAY_CHANNELS) {
    const entry = list.find((a) => a.id === legacy);
    mirror[`${legacy}_enabled`] = entry ? entry.enabled : false;
  }
  return admin
    .from('platform_settings')
    .update({
      receiving_accounts: serializeReceivingAccounts(list),
      ...mirror,
      ...extra,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
}

/** A fresh, readable, unique account id: "maribank-7k2q". */
function newAccountId(label: string, taken: ReadonlySet<string>): string {
  const base =
    label
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30) || 'account';
  for (;;) {
    const id = `${base}-${randomUUID().replace(/-/g, '').slice(0, 4)}`;
    if (!taken.has(id)) return id;
  }
}

/**
 * One pending receiving-account change at a time. Two approvals in flight
 * could be granted by two different admins and the last write would silently
 * win.
 */
async function aChangeIsAlreadyPending(admin: ReturnType<typeof createAdminClient>): Promise<boolean> {
  const { data } = await admin
    .from('admin_approval_requests')
    .select('approval_id')
    .eq('action_type', 'approve_payment_account_change')
    .eq('status', 'pending')
    .maybeSingle();
  return Boolean(data);
}

const ALREADY_PENDING =
  'A change to a receiving account is already waiting on a second admin. Decide that one in Approvals first.';

/**
 * The receiving-accounts list, edited one account at a time (owner 2026-10-01:
 * "add a mari bank or uno bank"). Four intents, ONE exported action — the
 * server-action budget is at its ceiling, and these are one job.
 *
 *   account_save   — add an account, or edit one. Its NAME and NUMBER are
 *                    destinations: changing them, or adding an account at all,
 *                    opens an approval for a second admin (§ 9.1). Its label
 *                    and kind save at once.
 *   account_toggle — the kill switch. Saves at once, never waits on a quorum.
 *   account_move   — the order checkout shows. Saves at once.
 *   account_remove — withdraws an option; points no money anywhere new, so it
 *                    saves at once (like removing a QR). The last account
 *                    cannot be removed — turn it off instead.
 *
 * ⚠ EVERY INTENT READS THE LIST FIRST AND REFUSES ON A FAILED READ. Each one
 * writes the whole array back, so a write built on an unread list would replace
 * the real accounts with the fall-back two.
 */
async function saveReceivingAccount(
  adminUserId: string,
  intent: 'account_save' | 'account_toggle' | 'account_move' | 'account_remove',
  formData: FormData,
): Promise<never> {
  const admin = createAdminClient();
  const { settings, readFailed, accountsReadFailed } = await fetchPlatformSettingsMeasured(admin);
  if (readFailed || accountsReadFailed) {
    return backToPaymentMethods(
      `error=${encodeURIComponent('Couldn’t read the accounts just now, so nothing was changed. Refresh and try again.')}`,
    );
  }
  const list = receivingAccounts(settings);
  const id = nullIfBlank(formData.get('account_id'));
  const at = id ? list.findIndex((a) => a.id === id) : -1;
  if (id && at < 0) {
    return backToPaymentMethods(`error=${encodeURIComponent('That account is no longer in the list. Refresh and try again.')}`);
  }

  if (intent === 'account_toggle') {
    const next = list.map((a, i) => (i === at ? { ...a, enabled: formData.get('enabled') === '1' } : a));
    const { error } = await writeAccountList(admin, next);
    if (error) return backToPaymentMethods(`error=${encodeURIComponent(error.message)}`);
    revalidatePath(PAYMENT_METHODS_PATH);
    return backToPaymentMethods('saved=1');
  }

  if (intent === 'account_move') {
    const to = formData.get('direction') === 'up' ? at - 1 : at + 1;
    if (at < 0 || to < 0 || to >= list.length) return backToPaymentMethods('saved=1');
    const next = [...list];
    [next[at], next[to]] = [next[to]!, next[at]!];
    const { error } = await writeAccountList(admin, next);
    if (error) return backToPaymentMethods(`error=${encodeURIComponent(error.message)}`);
    revalidatePath(PAYMENT_METHODS_PATH);
    return backToPaymentMethods('saved=1');
  }

  if (intent === 'account_remove') {
    if (at < 0) return backToPaymentMethods('saved=1');
    if (list.length <= 1) {
      return backToPaymentMethods(
        `error=${encodeURIComponent('Keep at least one account. To stop taking payments, turn it off instead.')}`,
      );
    }
    const removed = list[at]!;
    const { error } = await writeAccountList(
      admin,
      list.filter((_, i) => i !== at),
    );
    if (error) return backToPaymentMethods(`error=${encodeURIComponent(error.message)}`);
    // The picture goes only AFTER the list stopped pointing at it.
    if (removed.qrUrl) await deletePublicAsset({ publicUrl: removed.qrUrl });
    const { error: auditErr } = await admin.from('admin_audit_log').insert({
      action: 'payment_account_removed',
      actor_user_id: adminUserId,
      metadata: { id: removed.id, label: removed.label },
    });
    if (auditErr) console.error('[saveReceivingAccount] remove audit insert failed (non-fatal):', auditErr);
    revalidatePath(PAYMENT_METHODS_PATH);
    return backToPaymentMethods('saved=1');
  }

  // ── account_save ─────────────────────────────────────────────────────────
  const label = nullIfBlank(formData.get('label'))?.slice(0, 40) ?? null;
  const kind: AccountKind = formData.get('kind') === 'bank' ? 'bank' : 'ewallet';
  const accountName = nullIfBlank(formData.get('account_name'))?.slice(0, 120) ?? null;
  const number = nullIfBlank(formData.get('number'))?.slice(0, 64) ?? null;
  if (!label) {
    return backToPaymentMethods(`error=${encodeURIComponent('Give the account a name people know, like “Maribank”.')}`);
  }
  const stored = at >= 0 ? list[at]! : null;
  if (!stored && !number) {
    return backToPaymentMethods(`error=${encodeURIComponent('Add the account number people send money to.')}`);
  }

  // The parts that point no money anywhere save straight away.
  let next = list;
  if (stored && (stored.label !== label || stored.kind !== kind)) {
    next = list.map((a, i) => (i === at ? { ...a, label, kind } : a));
    const { error } = await writeAccountList(admin, next);
    if (error) return backToPaymentMethods(`error=${encodeURIComponent(error.message)}`);
  }

  // ── VENDOR AGREEMENT § 9.1 · where money lands takes two admins ──────────
  const changed = changedAccountDestinations(stored, { accountName, number });
  if (changed.length === 0) {
    revalidatePath(PAYMENT_METHODS_PATH);
    return backToPaymentMethods('saved=1');
  }
  if (await aChangeIsAlreadyPending(admin)) {
    return backToPaymentMethods(`error=${encodeURIComponent(ALREADY_PENDING)}`);
  }
  const accountId = stored?.id ?? newAccountId(label, new Set(list.map((a) => a.id)));
  const summary = describeAccountChange(label, stored, { accountName, number });
  const { error: reqErr } = await admin.from('admin_approval_requests').insert({
    action_type: 'approve_payment_account_change',
    payload: {
      kind: 'account',
      account: stored
        ? { id: accountId, account_name: accountName, number }
        : { id: accountId, label, kind, account_name: accountName, number, is_new: true },
    },
    rationale: `Change a receiving account — ${summary}`,
    initiated_by: adminUserId,
    // 24 hours, shorter than the 72 the comp and refund gates use. A redirect
    // of every future payment should not be approvable by someone three days
    // later who has forgotten why it was proposed.
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
  if (reqErr) {
    return backToPaymentMethods(`error=${encodeURIComponent(`Could not open the approval: ${reqErr.message}`)}`);
  }
  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'payment_account_change_requested',
    actor_user_id: adminUserId,
    metadata: { id: accountId, changed, summary },
  });
  // Non-fatal: the approval row IS the control, and it is already written.
  if (auditErr) console.error('[saveReceivingAccount] audit insert failed (non-fatal):', auditErr);

  revalidatePath(PAYMENT_METHODS_PATH);
  revalidatePath('/admin/approvals');
  return backToPaymentMethods(
    `notice=${encodeURIComponent(
      stored
        ? `Saved. The new name or number goes live when a second admin approves it in Approvals: ${summary}`
        : `${label} goes live when a second admin approves it in Approvals.`,
    )}`,
  );
}

export async function savePaymentInstruments(formData: FormData) {
  const { userId: adminUserId } = await requireAdmin();

  const intent = formData.get('intent');
  if (
    intent === 'account_save' ||
    intent === 'account_toggle' ||
    intent === 'account_move' ||
    intent === 'account_remove'
  ) {
    return saveReceivingAccount(adminUserId, intent, formData);
  }

  // ── THE MONTHLY LIMITS of the two migrated rails ─────────────────────────
  // The account names, numbers and switches moved into the list above. What is
  // left on this form are the receiving caps and balance readings, which exist
  // for GCash and BDO only (their columns predate the list). None of them is a
  // destination, so none waits on a second admin.
  //
  // ⚠ This branch must never write a destination column again: a field the
  // form no longer posts reads as blank, and a blank compared against the real
  // number is a "change" that would open an approval to wipe it.
  const payload: Record<string, unknown> = {
    gcash_monthly_cap_php: nullIfBlankNumber(formData.get('gcash_monthly_cap_php')),
    bdo_monthly_cap_php: nullIfBlankNumber(formData.get('bdo_monthly_cap_php')),
    updated_at: new Date().toISOString(),
  };

  const admin = createAdminClient();

  // Available-balance overrides carry a timestamp, and WHEN we stamp it is
  // load-bearing (migration 20271028200000).
  //
  // `_as_of` marks the instant the owner read the real figure out of the bank
  // app; only Setnayan payments recorded AFTER it are deducted, because
  // everything earlier is already inside the number they read. So we re-stamp
  // ONLY when the submitted value actually differs from what is stored.
  //
  // Re-stamping on every save would be the dangerous direction: saving this
  // form to edit a cap would silently reset the clock and discard every order
  // since, overstating the remaining headroom until a transfer bounced.
  //
  // The miss is benign: an owner who re-checks and lands on the same figure
  // keeps the older timestamp, so we keep deducting orders already reflected
  // in it. That UNDER-states remaining and closes the rail early — the safe
  // direction to be wrong in.
  const { data: currentRow, error: currentErr } = await admin
    .from('platform_settings')
    .select('gcash_available_php,bdo_available_php')
    .eq('id', 1)
    .maybeSingle();
  if (currentErr) {
    return backToPaymentMethods(
      `error=${encodeURIComponent('Couldn’t read the saved limits just now, so nothing was changed. Refresh and try again.')}`,
    );
  }
  const current = (currentRow ?? {}) as {
    gcash_available_php?: number | string | null;
    bdo_available_php?: number | string | null;
  };
  const nowIso = new Date().toISOString();

  for (const kind of PAY_CHANNELS) {
    const submitted = nullIfBlankNumber(formData.get(`${kind}_available_php`));
    const storedRaw = current[`${kind}_available_php` as 'gcash_available_php' | 'bdo_available_php'];
    const stored = storedRaw == null ? null : Number(storedRaw);
    Object.assign(payload, {
      [`${kind}_available_php`]: submitted,
      // Cleared → drop the timestamp too, so a NULL balance can never leave a
      // stale `_as_of` behind for the reset check to trip over.
      ...(submitted !== stored ? { [`${kind}_available_as_of`]: submitted == null ? null : nowIso } : {}),
    });
  }

  const { error } = await admin.from('platform_settings').update(payload).eq('id', 1);
  if (error) return backToPaymentMethods(`error=${encodeURIComponent(error.message)}`);

  revalidatePath(PAYMENT_METHODS_PATH);
  revalidatePath('/receipts', 'layout');
  redirect(`${PAYMENT_METHODS_PATH}?saved=1`);
}

/** The two migrated rails' own QR columns — kept in step with the list. */
function qrColumn(kind: (typeof PAY_CHANNELS)[number]): 'bdo_qr_url' | 'gcash_qr_url' {
  return kind === 'bdo' ? 'bdo_qr_url' : 'gcash_qr_url';
}

function qrPayloadColumn(kind: (typeof PAY_CHANNELS)[number]): 'bdo_qr_payload' | 'gcash_qr_payload' {
  return kind === 'bdo' ? 'bdo_qr_payload' : 'gcash_qr_payload';
}

function isLegacyRail(id: string): id is (typeof PAY_CHANNELS)[number] {
  return (PAY_CHANNELS as readonly string[]).includes(id);
}

/**
 * Decode an uploaded merchant-QR image to its QR Ph payload string.
 *
 * Runs ONCE per upload (never per checkout paint) so the stored string can be
 * re-minted with each order's amount — see lib/emv-qr.ts and migration
 * 20271027100000.
 *
 * Returns null on ANY failure, and every caller treats null as "keep serving
 * the static image". That is the pre-existing behaviour, so a QR we cannot
 * read degrades to exactly what shipped before rather than breaking checkout.
 * We deliberately reject anything that is not a valid PHP QR Ph payload —
 * isQrPhPayload checks the CRC, the TLV structure and currency 608 — because
 * the alternative is minting an amount onto a code we do not understand.
 */
async function decodeMerchantQrPayload(file: File): Promise<string | null> {
  try {
    const { data, info } = await sharp(Buffer.from(await file.arrayBuffer()))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    return isQrPhPayload(decoded?.data) ? decoded!.data : null;
  } catch {
    return null;
  }
}

export async function uploadMerchantQr(formData: FormData) {
  const { userId: adminUserId } = await requireAdmin();
  // `kind` is the receiving account's id (the list, owner 2026-10-01). It must
  // name an account Setnayan has — a QR for nothing is refused, not stored.
  const kind = nullIfBlank(formData.get('kind'));
  const file = formData.get('file');
  if (!kind) throw new Error('Invalid QR kind');
  if (!(file instanceof File) || file.size === 0) {
    return backToPaymentMethods(`error=${encodeURIComponent('Pick a file first')}`);
  }

  const admin = createAdminClient();
  const { settings, readFailed, accountsReadFailed } = await fetchPlatformSettingsMeasured(admin);
  if (readFailed || accountsReadFailed) {
    return backToPaymentMethods(
      `error=${encodeURIComponent('Couldn’t read the accounts just now, so nothing was uploaded. Refresh and try again.')}`,
    );
  }
  const account = receivingAccounts(settings).find((a) => a.id === kind);
  if (!account) {
    return backToPaymentMethods(`error=${encodeURIComponent('That account is no longer in the list. Refresh and try again.')}`);
  }
  // Read the existing URL so the old asset can be cleaned up once the row
  // points at the new one.
  const existingUrl = account.qrUrl;

  // ── VENDOR AGREEMENT § 9.1 · a QR IS a receiving account ─────────────────
  //
  // 🔑 THIS IS THE DOOR A GATE ON THE TEXT FIELDS WOULD HAVE MISSED. Scanning
  // the QR is how customers actually send money, so replacing the image
  // redirects funds exactly as changing the number does — and this action
  // never touches the number. Protecting one and not the other would have
  // been a gate with a hole the shape of the real payment path.
  if (await aChangeIsAlreadyPending(admin)) {
    return backToPaymentMethods(`error=${encodeURIComponent(ALREADY_PENDING)}`);
  }

  const upload = await uploadPublicAsset({
    pathPrefix: `merchant-qr/${kind}`,
    file,
  });
  if (!upload.ok) {
    return backToPaymentMethods(`error=${encodeURIComponent(upload.error)}`);
  }

  // Decode alongside the URL so the two never disagree: whatever image we
  // just stored is exactly the payload checkout will re-mint (lib/emv-qr.ts).
  //
  // The file is already in R2 and the payload already decoded: the approval
  // carries the URL the second admin is agreeing to, so nothing is re-decoded
  // at execution and the two admins cannot be looking at different images.
  //
  // ⚠ HONEST COST: a rejected or expired request leaves the uploaded asset
  // orphaned in R2. That is storage, not money, and it is the safe direction —
  // the alternative is deleting an asset the live row might already point at.
  const payload = await decodeMerchantQrPayload(file);

  const { error: reqErr } = await admin.from('admin_approval_requests').insert({
    action_type: 'approve_payment_account_change',
    payload: {
      kind: 'qr',
      rail: kind,
      url: upload.publicUrl,
      qr_payload: payload,
      replaces_url: existingUrl,
    },
    rationale: `Replace the ${account.label} payment QR — customers scan this to send money`,
    initiated_by: adminUserId,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
  if (reqErr) {
    return backToPaymentMethods(`error=${encodeURIComponent(`Could not open the approval: ${reqErr.message}`)}`);
  }

  const { error: qrAuditErr } = await admin.from('admin_audit_log').insert({
    action: 'payment_qr_change_requested',
    actor_user_id: adminUserId,
    metadata: { rail: kind, url: upload.publicUrl, replaces_url: existingUrl },
  });
  if (qrAuditErr) {
    console.error('[uploadMerchantQr] audit insert failed (non-fatal):', qrAuditErr);
  }

  revalidatePath(PAYMENT_METHODS_PATH);
  revalidatePath('/admin/approvals');
  redirect(
    `${PAYMENT_METHODS_PATH}?notice=${encodeURIComponent(
      `The ${account.label} QR is uploaded. It goes live when a second admin approves it in Approvals.`,
    )}`,
  );
}

export async function removeMerchantQr(formData: FormData) {
  await requireAdmin();
  const kind = nullIfBlank(formData.get('kind'));
  if (!kind) throw new Error('Invalid QR kind');

  const admin = createAdminClient();
  const { settings, readFailed, accountsReadFailed } = await fetchPlatformSettingsMeasured(admin);
  if (readFailed || accountsReadFailed) {
    return backToPaymentMethods(
      `error=${encodeURIComponent('Couldn’t read the accounts just now, so nothing was removed. Refresh and try again.')}`,
    );
  }
  const list = receivingAccounts(settings);
  const account = list.find((a) => a.id === kind);
  if (!account) return backToPaymentMethods('qr_removed=1');
  const existingUrl = account.qrUrl;

  // Clear the payload with the URL. Leaving a stale payload behind would let
  // checkout keep minting codes for an account the admin just removed. The two
  // migrated rails clear their own columns too, so the fallback agrees.
  const { error } = await writeAccountList(
    admin,
    list.map((a) => (a.id === kind ? { ...a, qrUrl: null, qrPayload: null } : a)),
    isLegacyRail(kind) ? { [qrColumn(kind)]: null, [qrPayloadColumn(kind)]: null } : {},
  );
  if (error) return backToPaymentMethods(`error=${encodeURIComponent(error.message)}`);

  if (existingUrl) {
    await deletePublicAsset({ publicUrl: existingUrl });
  }

  revalidatePath(PAYMENT_METHODS_PATH);
  redirect(`${PAYMENT_METHODS_PATH}?qr_removed=1`);
}

// ---------------------------------------------------------------------------
// Default brand icon (owner 2026-06-10).
//
// The admin uploads ONE square brand image; we derive the whole icon set
// server-side with sharp + our tiny .ico packer, store each public URL on the
// platform_settings singleton, and bump brand_icon_version (the cache-buster).
// Those URLs then feed the /favicon.ico route, the root metadata icon links,
// and the in-app <Logo>/<LogoMark> (via BrandProvider) — so a single upload
// repaints the brand everywhere, and the orange Safari tab can never return.
//
// Derived assets are uploaded with r2Upload (not uploadPublicAsset) because
// the .ico (image/x-icon) and SVG passthrough (image/svg+xml) aren't in the
// shared uploadPublicAsset MIME allowlist — and these are server-derived,
// trusted bytes, not raw user input. deletePublicAsset round-trips the same
// URL shape for cleanup.
// ---------------------------------------------------------------------------

const BRAND_ICON_COLUMNS =
  'brand_icon_master_url,brand_favicon_ico_url,brand_apple_touch_url,brand_icon_png_512_url,brand_icon_svg_url,brand_icon_version';

function settingsError(message: string): never {
  return redirect(`/admin/settings?tab=settings&error=${encodeURIComponent(message)}`);
}

/**
 * executePaymentAccountChange — the § 9.1 receiving-account change, run by the
 * SECOND admin.
 *
 * Called only from the approvals dispatcher, which has already claimed the row
 * atomically and enforced `decided_by <> initiated_by` (the DB constraint
 * `admin_approval_four_eyes` enforces it again).
 *
 * 🔒 THE VALUES COME FROM THE PAYLOAD, NEVER RE-READ FROM A FORM. The second
 * admin is approving the exact account number or QR image the first one
 * proposed. Re-deriving anything here would mean the two admins could be
 * agreeing to different destinations — which is the whole failure this gate
 * exists to prevent.
 *
 * Three payload kinds:
 *   • 'account' — one entry of the receiving-accounts LIST (owner 2026-10-01):
 *                 a new account, or a new name/number for an existing one.
 *   • 'qr'      — a new QR image for one account in the list.
 *   • 'fields'  — the pre-list shape (the fixed BDO/GCash columns). Kept so a
 *                 request opened before the list shipped still executes — and
 *                 it now updates the matching list entry too, or approving it
 *                 would change a column checkout no longer reads.
 */
export async function executePaymentAccountChange(
  admin: ReturnType<typeof createAdminClient>,
  params: {
    payload: unknown;
    initiatedByAdminId: string;
    confirmingAdminId: string;
  },
): Promise<void> {
  const body = (params.payload ?? {}) as {
    kind?: string;
    fields?: Record<string, string | null>;
    account?: Record<string, unknown>;
    rail?: string;
    url?: string;
    qr_payload?: string | null;
    replaces_url?: string | null;
  };

  /** The list as it stands NOW — the approval patches one entry of it. */
  const readList = async (): Promise<ReceivingAccount[]> => {
    const { settings, readFailed, accountsReadFailed } = await fetchPlatformSettingsMeasured(admin);
    if (readFailed || accountsReadFailed) {
      throw new Error('Could not read the receiving accounts — nothing was changed. Try again.');
    }
    return receivingAccounts(settings);
  };

  /**
   * ⚠ THIS ROW IS THE ONLY PLACE TWO ADMINS ARE RECORDED TOGETHER. Four eyes
   * that leaves no trace of the second pair is a control nobody can audit
   * afterwards, so the failure is loud even though it is not fatal — the
   * money change itself has already succeeded and must not be undone because a
   * log write did not land.
   */
  const recordBothAdmins = async (action: string, metadata: Record<string, unknown>) => {
    const { error: auditErr } = await admin.from('admin_audit_log').insert({
      action,
      actor_user_id: params.confirmingAdminId,
      metadata: {
        ...metadata,
        initiated_by: params.initiatedByAdminId,
        confirmed_by: params.confirmingAdminId,
      },
    });
    if (auditErr) {
      console.error(
        `[executePaymentAccountChange] ${action} audit insert FAILED — the change is live but unrecorded:`,
        auditErr,
      );
    }
  };

  if (body.kind === 'account') {
    const acc = body.account ?? {};
    // Only ever the fields an account change may carry. A payload is data, and
    // data that names its own target is a write primitive.
    const allowed = new Set(['id', 'label', 'kind', 'account_name', 'number', 'is_new']);
    const bad = Object.keys(acc).filter((k) => !allowed.has(k));
    if (bad.length > 0) {
      throw new Error(`Payment approval names non-destination column(s): ${bad.join(', ')}`);
    }
    const id = typeof acc.id === 'string' ? acc.id : '';
    if (!isPayChannel(id)) throw new Error('Payment approval has no valid account id');
    const accountName = typeof acc.account_name === 'string' ? acc.account_name : null;
    const number = typeof acc.number === 'string' ? acc.number : null;

    const list = await readList();
    const at = list.findIndex((a) => a.id === id);
    let next: ReceivingAccount[];
    if (acc.is_new === true) {
      if (at >= 0) throw new Error('That account was already added.');
      const label = typeof acc.label === 'string' && acc.label.trim() ? acc.label.trim().slice(0, 40) : null;
      if (!label) throw new Error('Payment approval has no account label');
      next = [
        ...list,
        {
          id,
          label,
          kind: acc.kind === 'bank' ? 'bank' : 'ewallet',
          accountName,
          number,
          qrUrl: null,
          qrPayload: null,
          enabled: true,
        },
      ];
    } else {
      if (at < 0) throw new Error('That account is no longer in the list.');
      next = list.map((a, i) => (i === at ? { ...a, accountName, number } : a));
    }

    // The two migrated rails keep their fixed columns in step — the fallback
    // checkout reads when the list cannot be.
    const legacy: Record<string, string | null> =
      id === 'gcash'
        ? { gcash_account_name: accountName, gcash_number: number }
        : id === 'bdo'
          ? { bdo_account_name: accountName, bdo_account_number: number }
          : {};
    const { error } = await writeAccountList(admin, next, legacy);
    if (error) throw new Error(`Payment account update failed: ${error.message}`);

    await recordBothAdmins('payment_account_changed', { account: acc });
    revalidatePath(PAYMENT_METHODS_PATH);
    revalidatePath('/receipts', 'layout');
    return;
  }

  if (body.kind === 'fields') {
    const fields = body.fields ?? {};
    const keys = Object.keys(fields);
    if (keys.length === 0) throw new Error('Payment approval carries no fields');
    // Only ever write columns the rule module names as destinations. A payload
    // is data, and data that names its own target column is a write primitive.
    const allowed = new Set<string>(PAYMENT_DESTINATION_FIELDS);
    const bad = keys.filter((k) => !allowed.has(k));
    if (bad.length > 0) {
      throw new Error(`Payment approval names non-destination column(s): ${bad.join(', ')}`);
    }

    // The list entry for each rail named, so the approval changes what
    // checkout actually reads.
    const list = await readList();
    const patch = (id: 'gcash' | 'bdo', nameKey: string, numberKey: string) => (a: ReceivingAccount) =>
      a.id !== id
        ? a
        : {
            ...a,
            ...(nameKey in fields ? { accountName: fields[nameKey] ?? null } : {}),
            ...(numberKey in fields ? { number: fields[numberKey] ?? null } : {}),
          };
    const next = list
      .map(patch('gcash', 'gcash_account_name', 'gcash_number'))
      .map(patch('bdo', 'bdo_account_name', 'bdo_account_number'));

    const { error } = await writeAccountList(admin, next, { ...fields });
    if (error) throw new Error(`Payment account update failed: ${error.message}`);

    await recordBothAdmins('payment_account_changed', { fields });
    revalidatePath(PAYMENT_METHODS_PATH);
    revalidatePath('/receipts', 'layout');
    return;
  }

  if (body.kind === 'qr') {
    const rail = typeof body.rail === 'string' ? body.rail : '';
    if (!isPayChannel(rail)) throw new Error('QR approval has no valid rail');
    if (!body.url) throw new Error('QR approval has no uploaded image');

    const list = await readList();
    if (!list.some((a) => a.id === rail)) throw new Error('QR approval names an account that is no longer in the list');
    const { error } = await writeAccountList(
      admin,
      list.map((a) => (a.id === rail ? { ...a, qrUrl: body.url ?? null, qrPayload: body.qr_payload ?? null } : a)),
      isLegacyRail(rail)
        ? { [qrColumn(rail)]: body.url, [qrPayloadColumn(rail)]: body.qr_payload ?? null }
        : {},
    );
    if (error) throw new Error(`Payment QR update failed: ${error.message}`);

    // Clean up the superseded image only AFTER the row points at the new one,
    // so a failure above can never leave the page with no QR at all.
    if (body.replaces_url) {
      await deletePublicAsset({ publicUrl: body.replaces_url });
    }

    await recordBothAdmins('payment_qr_changed', { rail, url: body.url });
    revalidatePath(PAYMENT_METHODS_PATH);
    return;
  }

  throw new Error(`Payment approval has an unknown kind: ${String(body.kind)}`);
}

export async function uploadBrandIcon(formData: FormData) {
  await requireAdmin();

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    settingsError('Pick an image first.');
  }
  const upload = file as File;
  if (upload.size > 6 * 1024 * 1024) {
    settingsError(
      `Image is ${formatCount(upload.size / 1024 / 1024, 1)} MB — max is 6 MB.`,
    );
  }

  const isSvg =
    upload.type === 'image/svg+xml' || /\.svg$/i.test(upload.name);
  const input = Buffer.from(await upload.arrayBuffer());

  // SVGs are rasterized at high density so the small derivatives stay crisp.
  const pipe = () => sharp(input, isSvg ? { density: 384 } : undefined);

  let width = 0;
  let height = 0;
  try {
    const meta = await pipe().metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
  } catch {
    settingsError(
      "That file isn't a readable image. Use a square PNG, JPEG, WebP, or SVG.",
    );
  }
  if (!width || !height) {
    settingsError('Could not read the image dimensions — try another file.');
  }
  if (!isSvg && (width < 48 || height < 48)) {
    settingsError(
      `Image is ${width}×${height}. Use at least 48×48 so the favicon stays crisp.`,
    );
  }
  const ratio = width / height;
  if (ratio < 0.8 || ratio > 1.25) {
    settingsError(
      `Please upload a roughly square image (got ${width}×${height}).`,
    );
  }

  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
  const squarePng = (size: number) =>
    pipe()
      .resize(size, size, { fit: 'contain', background: transparent })
      .png()
      .toBuffer();

  let ico: Buffer;
  let apple180: Buffer;
  let png512: Buffer;
  let master: Buffer;
  try {
    const [i16, i32, i48] = await Promise.all([
      squarePng(16),
      squarePng(32),
      squarePng(48),
    ]);
    ico = packIco([
      { size: 16, png: i16 },
      { size: 32, png: i32 },
      { size: 48, png: i48 },
    ]);
    [png512, master] = await Promise.all([squarePng(512), squarePng(1024)]);
    // iOS composites transparency onto black, so the apple-touch tile must be
    // opaque — flatten onto white.
    apple180 = await pipe()
      .resize(180, 180, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .flatten({ background: '#ffffff' })
      .png()
      .toBuffer();
  } catch {
    settingsError('Could not process that image — try a different file.');
  }

  const bucket = R2_BUCKETS.media;
  const base = `brand-icon/${randomUUID()}`;
  let icoUrl: string;
  let appleUrl: string;
  let png512Url: string;
  let masterUrl: string;
  let svgUrl: string | null;
  try {
    [icoUrl, appleUrl, png512Url, masterUrl, svgUrl] = await Promise.all([
      r2Upload({ bucket, key: `${base}/favicon.ico`, body: ico, contentType: 'image/x-icon' }),
      r2Upload({ bucket, key: `${base}/apple-touch.png`, body: apple180, contentType: 'image/png' }),
      r2Upload({ bucket, key: `${base}/icon-512.png`, body: png512, contentType: 'image/png' }),
      r2Upload({ bucket, key: `${base}/master.png`, body: master, contentType: 'image/png' }),
      isSvg
        ? r2Upload({ bucket, key: `${base}/mark.svg`, body: input, contentType: 'image/svg+xml' })
        : Promise.resolve<string | null>(null),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    settingsError(`Couldn't save the icon to storage: ${message}`);
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('platform_settings')
    .select(BRAND_ICON_COLUMNS)
    .eq('id', 1)
    .maybeSingle();
  const prev = (existing as Record<string, unknown> | null) ?? null;
  const prevVersion =
    typeof prev?.brand_icon_version === 'number' ? prev.brand_icon_version : 0;

  const { error } = await admin
    .from('platform_settings')
    .update({
      brand_icon_master_url: masterUrl,
      brand_favicon_ico_url: icoUrl,
      brand_apple_touch_url: appleUrl,
      brand_icon_png_512_url: png512Url,
      brand_icon_svg_url: svgUrl,
      brand_icon_version: prevVersion + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
  if (error) {
    settingsError(error.message);
  }

  // Best-effort cleanup of the previous icon set.
  for (const col of [
    'brand_icon_master_url',
    'brand_favicon_ico_url',
    'brand_apple_touch_url',
    'brand_icon_png_512_url',
    'brand_icon_svg_url',
  ]) {
    const old = prev?.[col];
    if (typeof old === 'string' && old.length > 0) {
      await deletePublicAsset({ publicUrl: old });
    }
  }

  // Bust every cache the icon feeds: the settings read, the whole layout tree
  // (metadata + BrandProvider), and the favicon route.
  revalidateTag(BRAND_SETTINGS_TAG);
  revalidatePath('/', 'layout');
  revalidatePath('/favicon.ico');
  redirect('/admin/settings?tab=settings&brand_icon=1');
}

export async function removeBrandIcon() {
  await requireAdmin();

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('platform_settings')
    .select(BRAND_ICON_COLUMNS)
    .eq('id', 1)
    .maybeSingle();
  const prev = (existing as Record<string, unknown> | null) ?? null;
  const prevVersion =
    typeof prev?.brand_icon_version === 'number' ? prev.brand_icon_version : 0;

  const { error } = await admin
    .from('platform_settings')
    .update({
      brand_icon_master_url: null,
      brand_favicon_ico_url: null,
      brand_apple_touch_url: null,
      brand_icon_png_512_url: null,
      brand_icon_svg_url: null,
      // Still bump — the URL changes back to the default, and the version
      // cache-buster forces browsers off the previous custom icon.
      brand_icon_version: prevVersion + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
  if (error) {
    settingsError(error.message);
  }

  for (const col of [
    'brand_icon_master_url',
    'brand_favicon_ico_url',
    'brand_apple_touch_url',
    'brand_icon_png_512_url',
    'brand_icon_svg_url',
  ]) {
    const old = prev?.[col];
    if (typeof old === 'string' && old.length > 0) {
      await deletePublicAsset({ publicUrl: old });
    }
  }

  revalidateTag(BRAND_SETTINGS_TAG);
  revalidatePath('/', 'layout');
  revalidatePath('/favicon.ico');
  redirect('/admin/settings?tab=settings&brand_icon_removed=1');
}
