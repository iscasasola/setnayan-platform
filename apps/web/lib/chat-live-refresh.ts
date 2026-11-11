/**
 * A PAYMENT SHOWS IN THE OTHER SIDE'S OPEN CHAT AT ONCE (chat gaps, owner 8 Nov 2026).
 *
 * ── WHAT WAS TRUE BEFORE ─────────────────────────────────────────────────────
 * Payments are not chat messages. The money step under the accepted quote, the couple's Pay button, the supplier's
 * "Confirm it reached you" and the payment pins are all drawn by the SERVER (`readBookedMoney`, `readChatPinFacts`) and
 * handed to `ChatMessageStream` as props — read once. So when the supplier asked for a payment, or confirmed one, the
 * couple's open chat showed none of it until a reload (and the other way round).
 *
 * ── THE FIX — no new socket ──────────────────────────────────────────────────
 * Every money change already writes a Setnayan line into the thread: `event_vendor_payments_chat_record` (logged ·
 * confirmed · not received · proof added — migration 20271329937802), `event_vendors_chat_record` (booking states),
 * and now a payment ASK too (`askForPaymentCore` → `postThreadSystemLine`). That line already arrives live on the
 * stream's existing `chat-${threadId}` channel. The stream reads the arrival with {@link refreshesTheChat} and, for a
 * Setnayan line, asks the page ONCE (debounced {@link LIVE_LINE_REFRESH_MS}) for a fresh draw — `router.refresh()`,
 * which keeps every piece of client state (the composer, the scroll, the stream's own messages).
 *
 * Only a line nobody wrote (sender_role 'system') refreshes: a person's words change nothing the server drew.
 */

export const LIVE_LINE_REFRESH_MS = 700;

export function refreshesTheChat(m: { sender_role: string; sender_user_id?: string | null }): boolean {
  return m.sender_role === 'system';
}
