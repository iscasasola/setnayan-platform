/**
 * 🏷 THE BROWSER-PRINT PAGES CARRY SETNAYAN TOO — owner 2026-10-22, "Yes to all" to the controller's recommendation
 * after #6766 (`PRINT_BRAND_WORDS`, lib/print-layout.ts) put the line on every PDF but left the print-dialog HTML pages
 * of the seating pack and the caterer counts plain.
 *
 * A per-page footer does not repeat reliably in a browser's print, so the HTML pages carry ONE quiet line at the END OF
 * EACH SECTION instead: the same words, the same small caps (upper case, tracked open), the same neutral grey, at the
 * same 6 pt as the free PDF line. It is never inside a table row, a cut line or a place card — it closes its section.
 *
 * The pages that carry it (held by `lib/every-html-print-carries-setnayan.test.ts`):
 *   · the seating pack — the cover/directory, every table sign, the place-card sheet (`seating/print/pack-html.ts`);
 *   · the caterer meal counts (`seating/caterer/counts-html.ts`);
 *   · the tea-ceremony serving order (`guests/tea-ceremony/page.tsx`, via `components/print-brand-line.tsx`), print only.
 */
import { PRINT_BRAND_GREY, PRINT_BRAND_WORDS } from '@/lib/print-brand-words';

export { PRINT_BRAND_WORDS };

/** The class every HTML print brand line wears — the guard counts it. */
export const PRINT_HTML_BRAND_CLASS = 'print-brand';

/** The free PDF line's type, in CSS: 6 pt (`PRINT_MIN_BODY_PT`, the guard holds them equal), upper case, tracked 0.14 em,
 *  neutral grey, the house sans. */
export const PRINT_HTML_BRAND_STYLE = {
  fontFamily: "-apple-system, system-ui, 'Helvetica Neue', Arial, sans-serif",
  fontSize: '6pt',
  lineHeight: 1.4,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: PRINT_BRAND_GREY,
  textAlign: 'center',
  fontStyle: 'normal',
  fontWeight: 400,
} as const;

/** The same style as a CSS rule, for the string-built print pages. */
export const PRINT_HTML_BRAND_CSS = `.${PRINT_HTML_BRAND_CLASS} { font-family: ${PRINT_HTML_BRAND_STYLE.fontFamily}; font-size: ${PRINT_HTML_BRAND_STYLE.fontSize};
    line-height: ${PRINT_HTML_BRAND_STYLE.lineHeight}; letter-spacing: ${PRINT_HTML_BRAND_STYLE.letterSpacing}; text-transform: ${PRINT_HTML_BRAND_STYLE.textTransform};
    color: ${PRINT_HTML_BRAND_STYLE.color}; text-align: ${PRINT_HTML_BRAND_STYLE.textAlign}; font-style: normal; font-weight: 400; margin: 18px 0 0;
    break-inside: avoid; page-break-inside: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; }`;

/** The one line, as HTML — the last child of its section. */
export function printBrandHtml(): string {
  return `<p class="${PRINT_HTML_BRAND_CLASS}">${PRINT_BRAND_WORDS}</p>`;
}
