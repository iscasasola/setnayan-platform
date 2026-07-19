'use server';

import { requireAdminAction } from '@/lib/admin/require-admin';
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
 * /admin/ugat/map server actions — the interactive data reads for the Ugat
 * Console entity map.
 *
 * The page gate (requireAdmin) sits in front of the render; these actions
 * re-check on the server as defense-in-depth, since a server action is a public
 * POST endpoint regardless of which page mounted it. Every action calls the
 * shared requireAdminAction() gate (council fix #1) first. No writes happen
 * here (slice 1 is read-only — action rails are slice 3), so there is no
 * audit-log entry to make.
 */

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
  await requireAdminAction();
  if (!VALID_TABLES.includes(key)) {
    throw new Error('Unknown table');
  }
  const safePage = Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0;
  return loadUgatTable(key, safePage);
}

/** Live ⌘K omnibox search across records + taxonomy. Read-only. */
export async function fetchUgatSearch(query: string): Promise<UgatSearchGroup[]> {
  await requireAdminAction();
  if (typeof query !== 'string') return [];
  return ugatSearch(query.slice(0, 120));
}

/** Run one of the three saved searches (Questions group). Read-only. */
export async function fetchUgatSavedSearch(
  key: UgatSavedSearchKey,
): Promise<UgatSavedSearch> {
  await requireAdminAction();
  return runSavedSearch(key);
}
