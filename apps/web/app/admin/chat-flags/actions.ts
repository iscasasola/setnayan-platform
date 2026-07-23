'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminAction as requireAdmin } from '@/lib/admin/require-admin';

// /admin/chat-flags actions — moderator resolution for the off-platform-contact
// chat flag queue (chat_message_flags · migration 20270920573307). A flag can be:
//   · reviewed   — seen + noted (e.g. coached the vendor); status 'reviewed'.
//   · dismiss    — false positive / no action; status 'dismissed'.
// The message was already BLOCKED at send time — these actions record
// the moderator outcome, they do not change what the counterparty saw.
//
// Mirrors the requireAdmin + revalidatePath shape of admin/user-reports/actions.ts.

const ACTIONS = ['reviewed', 'dismiss'] as const;
type Action = (typeof ACTIONS)[number];

function isAction(v: FormDataEntryValue | null): v is Action {
  return typeof v === 'string' && (ACTIONS as readonly string[]).includes(v);
}

const ACTION_NOTE: Record<Action, string> = {
  reviewed: 'Reviewed by Setnayan moderator.',
  dismiss: 'Dismissed — no action (false positive or benign).',
};

const ACTION_STATUS: Record<Action, 'reviewed' | 'dismissed'> = {
  reviewed: 'reviewed',
  dismiss: 'dismissed',
};

export async function resolveChatFlag(formData: FormData) {
  const { userId } = await requireAdmin();
  const flagId = formData.get('flag_id');
  const action = formData.get('action');

  if (typeof flagId !== 'string' || flagId.length === 0) {
    throw new Error('Invalid input');
  }
  if (!isAction(action)) {
    throw new Error('Pick an action');
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('chat_message_flags')
    .update({
      status: ACTION_STATUS[action],
      action_taken: ACTION_NOTE[action],
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('flag_id', flagId);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/chat-flags');
}
