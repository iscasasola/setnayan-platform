/**
 * Chatroom blocked-rules (off-platform-contact filter) — feature flag.
 *
 * Gates the block-and-record behaviour: when ON, a couple/vendor chat message
 * that trips a rule (a phone number in any disguised form, an email / social
 * link / @handle, or a blocklisted app-name / euphemism / solicitation) is
 * BLOCKED (never sent) and the attempt is recorded (metadata only) to the
 * /admin/chat-flags queue. When OFF (the default), the send path is byte-
 * identical to before the filter existed.
 *
 * NEXT_PUBLIC_ so BOTH the server (the authoritative send gate + native
 * endpoint) and the client (the composer's instant pre-send block) read one
 * value. Only the exact truthy strings enable it — anything else (including a
 * missing var) is OFF, so the feature ships dark and the owner flips it on.
 */
export function chatContactFilterEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_CHAT_CONTACT_FILTER_ENABLED;
  return v === 'true' || v === '1' || v === 'TRUE';
}
