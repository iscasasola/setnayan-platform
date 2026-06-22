import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// ────────────────────────────────────────────────────────────────────────────
// Admin account-access model — Phase 2c: handler-lane RBAC.
//
// Problem (security audit FAIL): admin identity is FLAT. Every admin
// (users.account_type='admin' / is_internal / is_team_member) can read + act on
// EVERY console queue — a Verification handler can approve Payments, resolve
// Disputes, etc. There is no lane isolation.
//
// Fix: a per-admin `handler_role` LANE (verification | payments | disputes |
// full) on public.users. `full` (the default for every existing + new admin)
// is unrestricted; a scoped handler may only touch its own lane's surfaces.
//
// SAFETY — additive + fails-OFF:
//   • The lane fence only BINDS when platform_settings.handler_lane_rbac_enforced
//     IS TRUE. NULL/FALSE → requireHandler() behaves EXACTLY like the legacy
//     requireAdmin() (admin-or-403, no lane check), so enabling handler_role on
//     a row cannot lock anyone out until the owner flips the kill-switch.
//   • Mirrors resolveSetnayanAiPaywallEnabled() (lib/integration-config.ts):
//     DB-first tri-state, env fallback, UNCACHED so a console flip takes effect
//     on the next request.
//   • Reads via the service-role client (RLS bypass) because the lane gate runs
//     on the admin surface where queue reads/writes already use service-role —
//     RLS-only isolation would NOT bind there, so the binding fence is HERE in
//     code. The migration's admin_in_handler_lane() RLS helper is additive
//     defense-in-depth only.
// ────────────────────────────────────────────────────────────────────────────

export const HANDLER_LANES = ['verification', 'payments', 'disputes'] as const;
export type HandlerLane = (typeof HANDLER_LANES)[number];

/** All assignable handler_role values (the three lanes + the unrestricted 'full'). */
export const HANDLER_ROLES = [...HANDLER_LANES, 'full'] as const;
export type HandlerRole = (typeof HANDLER_ROLES)[number];

export function isHandlerRole(v: unknown): v is HandlerRole {
  return typeof v === 'string' && (HANDLER_ROLES as readonly string[]).includes(v);
}

/**
 * Tri-state, fails-OFF resolver for the handler-lane RBAC kill-switch.
 *   • platform_settings.handler_lane_rbac_enforced === true  → fence ON
 *   • false / NULL / unreadable / pre-migration              → fence OFF
 * UNCACHED on purpose (owner flip must take effect next request).
 */
export async function resolveHandlerLaneRbacEnforced(): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('platform_settings')
      .select('handler_lane_rbac_enforced')
      .eq('id', 1)
      .maybeSingle();
    const dbVal = data?.handler_lane_rbac_enforced as boolean | null | undefined;
    if (typeof dbVal === 'boolean') return dbVal;
  } catch {
    // DB unreachable / column absent (pre-migration) → fails-OFF below.
  }
  return false;
}

export type Handler = { userId: string; handlerRole: HandlerRole };

/**
 * Lane-aware admin gate. Drop-in superset of the per-file `requireAdmin()`:
 *   • Not signed in            → redirect('/login').
 *   • Signed in, not an admin  → throw 'Forbidden' (same as requireAdmin).
 *   • Admin, fence OFF         → allowed (legacy behavior; handlerRole reported).
 *   • Admin, fence ON, lane ok → allowed ('full' or matching lane).
 *   • Admin, fence ON, lane no → throw 'Forbidden: handler not scoped to this lane.'
 *
 * Pass `lane` to gate a specific queue; omit it to gate any admin (legacy
 * requireAdmin parity). The acting admin's resolved handlerRole is returned so
 * callers can branch UI / audit metadata on it.
 */
export async function requireHandler(lane?: HandlerLane): Promise<Handler> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type, handler_role')
    .eq('user_id', user.id)
    .maybeSingle();

  const isAdmin =
    me?.is_internal || me?.is_team_member || me?.account_type === 'admin';
  if (!isAdmin) {
    throw new Error('Forbidden');
  }

  const handlerRole: HandlerRole = isHandlerRole(me?.handler_role)
    ? me.handler_role
    : 'full';

  // Lane fence — only binds when the kill-switch is explicitly ON.
  if (lane) {
    const enforced = await resolveHandlerLaneRbacEnforced();
    if (enforced && handlerRole !== 'full' && handlerRole !== lane) {
      throw new Error('Forbidden: handler not scoped to this lane.');
    }
  }

  return { userId: user.id, handlerRole };
}

/**
 * Page-level lane fence. Same lane check as requireHandler(), but on a lane
 * mismatch it REDIRECTS the scoped handler to /admin (a graceful 302 to their
 * own dashboard) instead of throwing a 500 — the right UX when a handler
 * navigates to a queue outside their lane. Inert while the kill-switch is OFF.
 *
 * Auth (admin-or-not) is already enforced by app/admin/layout.tsx (notFound for
 * non-admins), so this only adds the lane dimension on top.
 */
export async function assertHandlerLaneOrRedirect(lane: HandlerLane): Promise<void> {
  if (!(await resolveHandlerLaneRbacEnforced())) return; // fails-OFF
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('handler_role')
    .eq('user_id', user.id)
    .maybeSingle();

  const handlerRole: HandlerRole = isHandlerRole(me?.handler_role)
    ? me.handler_role
    : 'full';

  if (handlerRole !== 'full' && handlerRole !== lane) {
    redirect('/admin');
  }
}
