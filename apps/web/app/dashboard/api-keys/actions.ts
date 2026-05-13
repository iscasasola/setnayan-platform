'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { generateApiKey, hashApiKey, keyPrefix } from '@/lib/api-keys';

export async function createApiKey(formData: FormData) {
  const rawName = formData.get('name');
  if (typeof rawName !== 'string') throw new Error('Invalid input');
  const name = rawName.trim().slice(0, 80);
  if (name.length === 0) {
    return redirect(
      `/dashboard/api-keys?error=${encodeURIComponent('Name is required')}`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const key = generateApiKey();
  const hash = hashApiKey(key);
  const prefix = keyPrefix(key);

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: user.id,
      name,
      key_prefix: prefix,
      key_hash: hash,
    })
    .select('api_key_id')
    .single();

  if (error || !data) {
    return redirect(
      `/dashboard/api-keys?error=${encodeURIComponent(error?.message ?? 'Could not create key')}`,
    );
  }

  revalidatePath('/dashboard/api-keys');
  // Pass the raw key value to the page via a transient query string — it's
  // shown to the user exactly once, then cleared on the next navigation.
  redirect(`/dashboard/api-keys?just_created=${encodeURIComponent(key)}`);
}

export async function revokeApiKey(formData: FormData) {
  const apiKeyId = formData.get('api_key_id');
  if (typeof apiKeyId !== 'string') throw new Error('Invalid input');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('api_key_id', apiKeyId)
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);

  revalidatePath('/dashboard/api-keys');
}
