'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  loadUgatTable,
  ugatSearch,
  runSavedSearch,
  type UgatTableKey,
  type UgatTablePage,
  type UgatSearchGroup,
  type UgatSavedSearch,
  type UgatSavedSearchKey,
} from '@/lib/ugat/data';

/**
 * /admin/ugat server actions — the interactive data reads for the Ugat Console.
 *
 * The admin layout already 404s non-admins (defense at the door); these actions
 * re-check on the server as defense-in-depth, since a server action is a public
 * POST endpoint regardless of which page mounted it. Every action calls
 * requireAdmin() first. No writes happen here (slice 1 is read-only — action
 * rails are slice 3), so there is no audit-log entry to make.
 */

async function requireAdmin(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Forbidden');
  }
  return { userId: user.id };
}

const VALID_TABLES: readonly UgatTableKey[] = [
  'users',
  'events',
  'guests',
  'vendors',
  'services',
  'orders',
  'threads',
  'billing',
];

/** Fetch one page (25 rows) of an entity table. Read-only. */
export async function fetchUgatTable(
  key: UgatTableKey,
  page: number,
): Promise<UgatTablePage> {
  await requireAdmin();
  if (!VALID_TABLES.includes(key)) {
    throw new Error('Unknown table');
  }
  const safePage = Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0;
  return loadUgatTable(key, safePage);
}

/** Live ⌘K omnibox search across records + taxonomy. Read-only. */
export async function fetchUgatSearch(query: string): Promise<UgatSearchGroup[]> {
  await requireAdmin();
  if (typeof query !== 'string') return [];
  return ugatSearch(query.slice(0, 120));
}

/** Run one of the three saved searches (Questions group). Read-only. */
export async function fetchUgatSavedSearch(
  key: UgatSavedSearchKey,
): Promise<UgatSavedSearch> {
  await requireAdmin();
  return runSavedSearch(key);
}
