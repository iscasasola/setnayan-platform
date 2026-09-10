import { after } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { uploadPublicAsset } from '@/lib/storage';
import { encodeR2Ref } from '@/lib/uploads';
import {
  CHAT_ATTACHMENT_MIME,
  CHAT_ATTACHMENT_MAX_BYTES,
  chatAttachmentLimit,
} from '@/lib/chat-attachment-limits';
import { R2_BUCKETS, type R2BucketName } from '@/lib/r2';
import { triggerVendorActivityRecompute } from '@/lib/vendor-activity';
import { vendorAutoReplyEnabled } from '@/lib/vendor-autoreply-flag';
import { runVendorAutoReply } from '@/lib/vendor-autoreply/inbox-hook';
import { chatContactFilterEnabled } from '@/lib/chat-contact-filter-flag';
import { evaluateMessage, CONTACT_BLOCK_MESSAGE } from '@/lib/chat-contact-filter';
import { fetchThreadById, countCoupleMessages } from './chat';
import { notifyOtherParty } from './chat-actions';

/**
 * The allowlist and the size ceilings now live in `lib/chat-attachment-limits.ts`
 * — pure and client-safe — because the composer used to keep its own hand-typed
 * copy of both, under a comment admitting it. Re-exported here so every
 * existing importer of this module is unchanged.
 */
export {
  CHAT_ATTACHMENT_MIME,
  CHAT_ATTACHMENT_MAX_BYTES,
} from '@/lib/chat-attachment-limits';

const CHAT_ATTACHMENT_MIME_SET = new Set<string>(CHAT_ATTACHMENT_MIME);

/**
 * The word the database puts in its refusal when a message carries contact
 * details (tg_chat_messages_guard_end_user_write, migration 20271221089848).
 * tests/db/the-chat-cannot-leave-the-app.db.test.ts proves the database's
 * refusal really contains it.
 */
const CHAT_CONTACT_REFUSAL_MARKER = 'CONTACT_BLOCKED';

/** Is this an R2 bucket, or the local dev fallback? See the note at the ref. */
function isR2Bucket(bucket: string): bucket is R2BucketName {
  return (Object.values(R2_BUCKETS) as string[]).includes(bucket);
}

/** Resolved attachment metadata written onto the inserted chat_messages row. */
type ResolvedAttachment = {
  attachment_r2_key: string;
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
  | 'contact_blocked'
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
    // The ceiling depends on WHAT was sent — a photo is compressed in the
    // browser first, a document never is. One resolver, so the picker, the
    // composer and this check cannot judge a file by three different limits.
    const limit = chatAttachmentLimit(mime);
    if (file.size > limit.maxBytes) {
      return {
        ok: false,
        code: 'attachment_invalid',
        message: limit.tooLargeMessage,
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

  // Inbox ungated (owner 2026-07-24) — the former FREE-vendor tier gate here
  // (tierCaps(tier).chat === 'none' → 'tier_free') has been REMOVED so a vendor
  // on ANY tier, verified or not, can answer a couple in-app once the thread is
  // accepted ("your inbox is never locked"). The parallel accept-side gate
  // (unlock_vendor_event's TIER_FREE_NO_INAPP raise) is bypassed by routing
  // acceptInquiry to unlock_vendor_event_free (see lib/chat-actions.ts). This is
  // purely the answering path; couple-side spam is still held back upstream by
  // the inquiry velocity caps + Turnstile (lib/inquiry-gate.ts) — untouched here.

  // Chatroom blocked-rules — off-platform-contact filter
  // (NEXT_PUBLIC_CHAT_CONTACT_FILTER_ENABLED · default OFF). Deterministic, ₱0,
  // no-LLM. When ON, a message that shares a phone number (in any disguised
  // form), an email / social link / @handle, or a blocklisted app-name /
  // euphemism / solicitation is BLOCKED here — before we upload any attachment
  // or insert anything — and the attempt is recorded (METADATA ONLY: categories
  // + hit_count + sender/context, NEVER the text, per the 2026-06-22 owner-locked
  // admin-no-chat-read invariant). Runs for BOTH couple + vendor; system/bot
  // messages never reach this core. OFF ⇒ this block is skipped entirely and the
  // send is byte-identical to before the filter existed. Attachment-only sends
  // have an empty trimmed body → evaluateMessage returns not-blocked.
  if (chatContactFilterEnabled() && trimmed.length > 0) {
    const evaluation = evaluateMessage(trimmed);
    if (evaluation.blocked) {
      // Record the blocked attempt off the request path (best-effort · never
      // throws). Service-role client so it lands regardless of the moderator-only
      // RLS; a pre-migration table miss is logged and swallowed.
      const categories = evaluation.categories;
      const hitCount = evaluation.matched.length;
      after(async () => {
        try {
          const { error: flagErr } = await admin.from('chat_message_flags').insert({
            message_id: null,
            thread_id: thread.thread_id,
            event_id: thread.event_id,
            vendor_profile_id: thread.vendor_profile_id,
            sender_user_id: user.id,
            sender_role: senderRole,
            categories,
            hit_count: hitCount,
            outcome: 'blocked',
          });
          if (flagErr) {
            console.error('[sendChatMessageCore] contact-block record failed (non-blocking):', flagErr.message);
          }
        } catch (caught) {
          console.error(
            '[sendChatMessageCore] contact-block record threw (non-blocking):',
            caught instanceof Error ? caught.message : String(caught),
          );
        }
      });
      return { ok: false, code: 'contact_blocked', message: CONTACT_BLOCK_MESSAGE };
    }
  }

  // All gates passed — NOW upload the attachment (if any) to R2. Public URL is
  // acceptable for v1 (matches the vendor-handover proof-image precedent);
  // signed-URL access control is a tracked follow-up. On any upload failure we
  // return a graceful result (never throw) so the caller can surface it.
  let attachment: ResolvedAttachment | null = null;
  if (hasAttachment) {
    const file = input.attachment as File;
    // The `chat/` prefix routes to the PRIVATE bucket — see the note on
    // ResolvedAttachment above, and the rule in lib/bucket-routing.ts. The
    // helper is still named uploadPublicAsset (it is the one server-side
    // uploader); what makes an object private is the bucket it lands in, not
    // the function that put it there.
    //
    // 🔒 PER SENDER: `chat/<thread>/<the sender's own uid>/`. The database
    // accepts an attachment from a signed-in session ONLY under that folder
    // (tg_chat_messages_guard_end_user_write, migration 20271221089848), so a
    // row can never name the other party's file — and erasure, which deletes
    // the files behind the rows a person authored, can never be pointed at
    // somebody else's. Change this prefix and every attachment is refused.
    const up = await uploadPublicAsset({
      pathPrefix: `chat/${thread.thread_id}/${user.id}`,
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
    // ⚠ THE DEV FALLBACK CANNOT CARRY A CHAT FILE ANY MORE. With no R2
    // credentials the uploader writes to Supabase Storage and hands back a
    // public URL. That used to be stored here so a local checkout could show
    // the file; the database now refuses anything but a thread-files ref
    // (a stored URL is exactly the door out it closes), so the send would fail
    // at the insert with a message nobody could act on. Say so here instead.
    // Production always has R2.
    if (!isR2Bucket(up.bucket)) {
      console.error(
        '[sendChatMessageCore] chat files need R2 — the Supabase Storage fallback URL cannot be stored on a message',
      );
      return {
        ok: false,
        code: 'attachment_failed',
        message: 'Couldn’t upload your file. Please try again.',
      };
    }
    attachment = {
      // The REF, never the URL. `up.publicUrl` still resolves for a public
      // bucket and would look completely fine here — storing it is exactly the
      // defect being fixed, so it is deliberately unused.
      attachment_r2_key: encodeR2Ref(up.bucket, up.key),
      attachment_name: file.name.slice(0, 255),
      attachment_mime: file.type,
      attachment_size_bytes: file.size,
    };
  }

  // sender_user_id / sender_role are NOT sent. This insert runs under the
  // caller's own RLS-scoped session, and `authenticated` holds no INSERT
  // privilege on either column — naming one is a hard permission failure, not
  // a silent ignore. The database derives both from auth.uid() in
  // tg_chat_messages_derive_sender (migration 20271132839561), which resolves
  // membership with the same three branches `senderRole` was derived from
  // above. `senderRole` is still computed here because the gates below it —
  // the accept-gate, the couple follow-up rule, the notify fan-out — all
  // branch on it; it just no longer decides what lands in the row.
  const { error } = await supabase.from('chat_messages').insert({
    thread_id: thread.thread_id,
    event_id: thread.event_id,
    vendor_profile_id: thread.vendor_profile_id,
    body: trimmed,
    ...(attachment ?? {}),
  });
  if (error) {
    // The database screens the text with the same rules as the check above
    // (migration 20271221089848) and refuses with this marker. It fires here
    // only when the app-side check is switched off — so the sender still gets
    // the words that tell them what to change, not "try again".
    if (error.message.includes(CHAT_CONTACT_REFUSAL_MARKER)) {
      return { ok: false, code: 'contact_blocked', message: CONTACT_BLOCK_MESSAGE };
    }
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
    // Attachment-only messages have no text — give the notification a sensible
    // preview instead of an empty string. (A message that reaches this point has
    // already passed the contact filter, so trimmed is safe to preview.)
    body: trimmed || (attachment ? '📎 Sent an attachment' : ''),
    isFirstMessage,
  });

  return { ok: true };
}
