/**
 * admin-search-memory.ts — reading what the assistant has learned.
 *
 * `admin_search_phrases` has RLS on and NO policy, on purpose (see its own
 * migration comment): every read and write goes through the service role,
 * outside RLS entirely. This is that read, for the one screen that shows it.
 *
 * 🔑 `count === null` MEANS "NOT MEASURED", NOT "ZERO" — the house rule this
 * repo has paid for before (`admin/work`, 2026-08-05). A rejected query
 * resolves with `{ data: null, error }`, not a throw, so the caller must carry
 * the error forward rather than coercing `null` to `[]` and reporting a calm
 * "nothing learned yet" over a broken read.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';

export type SearchMemoryRow = {
  phrase: string;
  href: string;
  label: string;
  learnedFrom: 'ai' | 'admin';
  timesUsed: number;
  createdAt: string;
  lastUsedAt: string | null;
};

export type SearchMemoryReport = {
  rows: SearchMemoryRow[] | null;
  error: { message?: string } | null;
};

export async function loadSearchMemory(): Promise<SearchMemoryReport> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('admin_search_phrases')
    .select('phrase, href, label, learned_from, times_used, created_at, last_used_at')
    .order('last_used_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) return { rows: null, error };
  return {
    rows: (data ?? []).map((r) => ({
      phrase: String(r.phrase),
      href: String(r.href),
      label: String(r.label),
      learnedFrom: r.learned_from === 'admin' ? 'admin' : 'ai',
      timesUsed: Number(r.times_used ?? 0),
      createdAt: String(r.created_at),
      lastUsedAt: r.last_used_at ? String(r.last_used_at) : null,
    })),
    error: null,
  };
}

/**
 * The remembered phrases the ⌘K box ranks first ("You picked this before") — phrase, place and count, nothing else.
 * Read once per admin page by the layout, so the box answers while typing with no round trip. A refused read is an
 * empty memory for this page load: the box still works; it simply has nothing remembered to put first.
 */
export async function fetchLearnedPicks(): Promise<
  { phrase: string; href: string; label: string; timesUsed: number }[]
> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }
  const { data, error } = await admin
    .from('admin_search_phrases')
    .select('phrase, href, label, times_used')
    .order('last_used_at', { ascending: false, nullsFirst: false })
    .limit(1000);
  if (error) {
    logQueryError('fetchLearnedPicks (admin_search_phrases)', error);
    return [];
  }
  return (data ?? []).map((r) => ({
    phrase: String(r.phrase),
    href: String(r.href),
    label: String(r.label),
    timesUsed: Number(r.times_used ?? 0),
  }));
}
