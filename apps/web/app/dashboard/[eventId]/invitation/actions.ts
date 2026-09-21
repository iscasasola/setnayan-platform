'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { findSlugConflict } from '@/lib/slug-availability';

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

  // ⚠ THIS FORM USED TO CHECK THE SHAPE AND THE EVENTS TABLE, AND NOTHING ELSE.
  // No reserved-word check (a wedding could rename itself onto /creators or
  // /open-shop — both live pages in our sitemap), no shop-address check, no
  // person-handle check, and no check for a retired address that is still
  // forwarding printed invitations. `findSlugConflict` is the one answer for
  // the one shared namespace; the CREATE path and the live availability
  // endpoint ask the same question.
  const conflict = await findSlugConflict(admin, requested, { eventId });
  if (conflict) {
    redirect(`/dashboard/${eventId}/invitation?slug_error=${encodeURIComponent(conflict)}`);
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

  // ⚠ AN UPDATE THAT CHANGES NOTHING IS NOT AN ERROR. This runs on the CALLER's
  // client, so if RLS does not admit them to this event the statement matches
  // ZERO rows and Supabase returns no error at all. Without the `.select()` the
  // action then wrote a 90-day forwarding row for a rename that never happened
  // and redirected `?slug_saved=1` — the couple was told their new address was
  // live while the old one still served the page, and a word was retired out of
  // the pool for nothing.
  const { data: updatedRows, error: updateErr } = await supabase
    .from('events')
    .update({ slug: requested, updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .select('event_id');

  if (updateErr) {
    redirect(
      `/dashboard/${eventId}/invitation?slug_error=${encodeURIComponent(updateErr.message)}`,
    );
  }

  if (!updatedRows || updatedRows.length === 0) {
    redirect(
      `/dashboard/${eventId}/invitation?slug_error=${encodeURIComponent(
        'We couldn’t save that address. Please refresh and try again.',
      )}`,
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

/**
 * RECORD THAT THIS GUEST HAS BEEN GIVEN THEIR INVITATION.
 *
 * ── 🔴 WHY THIS ACTION IS NEW AND THE COLUMN IS OLD ────────────────────────
 * `guests.invitation_sent_at` has existed for months with **zero writers
 * anywhere** — no TypeScript, no SQL. The guest list's Invite step once counted
 * `invitation_sent_at IS NULL`, which meant the number could never fall no
 * matter what the couple did; that count was removed rather than faked, and
 * `lib/the-invite-step-counts-what-is-true.test.ts` has stood guard over the
 * dead column ever since, with instructions for whoever finally wrote to it.
 * This is that writer.
 *
 * ── WHY A COUPLE NEEDS IT ──────────────────────────────────────────────────
 * Measured 2026-09-16 on a real event: **75 of 77 guests have no email and no
 * mobile.** V1 sends no SMS, so those invitations travel by Viber message or by
 * hand. Nothing recorded that, which makes "who still needs theirs?"
 * unanswerable across a list of 77 people and several weeks.
 *
 * 🔑 IT IS A TOGGLE, NOT A LATCH. Marking sent is a human claim about the
 * physical world, and humans mis-click. A control that cannot be undone teaches
 * couples not to use it.
 *
 * ⚠ THE UPDATE COUNTS ROWS. A PostgREST update whose filter matches nothing —
 * including when RLS refused the row — returns **no error**, so without
 * `.select()` this would report success over a list that never changed.
 */
export async function markGuestInvitationSent(
  eventId: string,
  guestId: string,
  formData: FormData,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  /* `sent` absent → the host is UNDOING the mark. The form posts the value it
     wants to end up at, so the button label and the outcome cannot disagree. */
  const markSent = formData.get('sent') === '1';

  const { data, error } = await supabase
    .from('guests')
    .update({ invitation_sent_at: markSent ? new Date().toISOString() : null })
    .eq('guest_id', guestId)
    .eq('event_id', eventId)
    .select('guest_id');

  if (error || !data || data.length === 0) {
    /* No silent success. The page re-reads on revalidate, so a refused write
       simply leaves the chip as it was rather than claiming a state change. */
    redirect(`/dashboard/${eventId}/invitation?invite=failed`);
  }

  revalidatePath(`/dashboard/${eventId}/invitation`);
  revalidatePath(`/dashboard/${eventId}/guests`);
}

/**
 * MARK A WHOLE BATCH AS HANDED OUT — CTRL-B4 build 1.
 *
 * ── THE MEASURED PROBLEM ───────────────────────────────────────────────────
 * A couple hands out printed invitations and then has to record it. With 146
 * guests that is **146 individual toggles**, so in practice nobody finishes and
 * the Invite step can never complete. Production: 0 of 146 marked.
 *
 * ── RULE 0 ─────────────────────────────────────────────────────────────────
 * `markGuestInvitationSent` above is the writer and it is CORRECT — it counts
 * its rows, refuses silent success, and carries the undo. This is the same
 * statement with `.in()` instead of `.eq()`; it is not a second writer, and the
 * guard asserts both share the shape.
 *
 * 🔑 THE COUNT SHOWN MUST BE THE COUNT WRITTEN. A zero-row UPDATE is
 * success-shaped, and a PARTIAL one is worse: ask for 146, write 3, and a
 * screen that echoes the request tells the couple 143 people were recorded who
 * were not. `.select()` returns what actually moved, and that — not the length
 * of the request — is what the page is told.
 */
export async function markGuestsInvitationSent(
  eventId: string,
  formData: FormData,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const markSent = formData.get('sent') === '1';
  // Multiple `guest_id` inputs, de-duplicated: a double-submitted checkbox must
  // not make the requested count disagree with the written one for a reason
  // that has nothing to do with the database.
  const ids = [...new Set(formData.getAll('guest_id').filter((v): v is string => typeof v === 'string' && v.length > 0))];
  if (ids.length === 0) {
    redirect(`/dashboard/${eventId}/invitation?invite=none`);
  }

  const { data, error } = await supabase
    .from('guests')
    .update({ invitation_sent_at: markSent ? new Date().toISOString() : null })
    .in('guest_id', ids)
    .eq('event_id', eventId)
    .select('guest_id');

  if (error || !data) {
    // A refused write leaves the chips as they were and SAYS SO. 73 couple
    // dashboard reads already swallow their errors; this is not the 74th.
    redirect(`/dashboard/${eventId}/invitation?invite=failed`);
  }

  revalidatePath(`/dashboard/${eventId}/invitation`);
  revalidatePath(`/dashboard/${eventId}/guests`);
  // The WRITTEN count, never `ids.length`. A partial write is a real outcome
  // and the couple is told the real number.
  redirect(
    `/dashboard/${eventId}/invitation?invite=${markSent ? 'marked' : 'unmarked'}&n=${data.length}`,
  );
}
