import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchAllBlogArticlesAdmin } from '@/lib/blog-db';
import { BLOG_ARTICLES } from '@/lib/blog';
import { toggleBlogStatus, deleteBlogArticle } from './actions';

export const metadata = { title: 'Blog · Admin' };
export const dynamic = 'force-dynamic';

const CATEGORY_LABEL: Record<string, string> = {
  planning: 'Planning',
  vendors: 'Vendors',
  culture: 'Culture',
  'real-weddings': 'Real Weddings',
  news: 'News',
};

type SearchParams = Promise<{ ok?: string }>;

export default async function AdminBlogPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = createAdminClient();
  const dbArticles = await fetchAllBlogArticlesAdmin(supabase);

  const staticSlugs = new Set(BLOG_ARTICLES.map((a) => a.slug));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="m-eyebrow text-[color:var(--m-orange-2)]">Content · Blog</p>
          <h1 className="text-2xl font-semibold tracking-tight">Setnayan Journal</h1>
          <p className="mt-1 max-w-xl text-sm text-ink/60">
            DB articles override static ones with the same slug. Static articles in{' '}
            <code className="font-mono text-xs">lib/blog.ts</code> are the floor (
            {BLOG_ARTICLES.length} articles) and keep publishing unchanged.
          </p>
        </div>
        <Link
          href="/admin/blog/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-terracotta px-3 py-2 text-sm font-medium text-cream hover:bg-terracotta/90"
        >
          <Plus size={14} />
          New article
        </Link>
      </header>

      {params.ok && (
        <div className="mb-4 rounded-md bg-green-50 px-4 py-2 text-sm text-green-800">
          {params.ok === 'deleted' ? 'Article deleted.' : 'Saved.'}
        </div>
      )}

      {dbArticles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 bg-cream p-10 text-center">
          <p className="text-base font-medium text-ink/75">No DB articles yet.</p>
          <p className="mt-1 text-sm text-ink/50">
            Static articles in lib/blog.ts keep publishing. Add a DB article to override or
            supplement.
          </p>
          <Link
            href="/admin/blog/new"
            className="mt-4 inline-flex items-center gap-1 rounded-md bg-terracotta px-4 py-2 text-sm font-medium text-cream hover:bg-terracotta/90"
          >
            <Plus size={14} /> New article
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-ink/10 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10 bg-ink/[0.02]">
                <th className="px-4 py-3 text-left font-medium text-ink/60">Title</th>
                <th className="hidden px-4 py-3 text-left font-medium text-ink/60 sm:table-cell">Category</th>
                <th className="hidden px-4 py-3 text-left font-medium text-ink/60 md:table-cell">Date</th>
                <th className="px-4 py-3 text-left font-medium text-ink/60">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {dbArticles.map((article) => {
                const overridesStatic = staticSlugs.has(article.slug);
                return (
                  <tr key={article.id} className="hover:bg-ink/[0.02]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{article.title}</div>
                      <div className="font-mono text-xs text-ink/40">{article.slug}</div>
                      {overridesStatic && (
                        <span className="mt-0.5 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          overrides static
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-ink/60 sm:table-cell">
                      {CATEGORY_LABEL[article.category] ?? article.category}
                    </td>
                    <td className="hidden px-4 py-3 text-ink/60 md:table-cell">
                      {article.published_at}
                    </td>
                    <td className="px-4 py-3">
                      <form
                        action={async () => {
                          'use server';
                          await toggleBlogStatus(article.id, article.status);
                        }}
                      >
                        <button
                          type="submit"
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            article.status === 'published'
                              ? 'bg-green-50 text-green-700 hover:bg-green-100'
                              : 'bg-ink/5 text-ink/50 hover:bg-ink/10'
                          }`}
                        >
                          {article.status === 'published' ? 'Published' : 'Draft'}
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/blog/${article.id}`}
                        className="text-xs font-medium text-terracotta hover:underline"
                      >
                        Edit
                      </Link>
                      <form
                        className="ml-3 inline"
                        action={async () => {
                          'use server';
                          await deleteBlogArticle(article.id);
                        }}
                      >
                        <button
                          type="submit"
                          className="text-xs text-ink/40 hover:text-red-600"
                          onClick={(e) => {
                            if (!confirm('Delete this article?')) e.preventDefault();
                          }}
                        >
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-xs text-ink/40">
        {BLOG_ARTICLES.length} hardcoded articles in lib/blog.ts also publish on /blog.
        They don&apos;t appear here — add a DB article with the same slug to override one.
      </p>
    </div>
  );
}
