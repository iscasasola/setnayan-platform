import { PRINT_BRAND_WORDS, PRINT_HTML_BRAND_CLASS, PRINT_HTML_BRAND_STYLE } from '@/lib/print-html-brand';

/**
 * 🏷 The "Made with Setnayan · setnayan.com" line for a dashboard page the couple prints from the browser dialog
 * (owner 2026-10-22; lib/print-html-brand.ts). `printOnly` keeps the screen as it was — the app already says Setnayan
 * there — and puts the line on the paper only. Always the LAST thing in its section.
 */
export function PrintBrandLine({ printOnly = false }: { printOnly?: boolean }) {
  return (
    <p className={printOnly ? `${PRINT_HTML_BRAND_CLASS} hidden print:block` : PRINT_HTML_BRAND_CLASS} style={{ ...PRINT_HTML_BRAND_STYLE, marginTop: 24 }}>
      {PRINT_BRAND_WORDS}
    </p>
  );
}
