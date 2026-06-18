/**
 * Blog CMS — DB read/write helpers.
 *
 * These functions bridge the `blog_articles` Supabase table (migration
 * 20270114000001) and the existing `BlogArticle` type from lib/blog.ts.
 * The public /blog pages call these to check for DB-managed overrides;
 * admin CRUD actions import the write helpers.
 *
 * DB-first / static-fallback contract:
 *   fetchPublishedBlogArticlesFromDB() returns published DB rows as BlogArticle[].
 *   The public index page merges these with BLOG_ARTICLES from lib/blog.ts —
 *   DB row wins when both share a slug.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BlogArticle, BlogBlock, BlogCategoryKey } from './blog';

// ── Markdown → BlogBlock[] parser ────────────────────────────────────────────
// Converts the `body_md` textarea input into the typed block format the
// existing public renderer already understands. Supports:
//   ## Heading        → { type: 'h2', text }
//   > Quote           → { type: 'quote', text }
//   - item\n- item    → { type: 'ul', items }
//   everything else   → { type: 'p', text }
export function parseMdToBlocks(md: string): BlogBlock[] {
  return md
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((section): BlogBlock[] => {
      if (/^#{1,2}\s/.test(section)) {
        return [{ type: 'h2', text: section.replace(/^#+\s+/, '') }];
      }
      if (section.startsWith('> ')) {
        return [{ type: 'quote', text: section.slice(2).trim() }];
      }
      const lines = section.split('\n');
      if (lines.length > 0 && lines.every((l) => l.trim().startsWith('- '))) {
        return [{ type: 'ul', items: lines.map((l) => l.trim().slice(2)) }];
      }
      return [{ type: 'p', text: section }];
    });
}

type DbBlogRow = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  published_at: string;
  updated_at: string | null;
  featured: boolean;
  cover_url: string;
  cover_alt: string;
  body_md: string;
  status: string;
  display_order: number;
  created_at: string;
};

function rowToArticle(row: DbBlogRow): BlogArticle {
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    category: row.category as BlogCategoryKey,
    author: row.author,
    publishedAt: row.published_at,
    updatedAt: row.updated_at ?? undefined,
    featured: row.featured,
    cover: row.cover_url,
    coverAlt: row.cover_alt,
    blocks: parseMdToBlocks(row.body_md),
  };
}

export async function fetchPublishedBlogArticlesFromDB(
  supabase: SupabaseClient,
): Promise<BlogArticle[]> {
  const { data } = await supabase
    .from('blog_articles')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false });
  return (data ?? []).map(rowToArticle);
}

export async function fetchBlogArticleFromDB(
  supabase: SupabaseClient,
  slug: string,
): Promise<BlogArticle | null> {
  const { data } = await supabase
    .from('blog_articles')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  return data ? rowToArticle(data) : null;
}

// ── Admin read (all statuses) ─────────────────────────────────────────────────

export async function fetchAllBlogArticlesAdmin(
  supabase: SupabaseClient,
): Promise<DbBlogRow[]> {
  const { data } = await supabase
    .from('blog_articles')
    .select('*')
    .order('created_at', { ascending: false });
  return (data ?? []) as DbBlogRow[];
}

export async function fetchBlogArticleByIdAdmin(
  supabase: SupabaseClient,
  id: number,
): Promise<DbBlogRow | null> {
  const { data } = await supabase
    .from('blog_articles')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return (data ?? null) as DbBlogRow | null;
}
