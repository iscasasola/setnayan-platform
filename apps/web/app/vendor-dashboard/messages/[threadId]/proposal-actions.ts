'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { sendProposalCore, type SendProposalError } from '@/lib/proposal-send';

/**
 * In-chat proposal — send a full structured vendor_proposals proposal straight
 * from the conversation, so a vendor can quote (and re-quote) without leaving
 * the thread. The gating + insert now lives in sendProposalCore
 * (lib/proposal-send.ts) so the native endpoint
 * (api/vendor/chat/[threadId]/proposal) shares it. This action is the FormData
 * + redirect-notice wrapper.
 *
 * The proposal lands as a CARD in the thread (chat_messages.proposal_id), and
 * the couple accepts via the existing DB-guarded respond_vendor_proposal RPC
 * (which prices their event_vendors row). We never write a price here.
 */
const NOTICE_BY_CODE: Record<Exclude<SendProposalError, 'unauthenticated' | 'not_owner'>, string> = {
  thread_closed: 'proposal_thread_closed',
  needs_template: 'proposal_needs_template',
  failed: 'proposal_failed',
};

export async function sendProposalFromChat(formData: FormData) {
  const supabase = await createClient();
  const threadId = String(formData.get('thread_id') ?? '');
  const back = `/vendor-dashboard/messages/${threadId}`;

  const totalPhpRaw = Number(formData.get('total_php'));
  const result = await sendProposalCore(supabase, {
    threadId,
    templateId: String(formData.get('template_id') ?? ''),
    packageId: String(formData.get('package_id') ?? ''),
    totalPhp: Number.isFinite(totalPhpRaw) ? totalPhpRaw : null,
    validUntil: String(formData.get('valid_until') ?? ''),
    title: String(formData.get('title') ?? ''),
  });

  if (!result.ok) {
    if (result.code === 'unauthenticated') redirect('/login');
    if (result.code === 'not_owner') redirect('/vendor-dashboard/messages');
    redirect(`${back}?notice=${NOTICE_BY_CODE[result.code]}`);
  }

  revalidatePath(back);
  redirect(`${back}?notice=${result.cardPosted ? 'proposal_sent' : 'proposal_sent_no_card'}`);
}
