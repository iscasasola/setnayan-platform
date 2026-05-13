'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const VALID_THEMES = ['setnayan_default', 'victorian', 'classy', 'ios'] as const;
type ThemePreference = (typeof VALID_THEMES)[number];

function isValidTheme(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (VALID_THEMES as readonly string[]).includes(value);
}

const VALID_PLANNER_MODES = ['guided', 'diy'] as const;
type PlannerMode = (typeof VALID_PLANNER_MODES)[number];

function isValidPlannerMode(value: unknown): value is PlannerMode {
  return typeof value === 'string' && (VALID_PLANNER_MODES as readonly string[]).includes(value);
}

export async function updateThemePreference(formData: FormData) {
  const raw = formData.get('theme');
  if (!isValidTheme(raw)) {
    throw new Error('Invalid theme');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('users')
    .update({ theme_preference: raw, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);

  revalidatePath('/dashboard', 'layout');
}

export async function updatePlannerMode(formData: FormData) {
  const raw = formData.get('planner_mode');
  if (!isValidPlannerMode(raw)) {
    throw new Error('Invalid planner mode');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('users')
    .update({ planner_mode: raw, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);

  revalidatePath('/dashboard', 'layout');
}
