'use server';

/**
 * Server actions for /admin/reveal-studio (the Reveal Studio).
 *
 * The admin page is gated by app/admin/layout.tsx, but server actions can be
 * invoked independently, so this re-verifies admin access. Writes use the
 * service-role client (reveal_studio_config has read-all RLS + no write policy,
 * matching platform_settings / homepage_hero_config). The incoming config is run
 * through mergeRevealConfig() so only known, type-checked fields are persisted.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchUserRoleSummary } from '@/lib/roles';
import { mergeRevealConfig } from '@/lib/reveal-config';

type Result = { ok: true } | { ok: false; error: string };

async function assertAdmin(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in.');
  const roles = await fetchUserRoleSummary(supabase, user.id);
  if (!roles.hasAdminAccess) throw new Error('Admin access required.');
  return user.id;
}

export async function saveRevealStudio(input: unknown): Promise<Result> {
  try {
    const adminId = await assertAdmin();
    // Sanitize through the canonical merger — drops unknown keys, clamps types.
    const config = mergeRevealConfig(input);
    const db = createAdminClient();
    const { error } = await db
      .from('reveal_studio_config')
      .update({
        config,
        updated_at: new Date().toISOString(),
        updated_by_admin_id: adminId,
      })
      .eq('id', 1);
    if (error) return { ok: false, error: error.message };
    // Couple sites read this on render — revalidate the dynamic [slug] route.
    revalidatePath('/[slug]', 'page');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Save failed.' };
  }
}
