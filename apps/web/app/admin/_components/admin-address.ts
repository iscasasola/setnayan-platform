'use client';

import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Where an admin page is: the real address — or `at`, an address the dev lab draws on fixtures
 * (`/dev/admin-shell-lab`). Kept in its own module (no CSS, no components) so the bar's and the rail's tab lists stay
 * importable by plain `node --test` guards.
 */
export function useAdminAddress(at?: string): { pathname: string; params: { get(k: string): string | null } | null } {
  const pathname = usePathname() ?? '/admin';
  const params = useSearchParams();
  if (at === undefined) return { pathname, params };
  const [p, q] = at.split('?');
  return { pathname: p!, params: new URLSearchParams(q ?? '') };
}
