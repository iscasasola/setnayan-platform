'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';

function trimmed(raw: FormDataEntryValue | null, max: number): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, max);
}

export async function submitHelpMessage(formData: FormData) {
  const email = trimmed(formData.get('sender_email'), 160);
  const name = trimmed(formData.get('sender_name'), 128);
  const topic = trimmed(formData.get('topic'), 64);
  const subject = trimmed(formData.get('subject'), 160);
  const body = trimmed(formData.get('body'), 4000);

  if (email.length === 0 || subject.length === 0 || body.length === 0) {
    return redirect(
      `/help?error=${encodeURIComponent('Email, subject, and message are required.')}`,
    );
  }

  // Attach user_id when the submitter is signed in — doesn't reveal identity
  // beyond what they typed, but lets admins thread replies.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('help_messages')
    .insert({
      user_id: user?.id ?? null,
      sender_email: email,
      sender_name: name.length > 0 ? name : null,
      topic: topic.length > 0 ? topic : null,
      subject,
      body,
    })
    .select('message_id, public_id')
    .single();

  if (error || !data) {
    return redirect(
      `/help?error=${encodeURIComponent(error?.message ?? 'Could not submit. Try again.')}`,
    );
  }

  // Notify every internal admin so they see a count in their dashboard bell.
  try {
    const admin = createAdminClient();
    const { data: internals } = await admin
      .from('users')
      .select('user_id')
      .or('is_internal.eq.true,is_team_member.eq.true,account_type.eq.admin');
    for (const adminUser of internals ?? []) {
      await emitNotification({
        userId: adminUser.user_id,
        type: 'chat_message',
        title: `Help request · ${subject}`,
        body: `${email}: ${body.slice(0, 140)}`,
        // Anchor to the specific message in the flat /admin/help list — there
        // is no /admin/help/[messageId] subroute. The <li> in admin/help/page.tsx
        // carries id={`message-${message_id}`} so the email link scrolls the
        // admin straight to the new request.
        relatedUrl: `/admin/help#message-${data.message_id}`,
      });
    }
  } catch {
    // Notification failures shouldn't block the user's submission.
  }

  return redirect(`/help?submitted=${encodeURIComponent(data.public_id)}`);
}
