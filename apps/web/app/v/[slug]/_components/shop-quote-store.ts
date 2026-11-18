/**
 * 🧾 THE QUOTE, WHERE THE ONE INQUIRE CAN READ IT (v16 S3). The services in the couple's quote, in the order picked —
 * kept in this page's memory only (prototype `ST.svc`; nothing saved, nothing sent). `ServicesGallery` writes it; the
 * shop's ONE Inquire pop-up (inquire-sheet.tsx) reads it when its button names no card, so the page's one Inquire —
 * the same element that floats on a phone — opens with the quote picked (v16 `inquire()`), never a second Inquire.
 */
let quote: readonly string[] = [];
/**
 * v16 S4: the quote's summary ("2 services · from ₱45,000" + the names), so the desktop SIDE CARD can show it beside
 * the page — a subscription (`useSyncExternalStore`), never a second copy of the quote's state.
 */
let summary: { head: string; names: string } | null = null;
const listeners = new Set<() => void>();

export function setShopQuote(ids: readonly string[], sum: { head: string; names: string } | null = null): void {
  quote = [...ids];
  summary = sum;
  listeners.forEach((l) => l());
}

export function subscribeShopQuote(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function shopQuoteSummary(): { head: string; names: string } | null {
  return summary;
}

export function shopQuote(): readonly string[] {
  return quote;
}
