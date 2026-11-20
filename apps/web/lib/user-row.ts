import 'server-only';
import { cache } from 'react';
import type { PostgrestError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * lib/user-row.ts — THE SIGNED-IN PERSON'S OWN `users` ROW, READ ONCE PER RENDER (speed pass 2026-11-18).
 *
 * Measured on da4a079: every dashboard, supplier and admin page read this row TWICE — once in its layout (account
 * type, deleted, tours, Terms) and once in the account switcher (`get-switcher-data.ts`: name, photo, appearance) —
 * two round trips for one row. Both now ask here; `React.cache` hands the second the first one's promise.
 *
 * The columns are the union of what those readers asked, through the same cookie-scoped client each of them made, so
 * the same RLS row answers. The column-drift guard the dashboard layout carried (a column missing in production →
 * `SELECT *`) is kept here for everyone: `fellBack` says it ran.
 *
 * ⚠ A REFUSED READ STAYS REFUSED: `error` is handed back untouched and each caller keeps its own answer to it.
 */
/**
 * 🔑 NOT A CANONICAL SELECT, and named so (not `*_COLUMNS`) — the same rule as `DASHBOARD_ROW_CARRIES`
 * (`lib/event-row-once.ts`). It is the UNION of what the layouts and the switcher each want; a reader that names fewer
 * columns of `users` is not "dropping" any of it, so `lint:dup-rule`'s omitted-column guard does not apply.
 */
export const USER_ROW_CARRIES =
  'account_type, deleted_at, tour_seen_keys, display_name, terms_version, email, profile_photo_url, profile_focal_x, profile_focal_y, profile_zoom, is_internal, is_team_member, theme_preference';

/** The row's named columns. Under a `SELECT *` fallback a missing one is simply absent, so each is optional-safe. */
export type UserRow = {
  account_type: string | null;
  deleted_at: string | null;
  tour_seen_keys: string[] | null;
  display_name: string | null;
  terms_version: string | null;
  email: string;
  profile_photo_url: string | null;
  profile_focal_x: number | null;
  profile_focal_y: number | null;
  profile_zoom: number | null;
  is_internal: boolean;
  is_team_member: boolean;
  theme_preference: string | null;
};

export type UserRowRead = {
  data: UserRow | null;
  error: PostgrestError | null;
  /** The named columns were refused as missing (migration drift) and the row was read with `SELECT *`. */
  fellBack: boolean;
};

const MISSING_COLUMN = /column .* does not exist|undefined_column|42703/i;

export const getUserRow = cache(async (userId: string): Promise<UserRowRead> => {
  const supabase = await createClient();
  const res = await supabase.from('users').select(USER_ROW_CARRIES).eq('user_id', userId).maybeSingle();
  if (res.error && MISSING_COLUMN.test(res.error.message ?? res.error.code ?? '')) {
    const fallback = await supabase.from('users').select('*').eq('user_id', userId).maybeSingle();
    return { data: (fallback.data as UserRow | null) ?? null, error: fallback.error, fellBack: true };
  }
  return { data: (res.data as unknown as UserRow | null) ?? null, error: res.error, fellBack: false };
});
