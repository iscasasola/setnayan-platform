/**
 * 🧾 THE QUOTE, WHERE THE ONE INQUIRE CAN READ IT (v16 S3). The services in the couple's quote, in the order picked —
 * kept in this page's memory only (prototype `ST.svc`; nothing saved, nothing sent). `ServicesGallery` writes it; the
 * shop's ONE Inquire pop-up (inquire-sheet.tsx) reads it when its button names no card, so the page's one Inquire —
 * the same element that floats on a phone — opens with the quote picked (v16 `inquire()`), never a second Inquire.
 */
let quote: readonly string[] = [];

export function setShopQuote(ids: readonly string[]): void {
  quote = [...ids];
}

export function shopQuote(): readonly string[] {
  return quote;
}
