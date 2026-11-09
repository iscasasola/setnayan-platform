/**
 * 🔒 "₱ — hosts only" — the one mask a coordinator without Budget & payments reads for every amount (owner FINAL
 * RULINGS 2026-11-09). The SQL twin is `public.chat_mask_pesos()` (migration 20271333348826): the SAME two patterns —
 * a ₱ figure, and a "PHP" figure — so a line masked on the server and a line masked here read the same.
 * Tiny on purpose: the chat stream imports it.
 */
export const HOSTS_ONLY = '₱ — hosts only';

/** Every peso figure in a line → "₱ — hosts only". */
export function maskPesos(text: string): string {
  return text.replace(/₱\s?-?\d[\d,]*(?:\.\d+)?/g, HOSTS_ONLY).replace(/\bPHP\s?-?\d[\d,]*(?:\.\d+)?/gi, HOSTS_ONLY);
}
