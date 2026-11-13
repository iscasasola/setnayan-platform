/**
 * account-suspension-flow.ts — THE ORDER OF A SUSPEND AND A LIFT, with every side effect handed in.
 *
 * Pure (no `server-only`, no `next/*`) so `account-suspension-flow.test.ts` runs the REAL sequence against a fake and
 * proves the part no database test can reach: that a suspended person's SIGN-IN is refused (the GoTrue ban is set,
 * and a failed ban rolls the database half back), and that a lift clears it again. The wiring to Supabase lives in
 * `lib/account-suspension.server.ts`; the database half is migration 20271344061337.
 */
import {
  BAN_LIFTED,
  banDurationFor,
  liftedNotice,
  suspendedNotice,
  type SuspendReason,
} from '@/lib/account-suspension';

export type SuspensionIo = {
  /** admin_suspend_account (service role). `error` is the message, or null. */
  suspendInDb: (args: { userId: string; until: string | null; reason: string }) => Promise<{ data: unknown; error: string | null }>;
  /** admin_lift_account_suspension (service role). */
  liftInDb: (userId: string) => Promise<{ data: unknown; error: string | null }>;
  /** GoTrue admin API `updateUserById(id, { ban_duration })` — sets auth.users.banned_until. */
  ban: (userId: string, duration: string) => Promise<{ error: string | null }>;
  /** admin_revoke_user_sessions — signs them out everywhere now. */
  revokeSessions: (userId: string) => Promise<{ sessionsRevoked: number | null; error: string | null }>;
  /** One in-app notice. */
  notify: (
    userId: string,
    type: 'account_suspended' | 'account_unsuspended',
    title: string,
    body: string,
  ) => Promise<void>;
  /** Forget cached shop pages / the home shelf for these shops. */
  shopsChanged: (shopIds: readonly string[]) => void;
  log: (msg: string) => void;
};

export type SuspendResult =
  | { ok: true; shops: string[]; sessionsRevoked: number | null }
  | { ok: false; message: string };

export type LiftResult =
  | { ok: true; shops: string[]; wasUntil: string | null; wasReason: string | null }
  | { ok: false; message: string };

export type LiftRow = { shops?: string[]; was_suspended_until?: string | null; was_reason?: string | null };

const DB_REFUSAL_WORDS: Record<string, string> = {
  suspend_needs_reason: 'Pick a reason.',
  suspend_until_in_past: 'The Until date has to be in the future.',
  suspend_no_such_account: 'That account no longer exists.',
  suspend_internal_account: 'An internal account (§ 10a) is never suspended.',
  suspend_deleted_account: 'That account was deleted — there is nothing to suspend.',
  suspend_already_suspended: 'That account is already on hold.',
  suspend_not_suspended: 'That account is not on hold.',
};

/** The database's refusal code → words for the admin. Unknown → a sentence that never claims success. */
export function refusalWords(message: string | null | undefined): string {
  for (const [code, words] of Object.entries(DB_REFUSAL_WORDS)) if (message?.includes(code)) return words;
  return 'The database refused it — nothing changed. Try again.';
}

/**
 * SUSPEND: (1) the database (it validates and suspends their shops in one transaction) → (2) the sign-in ban →
 * (3) every session revoked → (4) one notice. A failed ban lifts the database half again: a person recorded as
 * suspended who can still sign in is the exact defect this feature closes.
 */
export async function suspendAccountWith(
  io: SuspensionIo,
  args: { userId: string; reason: SuspendReason; until: Date | null; now: Date },
): Promise<SuspendResult> {
  const { data, error } = await io.suspendInDb({
    userId: args.userId,
    until: args.until ? args.until.toISOString() : null,
    reason: args.reason,
  });
  if (error) return { ok: false, message: refusalWords(error) };
  const shops = (((data as { shops?: string[] } | null)?.shops ?? []) as string[]).map(String);

  const banned = await io.ban(args.userId, banDurationFor(args.until, args.now));
  if (banned.error) {
    const undo = await io.liftInDb(args.userId);
    if (undo.error) io.log(`ban failed AND the rollback failed: ${undo.error}`);
    io.shopsChanged(shops);
    return { ok: false, message: `Couldn’t stop them signing in (${banned.error}) — nothing was changed.` };
  }

  const revoked = await io.revokeSessions(args.userId);
  if (revoked.error) io.log(`session revoke failed (the ban still holds): ${revoked.error}`);
  io.shopsChanged(shops);

  const notice = suspendedNotice(args.reason, args.until);
  await io.notify(args.userId, 'account_suspended', notice.title, notice.body);
  return { ok: true, shops, sessionsRevoked: revoked.sessionsRevoked };
}

/** LIFT by an admin: (1) the database → then {@link finishLiftWith}. */
export async function liftSuspensionWith(io: SuspensionIo, userId: string): Promise<LiftResult> {
  const { data, error } = await io.liftInDb(userId);
  if (error) return { ok: false, message: refusalWords(error) };
  return finishLiftWith(io, userId, data as LiftRow | null);
}

/** After the database half is lifted (by an admin or by the expiry job): the ban → `none`, then one notice. */
export async function finishLiftWith(io: SuspensionIo, userId: string, row: LiftRow | null): Promise<LiftResult> {
  const shops = ((row?.shops ?? []) as string[]).map(String);
  io.shopsChanged(shops);
  const unbanned = await io.ban(userId, BAN_LIFTED);
  if (unbanned.error) {
    // The database half is lifted; GoTrue still refuses sign-in. Said to the admin — never silent.
    io.log(`lift: the sign-in ban could not be cleared: ${unbanned.error}`);
    return {
      ok: false,
      message: `The hold is lifted, but sign-in is still blocked (${unbanned.error}). Check Supabase › Auth › Users, or suspend and unsuspend again.`,
    };
  }
  const notice = liftedNotice(shops.length);
  await io.notify(userId, 'account_unsuspended', notice.title, notice.body);
  return { ok: true, shops, wasUntil: row?.was_suspended_until ?? null, wasReason: row?.was_reason ?? null };
}
