'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Admin: update a `planning_deadlines` row's offset (the recommended lock-by
 * deadline the Home reminders read). RLS (`is_admin()`) gates the write — a
 * non-admin's UPDATE matches zero rows, so this is safe even though the form
 * posts from a page that's already admin-gated by the admin layout.
 */
export async function updatePlanningDeadline(formData: FormData) {
  const deadlineId = formData.get('deadline_id');
  const offsetValue = Number(formData.get('offset_value'));
  const offsetUnit = formData.get('offset_unit');

  if (typeof deadlineId !== 'string' || !deadlineId) {
    throw new Error('Missing deadline_id');
  }
  if (!Number.isInteger(offsetValue) || offsetValue < 0) {
    throw new Error('Offset must be a non-negative whole number');
  }
  if (offsetUnit !== 'day' && offsetUnit !== 'week' && offsetUnit !== 'month') {
    throw new Error('Invalid offset unit');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('planning_deadlines')
    .update({
      offset_value: offsetValue,
      offset_unit: offsetUnit,
      updated_at: new Date().toISOString(),
    })
    .eq('deadline_id', deadlineId);

  if (error) throw new Error(error.message);

  revalidatePath('/admin/taxonomy');
}
