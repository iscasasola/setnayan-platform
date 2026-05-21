'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { uploadPublicAsset } from '@/lib/storage';

function nullIfBlank(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

/**
 * Generate a short, easy-to-read reference code couples paste into bank
 * transfer notes. 6 hex chars from gen_random_bytes equivalent (we don't
 * have access to crypto.randomBytes on the edge so use crypto.getRandomValues).
 */
function generateReferenceCode(): string {
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  return (
    'SN' +
    Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

export async function createOrder(formData: FormData) {
  const eventId = formData.get('event_id');
  const description = formData.get('description');
  const requestedRaw = formData.get('requested_total_php');
  const serviceKey = formData.get('service_key');

  if (typeof eventId !== 'string' || typeof description !== 'string') {
    throw new Error('Invalid input');
  }
  const trimmedDesc = description.trim();
  if (trimmedDesc.length === 0 || trimmedDesc.length > 2000) {
    throw new Error('Description must be 1–2000 chars');
  }
  if (typeof requestedRaw !== 'string') throw new Error('Amount required');
  const amount = Number(requestedRaw);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Amount must be a non-negative number');
  }
  const requestedTotalPhp = Math.round(amount * 100) / 100;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Decision 1 (CLAUDE.md 2026-05-15) — § 3.1a Self-purchase confirm.
  // The new-order page injects `self_purchase_action` when the user is a
  // vendor and picked a path in the modal. Empty / undefined = standard
  // flow (default for non-vendor users).
  const selfPurchaseAction = formData.get('self_purchase_action');
  const isSelfComp = selfPurchaseAction === 'comp_for_myself';
  const selfPurchaseVendorRaw = formData.get('self_purchase_vendor_profile_id');
  const selfPurchaseVendorProfileId =
    isSelfComp && typeof selfPurchaseVendorRaw === 'string' && selfPurchaseVendorRaw.length > 0
      ? selfPurchaseVendorRaw
      : null;

  if (isSelfComp) {
    if (!selfPurchaseVendorProfileId) {
      throw new Error('Self-comp requires a vendor profile target.');
    }
    // The user must actually own / sit on the team of this vendor at the
    // owner or admin tier. Re-verify server-side (the modal lies are
    // cheap to fake on the client).
    const { data: member } = await supabase
      .from('vendor_team_members')
      .select('role, vendor_profile_id')
      .eq('vendor_profile_id', selfPurchaseVendorProfileId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      throw new Error('Not authorised to self-comp this vendor.');
    }

    const orderResult = await createSelfCompOrder({
      eventId,
      userId: user.id,
      description: trimmedDesc,
      serviceKey: nullIfBlank(serviceKey),
      requestedTotalPhp,
      vendorProfileId: selfPurchaseVendorProfileId,
    });

    revalidatePath(`/dashboard/${eventId}/orders`);
    redirect(`/dashboard/${eventId}/orders/${orderResult.orderId}?self_comp=1`);
  }

  const { data, error } = await supabase
    .from('orders')
    .insert({
      event_id: eventId,
      user_id: user.id,
      service_key: nullIfBlank(serviceKey),
      description: trimmedDesc,
      requested_total_php: requestedTotalPhp,
      reference_code: generateReferenceCode(),
      status: 'submitted',
    })
    .select('order_id')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Could not create order');

  revalidatePath(`/dashboard/${eventId}/orders`);
  redirect(`/dashboard/${eventId}/orders/${data.order_id}?created=1`);
}

/**
 * Self-comp branch of § 3.1a. Creates a `comp_grants` row with
 * source='vendor_self_comp' (self-approved per § 5.4, gated by the 12 / quarter
 * trigger), then inserts an `orders` row marked `paid` with comp_grant_id
 * pointing at the new grant. Two-step via service-role so the trigger fires.
 */
async function createSelfCompOrder(args: {
  eventId: string;
  userId: string;
  description: string;
  serviceKey: string | null;
  requestedTotalPhp: number;
  vendorProfileId: string;
}): Promise<{ orderId: string }> {
  const admin = createAdminClient();
  const retailValueCentavos = Math.round(args.requestedTotalPhp * 100);

  const grantInsert = await admin
    .from('comp_grants')
    .insert({
      user_id: args.userId,
      scope: 'single_order',
      retail_value_centavos: retailValueCentavos,
      rationale: 'Vendor self-comp at checkout',
      granted_by: args.userId,
      approved_by: args.userId,
      source: 'vendor_self_comp',
      vendor_profile_id: args.vendorProfileId,
    })
    .select('grant_id')
    .single();

  if (grantInsert.error || !grantInsert.data) {
    // The enforce_vendor_self_comp_quota trigger raises check_violation
    // with VENDOR_SELF_COMP_QUOTA_EXCEEDED when the per-quarter cap is hit;
    // surface that to the caller verbatim so the UI can render the right
    // hint. createAdminClient bypasses RLS so any error here is a true
    // schema-level rejection.
    throw new Error(
      grantInsert.error?.message ?? 'Could not create self-comp grant.',
    );
  }

  const grantId = grantInsert.data.grant_id as string;

  const orderInsert = await admin
    .from('orders')
    .insert({
      event_id: args.eventId,
      user_id: args.userId,
      service_key: args.serviceKey,
      description: args.description,
      requested_total_php: args.requestedTotalPhp,
      confirmed_total_php: 0,
      reference_code: generateReferenceCode(),
      status: 'paid',
      comp_grant_id: grantId,
    })
    .select('order_id')
    .single();

  if (orderInsert.error || !orderInsert.data) {
    // The grant has already been written; we don't roll it back since the
    // trigger uses it for rate-limit accounting. Surface the error.
    throw new Error(orderInsert.error?.message ?? 'Could not create comp order.');
  }

  return { orderId: orderInsert.data.order_id as string };
}

export async function cancelOrder(formData: FormData) {
  const eventId = formData.get('event_id');
  const orderId = formData.get('order_id');
  if (typeof eventId !== 'string' || typeof orderId !== 'string') {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .eq('user_id', user.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/orders/${orderId}`);
  redirect(`/dashboard/${eventId}/orders?cancelled=1`);
}

export async function logPayment(formData: FormData) {
  const eventId = formData.get('event_id');
  const orderId = formData.get('order_id');
  const amountRaw = formData.get('amount_php');
  const channel = formData.get('channel');
  const paidAtRaw = formData.get('paid_at');

  if (
    typeof eventId !== 'string' ||
    typeof orderId !== 'string' ||
    typeof channel !== 'string'
  ) {
    throw new Error('Invalid input');
  }
  if (typeof amountRaw !== 'string') throw new Error('Amount required');
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be > 0');
  }
  const trimmedChannel = channel.trim();
  if (trimmedChannel.length === 0) throw new Error('Channel required');

  const paidAt =
    typeof paidAtRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(paidAtRaw)
      ? paidAtRaw
      : new Date().toISOString().slice(0, 10);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Optional screenshot — TWO supported shapes:
  //
  //   (1) New flow (preferred): `<FileUpload name="screenshot_ref">` uploads
  //       direct-to-R2 client-side and emits an `r2://bucket/key` hidden
  //       input. We store that ref verbatim in `screenshot_url`.
  //
  //   (2) Legacy flow: a `<input type="file" name="screenshot">` for forms
  //       that haven't been migrated yet (or admin tooling that pre-dates
  //       the new component). We pipe the file through `uploadPublicAsset`
  //       the same way the old code did and store the resulting public URL.
  //
  // (1) takes precedence — if both are present we trust the explicit ref.
  let screenshotUrl: string | null = null;
  const screenshotRefRaw = formData.get('screenshot_ref');
  if (
    typeof screenshotRefRaw === 'string' &&
    screenshotRefRaw.trim().startsWith('r2://')
  ) {
    screenshotUrl = screenshotRefRaw.trim();
  } else {
    const screenshotFile = formData.get('screenshot');
    if (screenshotFile instanceof File && screenshotFile.size > 0) {
      const result = await uploadPublicAsset({
        pathPrefix: `payment-screenshots/${orderId}`,
        file: screenshotFile,
      });
      if (!result.ok) {
        return redirect(
          `/dashboard/${eventId}/orders/${orderId}?error=${encodeURIComponent(result.error)}`,
        );
      }
      screenshotUrl = result.publicUrl;
    }
  }

  // Task 8 pilot hardening (2026-06-01): client-supplied idempotency key
  // deduplicates double-submits during pilot. The new-payment form mints
  // a UUID once on first render and ships it as a hidden input on every
  // retry; the (order_id, client_idempotency_key) partial unique index
  // turns the second insert into a 23505 unique-violation we catch and
  // treat as "already logged."
  const idempotencyKeyRaw = formData.get('client_idempotency_key');
  const idempotencyKey =
    typeof idempotencyKeyRaw === 'string' && idempotencyKeyRaw.trim().length > 0
      ? idempotencyKeyRaw.trim().slice(0, 64)
      : null;

  const { error } = await supabase.from('payments').insert({
    order_id: orderId,
    user_id: user.id,
    amount_php: Math.round(amount * 100) / 100,
    channel: trimmedChannel,
    reference_number: nullIfBlank(formData.get('reference_number')),
    screenshot_url: screenshotUrl,
    paid_at: paidAt,
    client_idempotency_key: idempotencyKey,
  });
  if (error) {
    // 23505 = unique_violation. With a non-null idempotency key this means
    // the customer's previous submit succeeded and they retried; treat as
    // success and route them to the order detail page so they see the
    // already-logged payment.
    const code = (error as { code?: string }).code;
    if (code === '23505' && idempotencyKey) {
      revalidatePath(`/dashboard/${eventId}/orders/${orderId}`);
      redirect(`/dashboard/${eventId}/orders/${orderId}?paid_logged=1`);
    }
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/${eventId}/orders/${orderId}`);
  redirect(`/dashboard/${eventId}/orders/${orderId}?paid_logged=1`);
}
