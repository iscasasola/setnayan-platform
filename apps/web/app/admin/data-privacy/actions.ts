'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminAction as requireAdmin } from '@/lib/admin/require-admin';
import { DATA_PRIVACY_CONTROLS, type PrivacyControlStatus } from '@/lib/data-privacy-controls';

const VALID_KEYS = new Set<string>(DATA_PRIVACY_CONTROLS.map((c) => c.key));
const VALID_STATUS = new Set<PrivacyControlStatus>(['inactive', 'active', 'blocked']);

function done(msg: string) {
  redirect(`/admin/data-privacy?flash=${encodeURIComponent(msg)}`);
}
function fail(msg: string): never {
  redirect(`/admin/data-privacy?error=${encodeURIComponent(msg)}`);
}

/**
 * Set a data-privacy control's status (admin approval board). Records the
 * approving admin + timestamp + note as the RA 10173 audit trail. Upserts so a
 * not-yet-seeded control still saves. The row already carries its catalog copy
 * from the seed; we write only the mutable fields.
 */
export async function setDataPrivacyControl(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();

  const key = String(formData.get('control_key') ?? '');
  const status = String(formData.get('status') ?? '') as PrivacyControlStatus;
  const note = (String(formData.get('note') ?? '').trim() || null)?.slice(0, 1000) ?? null;

  if (!VALID_KEYS.has(key)) fail('Unknown control.');
  if (!VALID_STATUS.has(status)) fail('Invalid status.');

  const def = DATA_PRIVACY_CONTROLS.find((c) => c.key === key)!;
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { error } = await admin.from('data_privacy_controls').upsert(
    {
      control_key: key,
      title: def.title,
      description: def.description,
      category: def.category,
      risk_note: def.riskNote,
      status,
      // Stamp the approver only when moving to active; keep the history note.
      approved_by: status === 'active' ? userId : null,
      approved_at: status === 'active' ? nowIso : null,
      note,
      updated_at: nowIso,
    },
    { onConflict: 'control_key' },
  );
  if (error) fail(error.message);

  revalidatePath('/admin/data-privacy');
  done(
    status === 'active'
      ? `“${def.title}” is now active.`
      : status === 'blocked'
        ? `“${def.title}” is blocked.`
        : `“${def.title}” is off.`,
  );
}
