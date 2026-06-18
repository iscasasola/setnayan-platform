'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';

export async function createHelpArticle(formData: FormData) {
  const supabase = createAdminClient();
  const slug = (formData.get('slug') as string).trim().toLowerCase().replace(/\s+/g, '-');
  const rolesRaw = formData.getAll('roles') as string[];

  const { error } = await supabase.from('help_articles').insert({
    topic_key: formData.get('topic_key') as string,
    slug,
    title: formData.get('title') as string,
    body: formData.get('body') as string,
    roles: rolesRaw.length > 0 ? rolesRaw : ['couple', 'vendor', 'guest', 'admin'],
    is_published: formData.get('is_published') === 'on',
  });

  if (error) {
    redirect(`/admin/help-center?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath('/help');
  revalidatePath('/admin/help-center');
  redirect('/admin/help-center?ok=created');
}

export async function updateHelpArticle(id: number, formData: FormData) {
  const supabase = createAdminClient();
  const rolesRaw = formData.getAll('roles') as string[];

  const { error } = await supabase
    .from('help_articles')
    .update({
      topic_key: formData.get('topic_key') as string,
      title: formData.get('title') as string,
      body: formData.get('body') as string,
      roles: rolesRaw.length > 0 ? rolesRaw : ['couple', 'vendor', 'guest', 'admin'],
      is_published: formData.get('is_published') === 'on',
    })
    .eq('id', id);

  if (error) {
    redirect(`/admin/help-center?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath('/help');
  revalidatePath('/admin/help-center');
  redirect('/admin/help-center?ok=saved');
}

export async function deleteHelpArticle(id: number) {
  const supabase = createAdminClient();
  await supabase.from('help_articles').delete().eq('id', id);
  revalidatePath('/help');
  revalidatePath('/admin/help-center');
  redirect('/admin/help-center?ok=deleted');
}
