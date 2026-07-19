import { after } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { uploadPublicAsset } from '@/lib/storage';
import { tierCaps } from '@/lib/vendor-tier-caps';
import { triggerVendorActivityRecompute } from '@/lib/vendor-activity';
import { leadTokenHoldEnabled, consumeLeadHoldOnCoupleReply } from '@/lib/lead-token-holds';
import { fetchThreadById } from './chat';
import { notifyOtherParty } from './chat-actions';

/**
 * Small allowlist for chat attachments — images the renderer can thumbnail
 * plus PDFs / common office docs. Kept narrow on purpose (no archives, no
 * executables). Shared with the composer's `accept` attribute so the client
 * and server agree on what's postable.
 */
export const CHAT_ATTACHMENT_MIME = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
] as const;

/** 25 MB hard cap on a single chat attachment. */
export const CHAT_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;

const CHAT_ATTACHMENT_MIME_SET = new Set<string>(CHAT_ATTACHMENT_MIME);

/** Resolved attachment metadata written onto the inserted chat_messages row. */
type ResolvedAttachment = {
  attachment_url: string;
  attachment_name: string;
  attachment_mime: string;
  attachment_size_bytes: number;
};

/**
 * Plain (non-'use server') module holding the shared gating CORE for sending a
 * plain-text chat message. Split out of chat-actions.ts so the SAME gating runs
 * under both the web server action (`sendChatMessage`) and the native-facing
 * JSON endpoint (api/vendor/chat/[threadId]/send) — see the Papic-gallery reuse
 * pattern. The 'use server' file can only export async server actions, so the
 * result types + the client-agnostic core live here.
 *
 * The cycle with chat-actions (this imports notifyOtherParty; chat-actions
 * imports sendChatMessageCore) is safe: every cross-reference is a call-time,
 * not module-eval-time, dependency.
 */

export type SendMessageError =
  | 'empty'
  | 'too_long'
  | 'unauthenticated'
  | 'thread_not_found'
  | 'not_member'
  | 'declined'
  | 'followup_used'
  | 'not_accepted'
  | 'tier_free'
  | 'attachment_invalid'
  | 'attachment_failed'
  | 'insert_failed';

export type SendMessageResult =
  | { ok: true }
  | { ok: false; code: SendMessageError; message: string };

/**
 * The gating + insert + notify CORE for a plain-text chat message, shared by the
 * web `sendChatMessage` server action and the native-facing JSON endpoint.
 * Single source of truth for the accept-gate, the couple one-follow-up rule, and
 * the FREE-vendor tier gate — so native never re-implements any of it. The
 * caller passes its OWN RLS-scoped client (cookie-based on web, bearer-scoped on
 * native); every check runs under that session.
 *
 * Returns a discriminated result instead of throwing/redirecting, so each caller
 * maps it to its own surface (the action throws/redirects; the route returns
 * JSON). The empty-body case is a result, not an error — the action treats it as
 * a no-op redirect.
 */
export async function sendChatMessageCore(
  supabase: SupabaseClient,
  input: { threadId: string; body: string; attachment?: File | null },
): Promise<SendMessageResult> {
  const trimmed = input.body.trim();
  // An OPTIONAL attachment rides alongside — or instead of — the text body. A
  // message is valid with body OR attachment OR both. Native callers pass no
  // attachment, so this stays a pure text send for them.
  const hasAttachment = input.attachment instanceof File && input.attachment.size > 0;
  if (trimmed.length === 0 && !hasAttachment) {
    return { ok: false, code: 'empty', message: 'Message can’t be empty.' };
  }
  if (trimmed.length > 4000) {
    return { ok: false, code: 'too_long', message: 'Message too long — max 4,000 characters' };
  }
  // Validate the file envelope up front (cheap, fail-fast) — the actual R2
  // upload waits until AFTER every membership/accept-gate check passes so we
  // never upload bytes for a message that would be rejected anyway.
  if (hasAttachment) {
    const file = input.attachment as File;
    const mime = file.type || '';
    if (!CHAT_ATTACHMENT_MIME_SET.has(mime)) {
      return {
        ok: false,
        code: 'attachment_invalid',
        message: 'That file type isn’t supported — attach an image, PDF, or a common document.',
      };
    }
    if (file.size > CHAT_ATTACHMENT_MAX_BYTES) {
      return {
        ok: false,
        code: 'attachment_invalid',
        message: 'That file is too large — attachments are capped at 25 MB.',
      };
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, code: 'unauthenticated', message: 'Sign in again to send this message.' };
  }

  const thread = await fetchThreadById(supabase, input.threadId);
  if (!thread) {
    return { ok: false, code: 'thread_not_found', message: 'Thread not found' };
  }

  // Determine the user's role on this thread.
  const [coupleCheck, vendorCheck] = await Promise.all([
    supabase
      .from('event_members')
      .select('event_id')
      .eq('event_id', thread.event_id)
      .eq('user_id', user.id)
      .eq('member_type', 'couple')
      .maybeSingle(),
    supabase
      .from('vendor_profiles')
      .select('vendor_profile_id')
      .eq('vendor_profile_id', thread.vendor_profile_id)
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  let senderRole: 'couple' | 'vendor';
  if (coupleCheck.data) {
    senderRole = 'couple';
  } else if (vendorCheck.data) {
    senderRole = 'vendor';
  } else {
    return { ok: false, code: 'not_member', message: 'Not a member of this thread' };
  }

  // Iteration 0028 follow-up — count existing messages on this thread so we
  // can distinguish the FIRST couple-to-vendor message (a booking inquiry)
  // from a subsequent reply in an ongoing conversation. The count runs via
  // the admin client below; here we just record whether the recipient should
  // see a "new inquiry" alert instead of the generic "new message" one.
  const admin = createAdminClient();
  let isFirstMessage = false;
  // Existing message count on this thread BEFORE this insert. While the thread
  // is pending only the couple can post (the vendor is accept-gated below), so
  // this count == the number of couple messages so far. Used both for the
  // "first message = inquiry" notification swap AND the one-follow-up gate.
  let priorMessageCount = 0;
  if (senderRole === 'couple') {
    const { count } = await admin
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('thread_id', thread.thread_id);
    priorMessageCount = count ?? 0;
    isFirstMessage = priorMessageCount === 0;
  }

  // Accept-gate (CLAUDE.md 2026-06-02) — a couple→vendor chat only opens both
  // ways once the vendor accepts. The couple may post their FIRST message (the
  // inquiry) into a pending thread, PLUS exactly ONE follow-up nudge while they
  // wait (inquiry-followthrough 2026-06-16) — so the couple can add a detail or
  // gently bump a quiet vendor without forcing the chat open. Everything after
  // that waits for acceptance. The vendor still cannot post until they have
  // accepted (accept-gate semantics unchanged). Defense-in-depth — the UI hides
  // the composer past the follow-up; this also guards the no-JS form path.
  if (senderRole === 'couple') {
    if (thread.inquiry_status === 'declined') {
      return {
        ok: false,
        code: 'declined',
        message: 'This vendor declined the inquiry — browse similar vendors instead.',
      };
    }
    // Allow the inquiry (priorMessageCount 0) and ONE follow-up (count 1).
    // A second follow-up (count ≥ 2) re-disables until the vendor accepts.
    if (thread.inquiry_status === 'pending' && priorMessageCount >= 2) {
      return {
        ok: false,
        code: 'followup_used',
        message:
          'You’ve sent a follow-up — waiting for the vendor to accept before you can keep chatting.',
      };
    }
  } else if (thread.inquiry_status !== 'accepted') {
    return { ok: false, code: 'not_accepted', message: 'Accept the inquiry first to reply.' };
  }

  // Tier gate (Phase C #4). FREE vendors cannot message couples in-app
  // (tierCaps.chat === 'none'); verified/pro/enterprise pass. The DB RPC
  // `unlock_vendor_event` (migration 20260911000000:66-67) already raises
  // TIER_FREE_NO_INAPP on the normal accept path, but `adminAcceptInquiry`
  // (admin/demo-vendors/inquiries/actions.ts) sets inquiry_status='accepted'
  // via the service-role client WITHOUT that RPC — so a claimed demo FREE
  // vendor could otherwise reach this insert. This closes that hole.
  // tier_state is excluded from FULL_VENDOR_PROFILE_SELECT → isolated probe
  // (matches the branches/actions.ts soft-probe convention).
  if (senderRole === 'vendor') {
    let tier: string | null = null;
    try {
      const { data: tierRow } = await supabase
        .from('vendor_profiles')
        .select('tier_state')
        .eq('vendor_profile_id', thread.vendor_profile_id)
        .maybeSingle();
      tier = (tierRow as { tier_state?: string } | null)?.tier_state ?? null;
    } catch {
      tier = null;
    }
    if (tierCaps(tier).chat === 'none') {
      return {
        ok: false,
        code: 'tier_free',
        message: 'Get your account verified to message couples in the app.',
      };
    }
  }

  // All gates passed — NOW upload the attachment (if any) to R2. Public URL is
  // acceptable for v1 (matches the vendor-handover proof-image precedent);
  // signed-URL access control is a tracked follow-up. On any upload failure we
  // return a graceful result (never throw) so the caller can surface it.
  let attachment: ResolvedAttachment | null = null;
  if (hasAttachment) {
    const file = input.attachment as File;
    const up = await uploadPublicAsset({
      pathPrefix: `chat/${thread.thread_id}`,
      file,
      allowedMime: CHAT_ATTACHMENT_MIME,
      maxBytes: CHAT_ATTACHMENT_MAX_BYTES,
    });
    if (!up.ok) {
      console.error('[sendChatMessageCore] attachment upload failed:', up.error);
      return {
        ok: false,
        code: 'attachment_failed',
        message: 'Couldn’t upload your file. Please try again.',
      };
    }
    attachment = {
      attachment_url: up.publicUrl,
      attachment_name: file.name.slice(0, 255),
      attachment_mime: file.type,
      attachment_size_bytes: file.size,
    };
  }

  const { error } = await supabase.from('chat_messages').insert({
    thread_id: thread.thread_id,
    event_id: thread.event_id,
    vendor_profile_id: thread.vendor_profile_id,
    sender_user_id: user.id,
    sender_role: senderRole,
    body: trimmed,
    ...(attachment ?? {}),
  });
  if (error) {
    // Never surface raw Postgres/PostgREST text to the client (constraint/RLS
    // internals). Log it server-side for observability; return friendly copy.
    console.error('[sendChatMessageCore] message insert failed:', error.message);
    return { ok: false, code: 'insert_failed', message: 'Couldn’t send your message. Please try again.' };
  }

  // vendor_first_reply_at — stamp the thread when the vendor sends their first
  // message. The DB trigger `stamp_vendor_first_reply` (migration 20270110320018)
  // does this atomically on every chat_messages INSERT where sender_role='vendor'
  // and the thread's vendor_first_reply_at IS NULL, so this application-level
  // path is defense-in-depth only. It is intentionally a best-effort UPDATE
  // that never blocks the send — if the column doesn't exist yet (pre-migration)
  // or the RLS policy denies the write, we log and continue.
  if (senderRole === 'vendor' && !thread.vendor_first_reply_at) {
    const adminForStamp = createAdminClient();
    const { error: stampErr } = await adminForStamp
      .from('chat_threads')
      .update({ vendor_first_reply_at: new Date().toISOString() })
      .eq('thread_id', thread.thread_id)
      .is('vendor_first_reply_at', null); // idempotent: only stamps first reply
    if (stampErr) {
      // Non-fatal — DB trigger covers this path. Log for observability.
      console.warn('[sendChatMessageCore] vendor_first_reply_at stamp skipped:', stampErr.message);
    }

    // The vendor's FIRST reply just landed — this is the exact moment
    // avg_response_minutes / response_rate_pct become (re)computable. Refresh
    // vendor_activity_stats off the request path (cron-free per the no-pollers
    // lock; after() runs post-response). Fire-and-forget: the wrapper swallows
    // its own errors so a stale stat never blocks the send.
    after(() => triggerVendorActivityRecompute(thread.vendor_profile_id));
  }

  // Phase B (fake-inquiry protection): a genuine couple reply on an ACCEPTED
  // thread is the "two-way contact" signal that consumes the vendor's token hold
  // (the hold placed at accept becomes a real charge). Fakes never reach here —
  // they never reply — so their hold is instead auto-released by the sweep. The
  // thread status read here predates this message (the couple's inquiry + one
  // follow-up land while 'pending'; only post-accept replies are 'accepted').
  // Off the request path, idempotent, dormant unless the flag is on.
  if (senderRole === 'couple' && thread.inquiry_status === 'accepted' && leadTokenHoldEnabled()) {
    after(() => consumeLeadHoldOnCoupleReply(thread.vendor_profile_id, thread.event_id));
  }

  // Notify the OTHER party. The couple side notifies the vendor user;
  // the vendor side notifies every couple member on the event. Use the
  // admin client so the lookup bypasses RLS without leaking auth scope.
  await notifyOtherParty({
    threadId: thread.thread_id,
    eventId: thread.event_id,
    vendorProfileId: thread.vendor_profile_id,
    senderRole,
    senderUserId: user.id,
    // Attachment-only messages have no text — give the notification a sensible
    // preview instead of an empty string.
    body: trimmed || (attachment ? '📎 Sent an attachment' : ''),
    isFirstMessage,
  });

  return { ok: true };
}
