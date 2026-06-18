import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchAllHelpArticlesAdmin } from '@/lib/help-db';
import { HELP_TOPICS } from '@/lib/help';
import { createHelpArticle, deleteHelpArticle } from './actions';

export const metadata = { title: 'Help center · Admin' };
export const dynamic = 'force-dynamic';

const ALL_ROLES = ['couple', 'vendor', 'guest', 'admin'] as const;

const ROLE_LABEL: Record<string, string> = {
  couple: 'Couple',
  vendor: 'Vendor',
  guest: 'Guest',
  admin: 'Admin',
};

const INPUT =
  'w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-terracotta/40';
const LABEL = 'block text-xs font-medium text-ink/60 mb-1';

// Collect all known topic keys: static + any new DB-only keys
const STATIC_TOPIC_KEYS = HELP_TOPICS.map((t) => t.key);
const STATIC_TOPIC_LABEL = Object.fromEntries(HELP_TOPICS.map((t) => [t.key, t.label]));

type SearchParams = Promise<{ ok?: string; error?: string; topic?: string }>;

export default async function AdminHelpCenterPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = createAdminClient();
  const dbArticles = await fetchAllHelpArticlesAdmin(supabase);

  // Merge topic keys: static + any DB-only topics
  const dbTopicKeys = [...new Set(dbArticles.map((a) => a.topic_key))];
  const allTopicKeys = [
    ...STATIC_TOPIC_KEYS,
    ...dbTopicKeys.filter((k) => !STATIC_TOPIC_KEYS.includes(k)),
  ];

  // Group DB articles by topic
  const byTopic = new Map<string, typeof dbArticles>();
  for (const article of dbArticles) {
    const existing = byTopic.get(article.topic_key) ?? [];
    existing.push(article);
    byTopic.set(article.topic_key, existing);
  }

  const totalStatic = HELP_TOPICS.reduce((n, t) => n + t.articles.length, 0);
  const activeTopic = params.topic ?? STATIC_TOPIC_KEYS[0];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">Content · Help center</p>
        <h1 className="text-2xl font-semibold tracking-tight">Help center articles</h1>
        <p className="mt-1 max-w-xl text-sm text-ink/60">
          DB articles override static ones with the same slug. {totalStatic} static articles in{' '}
          <code className="font-mono text-xs">lib/help.ts</code> keep publishing as the floor.
        </p>
      </header>

      {params.ok && (
        <div className="mb-4 rounded-md bg-green-50 px-4 py-2 text-sm text-green-800">
          {params.ok === 'deleted' ? 'Article deleted.' : params.ok === 'created' ? 'Article created.' : 'Saved.'}
        </div>
      )}
      {params.error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-800">
          {decodeURIComponent(params.error)}
        </div>
      )}

      <div className="flex gap-6">
        {/* Topic sidebar */}
        <nav className="w-48 shrink-0">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-ink/40">Topics</p>
          <ul className="space-y-0.5">
            {allTopicKeys.map((key) => {
              const count = byTopic.get(key)?.length ?? 0;
              const isActive = key === activeTopic;
              return (
                <li key={key}>
                  <Link
                    href={`/admin/help-center?topic=${key}`}
                    className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm ${
                      isActive
                        ? 'bg-terracotta/10 font-medium text-terracotta'
                        : 'text-ink/70 hover:bg-ink/5'
                    }`}
                  >
                    <span className="truncate">{STATIC_TOPIC_LABEL[key] ?? key}</span>
                    {count > 0 && (
                      <span className="ml-1 shrink-0 text-[10px] text-ink/40">{count}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Articles for selected topic */}
        <div className="flex-1">
          <h2 className="mb-4 text-base font-semibold text-ink">
            {STATIC_TOPIC_LABEL[activeTopic] ?? activeTopic}
          </h2>

          {/* Existing DB articles for this topic */}
          {(byTopic.get(activeTopic) ?? []).length > 0 ? (
            <div className="mb-6 overflow-hidden rounded-xl border border-ink/10 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/10 bg-ink/[0.02]">
                    <th className="px-4 py-2 text-left text-xs font-medium text-ink/50">Title / slug</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-ink/50">Roles</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-ink/50">Status</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/5">
                  {(byTopic.get(activeTopic) ?? []).map((a) => (
                    <tr key={a.id} className="hover:bg-ink/[0.02]">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-ink">{a.title}</div>
                        <div className="font-mono text-[10px] text-ink/40">{a.slug}</div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-ink/60">
                        {a.roles.join(', ')}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          a.is_published ? 'bg-green-50 text-green-700' : 'bg-ink/5 text-ink/40'
                        }`}>
                          {a.is_published ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          href={`/admin/help-center/${a.id}`}
                          className="text-xs font-medium text-terracotta hover:underline"
                        >
                          Edit
                        </Link>
                        <form
                          className="ml-3 inline"
                          action={async () => {
                            'use server';
                            await deleteHelpArticle(a.id);
                          }}
                        >
                          <button type="submit" className="text-xs text-ink/40 hover:text-red-600">
                            Delete
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mb-6 text-sm text-ink/40">
              No DB articles for this topic yet. Static articles still publish.
            </p>
          )}

          {/* Add new article form */}
          <details className="rounded-xl border border-ink/10 bg-white">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink hover:bg-ink/[0.02]">
              + Add article to {STATIC_TOPIC_LABEL[activeTopic] ?? activeTopic}
            </summary>
            <form action={createHelpArticle} className="space-y-4 px-4 pb-4 pt-3">
              <input type="hidden" name="topic_key" value={activeTopic} />

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={LABEL}>Title *</label>
                  <input name="title" required className={INPUT} placeholder="How do I add a vendor?" />
                </div>
                <div>
                  <label className={LABEL}>Slug *</label>
                  <input name="slug" required className={INPUT} placeholder="how-to-add-a-vendor" />
                </div>
              </div>

              <div>
                <label className={LABEL}>Body</label>
                <textarea
                  name="body"
                  rows={5}
                  className={INPUT}
                  placeholder="Plain-text answer, ~300 chars. No markdown — this renders as a paragraph."
                />
              </div>

              <div>
                <label className={LABEL}>Visible to roles</label>
                <div className="flex flex-wrap gap-3">
                  {ALL_ROLES.map((role) => (
                    <label key={role} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        name="roles"
                        value={role}
                        defaultChecked
                        className="h-4 w-4 rounded border-ink/20"
                      />
                      {ROLE_LABEL[role]}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="rounded-md bg-terracotta px-4 py-2 text-sm font-medium text-cream hover:bg-terracotta/90"
                >
                  Add article
                </button>
                <label className="flex items-center gap-1.5 text-sm text-ink/70">
                  <input type="checkbox" name="is_published" defaultChecked className="h-4 w-4 rounded border-ink/20" />
                  Publish immediately
                </label>
              </div>
            </form>
          </details>
        </div>
      </div>
    </div>
  );
}
