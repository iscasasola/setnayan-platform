import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import {
  hasActAsCookie,
  resolveActAsContext,
} from '@/lib/admin-actas-context';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Persistent "you are acting as X" banner for the admin doorway (Phase 3b).
 *
 * Mounted in the admin layout so an admin can NEVER forget they are inside a
 * scoped act-as session. Safety / cost shape:
 *   • Cheapest-first: hasActAsCookie() is a pure cookie read (no DB). With no
 *     act-as cookie — the universal prod case while takeover is flag-OFF — this
 *     returns null immediately and does ZERO database work. Prod is unaffected.
 *   • Only when a cookie IS present does it call resolveActAsContext(), which
 *     re-validates the open session. If the session ended (admin end, the user's
 *     force-end, or the backstop) the context is null and the banner vanishes —
 *     matching the revocable guarantee.
 *
 * This banner READS ONLY the target's display name / email — never chat,
 * attachments, behavioural data, or face vectors. (It lives under app/admin/**
 * so lint-admin-chat-guard scans it.)
 */
export async function ActAsBanner() {
  // Fast path: no cookie ⇒ no act-as ⇒ render nothing, no DB hit.
  if (!(await hasActAsCookie())) return null;

  const ctx = await resolveActAsContext();
  if (!ctx) return null;

  const admin = createAdminClient();
  const { data: target } = await admin
    .from('users')
    .select('display_name, email')
    .eq('user_id', ctx.targetUserId)
    .maybeSingle();
  const who = target?.display_name || target?.email || ctx.targetUserId;

  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-2 border-b border-danger-300 bg-danger-600 px-4 py-2 text-sm text-white"
    >
      <span className="inline-flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span>
          You are <strong>acting as</strong> {who}. The account holder is
          notified; every action is audited &amp; reported.
        </span>
      </span>
      <Link
        href={`/admin/users/${ctx.targetUserId}/takeover`}
        className="rounded-md bg-white/15 px-3 py-1 text-xs font-bold underline-offset-2 hover:bg-white/25 hover:underline"
      >
        Manage / leave act-as
      </Link>
    </div>
  );
}
