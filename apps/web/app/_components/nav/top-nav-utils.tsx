/**
 * TopNavUtils — v2.1 Navigation Refactor Phase 0.
 *
 * WHY: CLAUDE.md 2026-05-28 11th row "v2.1 template package adoption" +
 * 14th 2026-05-28 row System Wiring Map audit. The 3-doorway nav surfaces
 * all need a consistent right-aligned utilities cluster — search +
 * notifications bell + role-switch pill + profile menu — in the top bar.
 * This component composes those utility slots without importing the
 * specific existing components (UnreadBellBadge, RoleSwitchPill,
 * ProfileMenu) so it stays a server component AND avoids cross-iteration
 * import churn when those components rename / move.
 *
 * SCOPE: composition shell only. Callers inject existing components into
 * `notificationsSlot`, `roleSwitchSlot`, `profileMenuSlot`. The shell
 * arranges them with gap-3 horizontal flex + items-center. No background
 * of its own — sits inside caller's top bar.
 *
 * SEARCH BUTTON: optional render via `showSearch` prop. Caller wires
 * the actual search dialog in Phases 1-3 (Cmd-K overlay, route-scoped
 * search, etc.). V1.x. Phase 0 ships just the icon button shell so the
 * geometry locks early — no orphan affordance since the prop default
 * is false.
 *
 * Server-component because all interactive children are caller-injected
 * slots; this shell just composes them. Lets callers keep their existing
 * 'use client' boundaries on bell/profile/role-switch without forcing
 * this component to be a client component too.
 */

import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

type Props = {
  /**
   * Optional — when true, renders a search-icon button. Caller wires the
   * dialog separately in Phases 1-3. Defaults false (no orphan affordance).
   */
  showSearch?: boolean;
  /**
   * Authenticated user — kept in the contract for Phases 1-3 to pass
   * downstream into caller-injected slots (the slot can read it via
   * closure). Not consumed directly by this shell today; reserved.
   */
  user: User;
  /** Bell + unread badge slot — caller injects <UnreadBellBadge>. */
  notificationsSlot?: ReactNode;
  /** Role-switch pill slot — caller injects <RoleSwitchPill>. */
  roleSwitchSlot?: ReactNode;
  /** Avatar + dropdown slot — caller injects <ProfileMenu>. */
  profileMenuSlot?: ReactNode;
};

export function TopNavUtils({
  showSearch = false,
  user: _user,
  notificationsSlot,
  roleSwitchSlot,
  profileMenuSlot,
}: Props) {
  // `_user` is reserved for Phase 1-3 wiring (slots that need to derive
  // initials / email / role-eligibility from the User object). Phase 0
  // doesn't consume it — destructured + prefixed underscore to silence
  // unused-var lint without breaking the public contract.
  return (
    <div className="flex items-center gap-3">
      {showSearch ? <SearchButton /> : null}
      {notificationsSlot}
      {roleSwitchSlot}
      {profileMenuSlot}
    </div>
  );
}

/**
 * Bare search trigger — caller wires the dialog in Phases 1-3. Ships
 * with sr-only label so the icon-only button announces correctly to
 * assistive tech. No background, no border in idle state — relies on
 * hover ring to surface as interactive.
 */
function SearchButton() {
  return (
    <button
      type="button"
      aria-label="Search"
      className="inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[var(--m-paper-2)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        color: 'var(--m-slate)',
        outlineColor: 'var(--m-orange)',
      }}
    >
      <Search aria-hidden className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}
