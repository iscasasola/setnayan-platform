'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminAction } from '@/lib/admin/require-admin';
import { FOUNDER_SEAT_CAP } from '@/lib/founder-seats';

/**
 * Admin server actions for founder seats (owner-locked 2026-07-16 · migration
 * 20270818135217). Up to 10 owner-granted seats; a seat = token-free vendor
 * inquiries + every in-app SKU already paid for + the server-asserted founder
 * badge. Grant/revoke is owner/admin-only and goes through the service-role
 * client — founder_seats has NO write policies on purpose, so this surface is
 * the only write path. Every mutation writes an admin_audit_log row.
 *
 * Expected failures (unknown email, cap reached, already seated) redirect back
 * with ?error= for the FormFlash banner instead of throwing to the boundary.
 */

const BACK = '/admin/founder-seats';

const fail = (msg: string): never => redirect(`${BACK}?error=${encodeURIComponent(msg)}`);
const ok = (msg: string): never => redirect(`${BACK}?saved=${encodeURIComponent(msg)}`);

export async function grantFounderSeat(formData: FormData) {
  const { userId: adminUserId } = await requireAdminAction();
  const admin = createAdminClient();

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const label = String(formData.get('label') ?? '').trim() || null;
  if (!email || !email.includes('@')) fail('Enter the account email to grant a seat to.');

  const { data: target } = await admin
    .from('users')
    .select('user_id, email')
    .ilike('email', email)
    .maybeSingle();
  if (!target) {
    fail(`No Setnayan account found for ${email} — they need to sign up first.`);
    return;
  }

  const { data: seats, error: seatsErr } = await admin
    .from('founder_seats')
    .select('seat_no, user_id')
    .order('seat_no');
  if (seatsErr) fail(`Could not read seats: ${seatsErr.message}`);

  const taken = seats ?? [];
  if (taken.some((s) => s.user_id === target.user_id)) {
    fail(`${email} already holds a founder seat.`);
  }
  if (taken.length >= FOUNDER_SEAT_CAP) {
    fail(`All ${FOUNDER_SEAT_CAP} founder seats are taken — revoke one first.`);
  }

  // Lowest free seat number (the DB CHECK 1..10 is the hard backstop).
  const used = new Set(taken.map((s) => s.seat_no));
  let seatNo = 1;
  while (used.has(seatNo)) seatNo += 1;

  const { error: insertErr } = await admin.from('founder_seats').insert({
    seat_no: seatNo,
    user_id: target.user_id,
    label,
    granted_by: adminUserId,
  });
  if (insertErr) fail(`Could not grant the seat: ${insertErr.message}`);

  await admin.from('admin_audit_log').insert({
    action: 'founder_seat_grant',
    target_id: target.user_id,
    actor_user_id: adminUserId,
    metadata: { seat_no: seatNo, email: target.email, label },
  });

  revalidatePath(BACK);
  ok(`Seat ${seatNo} granted to ${target.email}.`);
}

export async function revokeFounderSeat(formData: FormData) {
  const { userId: adminUserId } = await requireAdminAction();
  const admin = createAdminClient();

  const seatNo = Number(formData.get('seat_no'));
  if (!Number.isInteger(seatNo) || seatNo < 1 || seatNo > FOUNDER_SEAT_CAP) {
    fail('Invalid seat.');
  }

  const { data: seat } = await admin
    .from('founder_seats')
    .select('seat_no, user_id, label')
    .eq('seat_no', seatNo)
    .maybeSingle();
  if (!seat) fail(`Seat ${seatNo} is already empty.`);

  const { error: delErr } = await admin
    .from('founder_seats')
    .delete()
    .eq('seat_no', seatNo);
  if (delErr) fail(`Could not revoke: ${delErr.message}`);

  await admin.from('admin_audit_log').insert({
    action: 'founder_seat_revoke',
    target_id: seat!.user_id,
    actor_user_id: adminUserId,
    metadata: { seat_no: seatNo, label: seat!.label },
  });

  revalidatePath(BACK);
  ok(`Seat ${seatNo} revoked.`);
}
