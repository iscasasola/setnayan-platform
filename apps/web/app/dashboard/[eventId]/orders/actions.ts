'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase
    .from('orders')
    .insert({
      event_id: eventId,
      user_id: user.id,
      service_key: nullIfBlank(serviceKey),
      description: trimmedDesc,
      requested_total_php: Math.round(amount * 100) / 100,
      reference_code: generateReferenceCode(),
      status: 'submitted',
    })
    .select('order_id')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Could not create order');

  revalidatePath(`/dashboard/${eventId}/orders`);
  redirect(`/dashboard/${eventId}/orders/${data.order_id}?created=1`);
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

  // Optional screenshot file upload. If present + valid, store in the public
  // assets bucket and persist the resulting URL on the payment row.
  let screenshotUrl: string | null = null;
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

  const { error } = await supabase.from('payments').insert({
    order_id: orderId,
    user_id: user.id,
    amount_php: Math.round(amount * 100) / 100,
    channel: trimmedChannel,
    reference_number: nullIfBlank(formData.get('reference_number')),
    screenshot_url: screenshotUrl,
    paid_at: paidAt,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/orders/${orderId}`);
  redirect(`/dashboard/${eventId}/orders/${orderId}?paid_logged=1`);
}
