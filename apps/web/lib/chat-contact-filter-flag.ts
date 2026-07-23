/**
 * Off-platform-contact chat filter — feature flag.
 *
 * Gates the mask-and-flag behaviour wired into the shared send core
 * (lib/chat-send.ts → scanForContactInfo). When OFF (the default), the send path
 * is byte-identical to before the filter existed: no scan, no mask, no flag
 * write. When ON, a couple/vendor message that carries a phone / email / social
 * URL / @handle (or an app-name / euphemism / solicitation) has its payload
 * blanked in the delivered body and the original is recorded to the
 * chat_message_flags admin queue.
 *
 * NOT NEXT_PUBLIC_: the filter runs server-side only (there is no client
 * pre-send warning in V1). A plain server env keeps the value off the client
 * bundle. Only the exact truthy strings enable it — anything else (including a
 * missing var) is OFF, so the feature ships dark and the owner flips it on after
 * eyeballing the queue on a test thread.
 */
export function chatContactFilterEnabled(): boolean {
  const v = process.env.CHAT_CONTACT_FILTER_ENABLED;
  return v === 'true' || v === '1' || v === 'TRUE';
}
