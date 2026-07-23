import { after } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { uploadPublicAsset } from '@/lib/storage';
import { tierCaps } from '@/lib/vendor-tier-caps';
import { triggerVendorActivityRecompute } from '@/lib/vendor-activity';
import { leadTokenHoldEnabled, consumeLeadHoldOnCoupleReply } from '@/lib/lead-token-holds';
import { vendorAutoReplyEnabled } from '@/lib/vendor-autoreply-flag';
import { runVendorAutoReply } from '@/lib/vendor-autoreply/inbox-hook';
import { chatContactFilterEnabled } from '@/lib/chat-contact-filter-flag';
import { scanForContactInfo } from '@/lib/chat-contact-filter';
import { fetchThreadById, countCoupleMessages } from './chat';
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
  // COUPLE-authored messages on this thread BEFORE this insert. Both consumers
  // want the SAME number: the "first message = new inquiry" notification swap
  // and the pre-accept one-follow-up gate are both about what the COUPLE has
  // said so far. (The previous unfiltered count asserted "while pending only
  // the couple can post" — that invariant is FALSE: the Vendor Auto-Reply
  // Assistant posts into a pending thread as sender_role='vendor'/is_bot, so
  // its own reply consumed one of the couple's two allowed messages. See
  // countCoupleMessages' docstring for the full reasoning.)
  let priorMessageCount = 0;
  if (senderRole === 'couple') {
    priorMessageCount = await countCoupleMessages(admin, thread.thread_id);
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

  // Off-platform-contact filter (CHAT_CONTACT_FILTER_ENABLED · default OFF).
  // Deterministic, ₱0, no-LLM. When ON, MASK the actual contact payload (phone /
  // email / social URL / @handle / app-name / euphemism / solicitation) in the
  // delivered body and record the ORIGINAL to chat_message_flags for admin
  // review. Runs for BOTH couple + vendor (system/bot messages never reach this
  // core — they insert via the service-role client elsewhere). When the flag is
  // OFF the scan never runs and finalBody === trimmed, so the send is
  // byte-identical to before the filter existed. Attachment-only sends have an
  // empty trimmed body → no scan.
  let finalBody = trimmed;
  let contactScan: ReturnType<typeof scanForContactInfo> | null = null;
  if (chatContactFilterEnabled() && trimmed.length > 0) {
    contactScan = scanForContactInfo(trimmed);
    if (contactScan.hasHit) finalBody = contactScan.masked;
  }
  const needContactFlag = contactScan?.hasHit ?? false;

  // Build the insert once; when a flag must be recorded we also read back the
  // new message_id (the flag row FKs to it). The no-flag path stays a plain
  // insert with no RETURNING, exactly as before.
  const messageInsert = supabase.from('chat_messages').insert({
    thread_id: thread.thread_id,
    event_id: thread.event_id,
    vendor_profile_id: thread.vendor_profile_id,
    sender_user_id: user.id,
    sender_role: senderRole,
    body: finalBody,
    ...(attachment ?? {}),
  });

  let insertedMessageId: string | null = null;
  if (needContactFlag) {
    const { data, error } = await messageInsert.select('message_id').maybeSingle();
    if (error) {
      console.error('[sendChatMessageCore] message insert failed:', error.message);
      return { ok: false, code: 'insert_failed', message: 'Couldn’t send your message. Please try again.' };
    }
    insertedMessageId = (data as { message_id?: string } | null)?.message_id ?? null;
  } else {
    const { error } = await messageInsert;
    if (error) {
      // Never surface raw Postgres/PostgREST text to the client (constraint/RLS
      // internals). Log it server-side for observability; return friendly copy.
      console.error('[sendChatMessageCore] message insert failed:', error.message);
      return { ok: false, code: 'insert_failed', message: 'Couldn’t send your message. Please try again.' };
    }
  }

  // Record the flag off the request path (best-effort · never blocks the send).
  // METADATA ONLY — categories + hit_count + sender/context, NEVER the message
  // text: the owner-locked admin-account-access model (2026-06-22) forbids
  // Setnayan staff from reading couple↔vendor chat bodies, so the moderator
  // queue carries only the abuse signal (what kind of contact info, by whom, how
  // often), not the conversation. Service-role client so it lands regardless of
  // the RLS on the moderator-only queue; a pre-migration table miss or any write
  // error is logged and swallowed — the message has already been delivered
  // (masked) at this point.
  if (needContactFlag && insertedMessageId && contactScan) {
    const messageId = insertedMessageId;
    const scan = contactScan;
    after(async () => {
      try {
        const { error: flagErr } = await admin.from('chat_message_flags').insert({
          message_id: messageId,
          thread_id: thread.thread_id,
          event_id: thread.event_id,
          vendor_profile_id: thread.vendor_profile_id,
          sender_user_id: user.id,
          sender_role: senderRole,
          categories: scan.categories,
          hit_count: scan.hits.length,
        });
        if (flagErr) {
          console.error('[sendChatMessageCore] contact-flag insert failed (non-blocking):', flagErr.message);
        }
      } catch (caught) {
        console.error(
          '[sendChatMessageCore] contact-flag threw (non-blocking):',
          caught instanceof Error ? caught.message : String(caught),
        );
      }
    });
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

  // Vendor Auto-Reply Assistant (Phase 3b · NEXT_PUBLIC_VENDOR_AUTOREPLY_V1,
  // default OFF): a couple message may earn an instant AI front-desk reply when
  // THIS vendor opted in via vendor_bot_config. Runs off the request path via
  // after() and is fail-closed inside runVendorAutoReply — a bot failure can
  // never block, delay, or error the human message that just landed above.
  // LOOP-GUARD: only senderRole==='couple' schedules it; the bot's own posts
  // land as sender_role='vendor' via the service-role client (not through this
  // core), so neither the bot nor the vendor can ever re-trigger it.
  if (senderRole === 'couple' && vendorAutoReplyEnabled()) {
    after(() => runVendorAutoReply({ threadId: thread.thread_id, senderRole }));
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
    // Use the MASKED body so a contact payload never leaks via the notification
    // or its email (finalBody === trimmed when the filter is off / no hit).
    // Attachment-only messages have no text — give the notification a sensible
    // preview instead of an empty string.
    body: finalBody || (attachment ? '📎 Sent an attachment' : ''),
    isFirstMessage,
  });

  return { ok: true };
}
