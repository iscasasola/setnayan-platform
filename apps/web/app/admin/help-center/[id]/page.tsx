import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchHelpArticleByIdAdmin } from '@/lib/help-db';
import { HELP_TOPICS } from '@/lib/help';
import { updateHelpArticle } from '../actions';

export const metadata = { title: 'Edit help article · Admin' };
export const dynamic = 'force-dynamic';

const ALL_ROLES = ['couple', 'vendor', 'guest', 'admin'] as const;
const INPUT =
  'w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-terracotta/40';
const LABEL = 'block text-xs font-medium text-ink/60 mb-1';

type Props = { params: Promise<{ id: string }> };

export default async function AdminHelpArticleEditPage({ params }: Props) {
  const { id } = await params;
  const supabase = createAdminClient();
  const article = await fetchHelpArticleByIdAdmin(supabase, Number(id));
  if (!article) notFound();

  const action = async (formData: FormData) => {
    'use server';
    await updateHelpArticle(Number(id), formData);
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">Content · Help center</p>
        <h1 className="text-2xl font-semibold tracking-tight">Edit help article</h1>
        <p className="mt-1 font-mono text-xs text-ink/40">{article.slug}</p>
      </header>

      <form action={action} className="space-y-5">
        <div>
          <label className={LABEL}>Topic</label>
          <select name="topic_key" defaultValue={article.topic_key} className={INPUT}>
            {HELP_TOPICS.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL}>Title *</label>
          <input name="title" required defaultValue={article.title} className={INPUT} />
        </div>

        <div>
          <label className={LABEL}>
            Body
            <span className="ml-2 font-normal text-ink/40">plain text · ~300 chars · no markdown</span>
          </label>
          <textarea name="body" rows={6} defaultValue={article.body} className={INPUT} />
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
                  defaultChecked={article.roles.includes(role)}
                  className="h-4 w-4 rounded border-ink/20"
                />
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </label>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink/80">
          <input
            type="checkbox"
            name="is_published"
            defaultChecked={article.is_published}
            className="h-4 w-4 rounded border-ink/20"
          />
          Published
        </label>

        <div className="flex items-center gap-3 border-t border-ink/10 pt-4">
          <button
            type="submit"
            className="rounded-md bg-terracotta px-4 py-2 text-sm font-medium text-cream hover:bg-terracotta/90"
          >
            Save changes
          </button>
          <a href="/admin/help-center" className="text-sm text-ink/50 hover:text-ink">Cancel</a>
        </div>
      </form>
    </div>
  );
}
