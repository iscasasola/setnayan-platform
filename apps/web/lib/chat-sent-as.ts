/**
 * 🏪 THE SCREEN DECIDES WHICH SIDE A MESSAGE SPEAKS FOR (owner, 11 Nov 2026 — live fault).
 *
 * One login can own a shop AND host the event that shop serves. The database used to derive the side from the uid
 * alone, couple first, so a "Hello" typed in the SHOP's chat landed as the host ("it's just me messaging myself").
 * Now the supplier's composer says which side it belongs to: a hidden `sent_as=vendor` field on the form, carried to
 * `sendChatMessageCore` as `asSide`, inserted as `chat_messages.sent_as`. The database honours it ONLY when the
 * sender truly stands on the shop side (`tg_chat_messages_derive_sender`, migration 20271338442002) — it chooses
 * between sides the person already holds, it can never mint one.
 *
 * The host's screens send nothing: no field = the derivation as before (couple first), which is already right there,
 * and keeps a coordinator posting from the host's side working. PURE — no I/O.
 *
 * 🔒 lib/one-person-on-both-sides-speaks-for-the-screen.test.ts
 */
export const CHAT_SENT_AS_FIELD = 'sent_as';

export type ChatSentAs = 'vendor';

/** The side a form asked for — only `'vendor'` is a request; anything else is "no side asked". */
export function sentAsFromForm(raw: FormDataEntryValue | null | undefined): ChatSentAs | null {
  return raw === 'vendor' ? 'vendor' : null;
}
