'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';

function randomHex(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

type RotateRpcResult = {
  ok: boolean;
  reason?: string;
  qr_token?: string;
  rotated_at?: string;
  actor_kind?: string;
};

/**
 * Host/coordinator support rotation (build ④). Routes the existing "Re-issue"
 * control through the audited rotate_guest_qr_token RPC: audit row + durable
 * 3-per-guest-per-24h rate limit + actor typing, called with the USER's
 * authenticated client so the RPC derives couple/coordinator/admin from
 * auth.uid() itself.
 *
 * Guest notification (RA 10173-shaped): when the guest row has an email, a
 * fire-and-forget security-alert-style email tells them their QR was replaced
 * — with NO token and NO link to the new QR in the body ("ask your host"),
 * so the email can never re-leak access. When there is no email, the confirm
 * dialog forces the host to acknowledge "I'll hand them the new QR" BEFORE
 * this action runs (client-side gate in ReissueQrButton).
 */
export async function reissueGuestToken(
  eventId: string,
  guestId: string,
  _formData: FormData,
): Promise<void> {
  const supabase = await createClient();

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'rotate_guest_qr_token',
    { p_guest_id: guestId },
  );

  let failure: string | null = null;
  if (rpcError) {
    // Deploy-order race only: on merge, the Vercel deploy and the migration
    // workflow run in parallel — if this code goes live seconds before the
    // RPC exists, fall back to the legacy direct UPDATE (RLS-gated: only
    // couple/admin can touch the row) rather than breaking the button.
    const missingFn = rpcError.code === 'PGRST202' || rpcError.code === '42883';
    if (missingFn) {
      // .select() distinguishes a real rotation from an RLS-blocked 0-row
      // update — a 0-row "success" must NOT fall through to the success
      // banner + guest email (that would claim a rotation that never happened).
      const { data, error } = await supabase
        .from('guests')
        .update({ qr_token: randomHex(16), updated_at: new Date().toISOString() })
        .eq('event_id', eventId)
        .eq('guest_id', guestId)
        .select('guest_id');
      if (error) failure = error.message;
      else if (!data || data.length === 0) failure = 'Not allowed for this guest.';
    } else {
      failure = rpcError.message;
    }
  } else {
    const res = rpcData as RotateRpcResult | null;
    if (!res?.ok) {
      failure =
        res?.reason === 'rate_limited'
          ? 'This QR was already replaced 3 times in the last 24 hours — try again later.'
          : (res?.reason ?? 'Rotation failed.');
    }
  }

  if (failure) {
    redirect(
      `/dashboard/${eventId}/invitation?reissue_error=${encodeURIComponent(failure)}`,
    );
  }

  // Best-effort guest heads-up — never blocks the redirect, never contains the
  // new token or any access link. sendEmail no-ops when Resend is unconfigured.
  after(async () => {
    try {
      const admin = createAdminClient();
      const [{ data: guest }, { data: event }] = await Promise.all([
        admin
          .from('guests')
          .select('first_name, display_name, email')
          .eq('guest_id', guestId)
          .maybeSingle(),
        admin.from('events').select('display_name').eq('event_id', eventId).maybeSingle(),
      ]);
      if (!guest?.email) return;
      const name = guest.display_name || guest.first_name || 'there';
      const eventName = event?.display_name ?? 'your event';
      await sendEmail({
        to: guest.email,
        subject: `Your QR code for ${eventName} was replaced`,
        text: [
          `Hi ${name},`,
          '',
          `Your personal QR code and invitation link for ${eventName} were just replaced by your event host.`,
          '',
          'Your RSVP, seat, and photos are unchanged — only the QR code itself is new.',
          'Your old printed QR and any previously shared links no longer work.',
          '',
          'Ask your host for your new QR — for your security, we never send the new code by email.',
          '',
          "If you didn't expect this, please contact your host.",
        ].join('\n'),
      });
    } catch {
      // best-effort — a failed email never affects the rotation itself
    }
  });

  revalidatePath(`/dashboard/${eventId}/invitation`);
  redirect(`/dashboard/${eventId}/invitation?reissued=${guestId}`);
}

export async function updateEventSlug(
  eventId: string,
  formData: FormData,
): Promise<void> {
  const requested = String(formData.get('slug') ?? '')
    .trim()
    .toLowerCase();

  if (!requested || !/^[a-z0-9-]{3,32}$/.test(requested)) {
    redirect(`/dashboard/${eventId}/invitation?slug_error=invalid_format`);
  }

  const admin = createAdminClient();

  // Make sure no other event already owns the slug.
  const { data: clash } = await admin
    .from('events')
    .select('event_id')
    .ilike('slug', requested)
    .neq('event_id', eventId)
    .maybeSingle();
  if (clash) {
    redirect(`/dashboard/${eventId}/invitation?slug_error=taken`);
  }

  // Read the old slug so we can log it.
  const { data: existing } = await admin
    .from('events')
    .select('slug')
    .eq('event_id', eventId)
    .maybeSingle();

  // Pull the user's id for the log.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error: updateErr } = await supabase
    .from('events')
    .update({ slug: requested, updated_at: new Date().toISOString() })
    .eq('event_id', eventId);

  if (updateErr) {
    redirect(
      `/dashboard/${eventId}/invitation?slug_error=${encodeURIComponent(updateErr.message)}`,
    );
  }

  if (existing?.slug && existing.slug !== requested) {
    await admin.from('slug_change_log').insert({
      entity_type: 'event',
      entity_id: eventId,
      old_slug: existing.slug,
      new_slug: requested,
      changed_by: user?.id ?? null,
    });
  }

  revalidatePath(`/dashboard/${eventId}/invitation`);
  redirect(`/dashboard/${eventId}/invitation?slug_saved=1`);
}

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export async function updateMonogram(
  eventId: string,
  formData: FormData,
): Promise<void> {
  const rawText = String(formData.get('monogram_text') ?? '').trim();
  const rawColor = String(formData.get('monogram_color') ?? '').trim();

  const text = rawText ? rawText.slice(0, 12) : null;
  const color = rawColor && HEX_COLOR.test(rawColor) ? rawColor : '#C97B4B';

  if (rawColor && !HEX_COLOR.test(rawColor)) {
    redirect(`/dashboard/${eventId}/invitation?mono_error=invalid_color`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('events')
    .update({
      monogram_text: text,
      monogram_color: color,
      monogram_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId);

  if (error) {
    redirect(
      `/dashboard/${eventId}/invitation?mono_error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/dashboard/${eventId}/invitation`);
  revalidatePath(`/dashboard/${eventId}/invitation/print`);
  redirect(`/dashboard/${eventId}/invitation?mono_saved=1`);
}
