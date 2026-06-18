'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';

export async function createBlogArticle(formData: FormData) {
  const supabase = createAdminClient();
  const slug = (formData.get('slug') as string).trim().toLowerCase().replace(/\s+/g, '-');
  const { data, error } = await supabase
    .from('blog_articles')
    .insert({
      slug,
      title: formData.get('title') as string,
      excerpt: formData.get('excerpt') as string,
      category: formData.get('category') as string,
      author: (formData.get('author') as string) || 'Setnayan Editorial',
      published_at: formData.get('published_at') as string,
      featured: formData.get('featured') === 'on',
      cover_url: formData.get('cover_url') as string,
      cover_alt: formData.get('cover_alt') as string,
      body_md: formData.get('body_md') as string,
      status: formData.get('status') as string,
    })
    .select('id')
    .single();

  if (error) {
    redirect(`/admin/blog/new?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath('/blog');
  revalidatePath('/admin/blog');
  redirect(`/admin/blog/${data.id}?ok=created`);
}

export async function updateBlogArticle(id: number, formData: FormData) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('blog_articles')
    .update({
      title: formData.get('title') as string,
      excerpt: formData.get('excerpt') as string,
      category: formData.get('category') as string,
      author: (formData.get('author') as string) || 'Setnayan Editorial',
      published_at: formData.get('published_at') as string,
      featured: formData.get('featured') === 'on',
      cover_url: formData.get('cover_url') as string,
      cover_alt: formData.get('cover_alt') as string,
      body_md: formData.get('body_md') as string,
      status: formData.get('status') as string,
      updated_at: new Date().toISOString().slice(0, 10),
    })
    .eq('id', id);

  if (error) {
    redirect(`/admin/blog/${id}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath('/blog');
  revalidatePath('/admin/blog');
  redirect(`/admin/blog/${id}?ok=saved`);
}

export async function deleteBlogArticle(id: number) {
  const supabase = createAdminClient();
  await supabase.from('blog_articles').delete().eq('id', id);
  revalidatePath('/blog');
  revalidatePath('/admin/blog');
  redirect('/admin/blog?ok=deleted');
}

export async function toggleBlogStatus(id: number, currentStatus: string) {
  const supabase = createAdminClient();
  const newStatus = currentStatus === 'published' ? 'draft' : 'published';
  // Only one article featured at a time — clear featured on others when publishing a featured row.
  if (newStatus === 'published') {
    const { data: row } = await supabase
      .from('blog_articles')
      .select('featured')
      .eq('id', id)
      .single();
    if (row?.featured) {
      await supabase
        .from('blog_articles')
        .update({ featured: false })
        .neq('id', id)
        .eq('featured', true);
    }
  }
  await supabase.from('blog_articles').update({ status: newStatus }).eq('id', id);
  revalidatePath('/blog');
  revalidatePath('/admin/blog');
}
