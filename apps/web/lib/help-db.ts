/**
 * Help CMS — DB read/write helpers.
 *
 * Bridges the `help_articles` Supabase table (migration 20270114000001)
 * and the `HelpArticle` / `HelpTopic` types from lib/help.ts.
 *
 * DB-first / static-fallback: the public /help pages call
 * fetchHelpArticlesFromDB() and merge the result with HELP_TOPICS from
 * lib/help.ts — DB row wins when both share a slug.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { HelpArticle, HelpRole } from './help';

type DbHelpRow = {
  id: number;
  topic_key: string;
  slug: string;
  title: string;
  body: string;
  roles: string[];
  display_order: number;
  is_published: boolean;
  created_at: string;
};

function rowToArticle(row: DbHelpRow): HelpArticle {
  return { slug: row.slug, title: row.title, body: row.body };
}

/** Returns all published DB help articles grouped by topic_key. */
export async function fetchHelpArticlesFromDB(
  supabase: SupabaseClient,
): Promise<Map<string, HelpArticle[]>> {
  const { data } = await supabase
    .from('help_articles')
    .select('*')
    .eq('is_published', true)
    .order('display_order', { ascending: true });

  const map = new Map<string, HelpArticle[]>();
  for (const row of (data ?? []) as DbHelpRow[]) {
    const existing = map.get(row.topic_key) ?? [];
    existing.push(rowToArticle(row));
    map.set(row.topic_key, existing);
  }
  return map;
}

/** Returns a single published help article by slug, or null. */
export async function fetchHelpArticleFromDB(
  supabase: SupabaseClient,
  slug: string,
): Promise<(HelpArticle & { topicKey: string; roles: HelpRole[] }) | null> {
  const { data } = await supabase
    .from('help_articles')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();
  if (!data) return null;
  const row = data as DbHelpRow;
  return {
    slug: row.slug,
    title: row.title,
    body: row.body,
    topicKey: row.topic_key,
    roles: row.roles as HelpRole[],
  };
}

// ── Admin reads (all statuses) ────────────────────────────────────────────────

export async function fetchAllHelpArticlesAdmin(
  supabase: SupabaseClient,
): Promise<DbHelpRow[]> {
  const { data } = await supabase
    .from('help_articles')
    .select('*')
    .order('topic_key', { ascending: true })
    .order('display_order', { ascending: true });
  return (data ?? []) as DbHelpRow[];
}

export async function fetchHelpArticleByIdAdmin(
  supabase: SupabaseClient,
  id: number,
): Promise<DbHelpRow | null> {
  const { data } = await supabase
    .from('help_articles')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return (data ?? null) as DbHelpRow | null;
}
