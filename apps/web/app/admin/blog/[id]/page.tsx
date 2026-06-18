import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchBlogArticleByIdAdmin } from '@/lib/blog-db';
import { createBlogArticle, updateBlogArticle } from '../actions';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return { title: id === 'new' ? 'New article · Blog · Admin' : 'Edit article · Blog · Admin' };
}

const INPUT =
  'w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-terracotta/40';
const LABEL = 'block text-xs font-medium text-ink/60 mb-1';
const CATEGORIES = ['planning', 'vendors', 'culture', 'real-weddings', 'news'] as const;

export default async function AdminBlogArticlePage({ params }: Props) {
  const { id } = await params;
  const isNew = id === 'new';

  let article = null;
  if (!isNew) {
    const supabase = createAdminClient();
    article = await fetchBlogArticleByIdAdmin(supabase, Number(id));
    if (!article) notFound();
  }

  const action = isNew
    ? createBlogArticle
    : async (formData: FormData) => {
        'use server';
        await updateBlogArticle(Number(id), formData);
      };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">Content · Blog</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isNew ? 'New article' : 'Edit article'}
        </h1>
      </header>

      <form action={action} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={LABEL}>Title *</label>
            <input name="title" required defaultValue={article?.title ?? ''} className={INPUT} placeholder="The Complete Filipino Wedding Timeline" />
          </div>
          <div>
            <label className={LABEL}>Slug *</label>
            <input
              name="slug"
              required
              defaultValue={article?.slug ?? ''}
              className={INPUT}
              placeholder="filipino-wedding-timeline"
              readOnly={!isNew}
            />
            {!isNew && (
              <p className="mt-1 text-[10px] text-ink/40">Slug is locked after creation.</p>
            )}
          </div>
        </div>

        <div>
          <label className={LABEL}>Excerpt (shown on index cards + meta description)</label>
          <textarea name="excerpt" rows={2} defaultValue={article?.excerpt ?? ''} className={INPUT} placeholder="~120 chars summarising the article." />
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <label className={LABEL}>Category</label>
            <select name="category" defaultValue={article?.category ?? 'planning'} className={INPUT}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1).replace('-', ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Author</label>
            <input name="author" defaultValue={article?.author ?? 'Setnayan Editorial'} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Published date</label>
            <input name="published_at" type="date" defaultValue={article?.published_at ?? today} className={INPUT} />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={LABEL}>Cover image URL</label>
            <input name="cover_url" defaultValue={article?.cover_url ?? ''} className={INPUT} placeholder="/blog/my-article-cover.webp" />
          </div>
          <div>
            <label className={LABEL}>Cover alt text</label>
            <input name="cover_alt" defaultValue={article?.cover_alt ?? ''} className={INPUT} placeholder="A couple on the beach at sunset" />
          </div>
        </div>

        <div>
          <label className={LABEL}>
            Body (markdown)
            <span className="ml-2 font-normal text-ink/40">
              ## Heading · {'>'} Quote · - List item · plain paragraph
            </span>
          </label>
          <textarea
            name="body_md"
            rows={18}
            defaultValue={article?.body_md ?? ''}
            className={`${INPUT} font-mono text-xs leading-relaxed`}
            placeholder={`## Section heading\n\nA paragraph of body text goes here.\n\n> A pull-quote or highlight.\n\n- First list item\n- Second list item`}
          />
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-ink/80">
            <input name="featured" type="checkbox" defaultChecked={article?.featured ?? false} className="h-4 w-4 rounded border-ink/20" />
            Featured (index hero)
          </label>

          <div>
            <label className={LABEL}>Status</label>
            <select name="status" defaultValue={article?.status ?? 'draft'} className={INPUT}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-ink/10 pt-4">
          <button
            type="submit"
            className="rounded-md bg-terracotta px-4 py-2 text-sm font-medium text-cream hover:bg-terracotta/90"
          >
            {isNew ? 'Create article' : 'Save changes'}
          </button>
          <a href="/admin/blog" className="text-sm text-ink/50 hover:text-ink">
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
