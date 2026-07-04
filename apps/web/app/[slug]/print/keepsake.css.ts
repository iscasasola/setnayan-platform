// ============================================================================
// A3 broadsheet print keepsake — the print stylesheet (string constant)
// ============================================================================
//
// Injected once via a <style> tag on the print route. Deliberately hand-written
// CSS (not Tailwind) because the whole point is print media: `@page` sizing,
// pt/mm typographic units scaled for A3 (297×420mm portrait), and
// print-color-adjust. The design language (Cormorant `--font-display`, DM Mono
// `--font-mono`, cream/ink/terracotta) reuses the app's next/font CSS variables
// and colour tokens so the sheet matches the on-screen editorial exactly.
//
// Type scale (A3 is BIG — deliberately scaled up):
//   nameplate  ~72pt · headline ~44pt · deck ~19pt · body ~11pt (2 cols)
//   mono labels ~8pt (never below 7pt). All in pt/mm so it prints true-to-size.
//   (These are print pt sizes — the guest-legibility linter only scans
//   `text-[Npx]` Tailwind classes, which this file never uses.)
// ============================================================================

// Safe inner margin (~11mm): consumer printers can't truly full-bleed, so the
// design reads full-page while staying inside the printable area.
const SAFE_MARGIN_MM = 11;

export const KEEPSAKE_CSS = `
/* ── colour + font tokens ─────────────────────────────────────────────────
   The palette is PINNED to the light (paper) values — a keepsake is ink-on-cream
   whether it's viewed in dark mode or printed. We override the app's RGB channel
   tokens on the root so every downstream rgb(var(--color-*)/alpha) in this
   stylesheet (rules, scrims, dotted borders) resolves to the paper palette,
   never the viewer's dark theme. Fonts reuse the app's next/font CSS vars so the
   sheet matches the on-screen editorial's Cormorant / DM Mono exactly. */
.keepsake-root {
  --color-cream: 251 251 250;     /* Warm Alabaster #FBFBFA */
  --color-ink: 30 34 41;          /* Deep Obsidian  #1E2229 */
  --color-terracotta: 197 160 89; /* Champagne Gold #C5A059 */
  --color-mulberry: 92 37 66;     /* Rich Mulberry  #5C2542 */
  --k-cream: rgb(var(--color-cream));
  --k-ink: rgb(var(--color-ink));
  --k-accent: rgb(var(--color-terracotta));
  --k-mulberry: rgb(var(--color-mulberry));
  --k-display: var(--font-display), 'Cormorant Garamond', ui-serif, Georgia, serif;
  --k-mono: var(--font-mono), 'DM Mono', ui-monospace, SFMono-Regular, monospace;
  color: var(--k-ink);
}

/* ── screen presentation: sheet centered on a grey ground ─────────────────── */
.keepsake-root {
  min-height: 100dvh;
  background: #4a4a48;
  padding: 24px 16px 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.keepsake-toolbar {
  position: sticky;
  top: 12px;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: min(210mm, 100%);
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(250, 247, 242, 0.96);
  box-shadow: 0 8px 30px -12px rgba(0, 0, 0, 0.6);
  font-family: var(--k-mono);
  font-size: 13px;
  color: var(--k-ink);
}
.keepsake-toolbar-link,
.keepsake-toolbar-print {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  color: var(--k-ink);
  text-decoration: none;
}
.keepsake-toolbar-actions {
  display: inline-flex;
  align-items: center;
  gap: 16px;
}
.keepsake-toolbar-hint {
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(var(--color-ink), 0.55);
}
.keepsake-toolbar-print {
  cursor: pointer;
  border: 1px solid var(--k-ink);
  border-radius: 8px;
  padding: 6px 12px;
  background: var(--k-ink);
  color: var(--k-cream);
  font-family: var(--k-mono);
  letter-spacing: 0.04em;
}
.keepsake-toolbar-print:hover { opacity: 0.9; }

/* ── the A3 sheet ─────────────────────────────────────────────────────────── */
.keepsake-sheet {
  box-sizing: border-box;
  width: 210mm;              /* screen preview width (A4-ish) — scales to A3 in print */
  max-width: 100%;
  aspect-ratio: 210 / 297;   /* portrait proportion on screen */
  background: var(--k-cream);
  color: var(--k-ink);
  padding: ${SAFE_MARGIN_MM}mm;
  box-shadow: 0 24px 60px -20px rgba(0, 0, 0, 0.7);
  overflow: hidden;
  font-family: var(--k-display);
  line-height: 1.3;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* ── masthead ─────────────────────────────────────────────────────────────── */
.k-rule-double { border-top: 3px double var(--k-ink); }
.k-rule-thick { border-top: 3px solid var(--k-ink); }
.k-rule-thin { border-top: 1px solid rgba(var(--color-ink), 0.8); }

.k-masthead { text-align: center; padding: 4mm 0 3mm; }
.k-mono-eyebrow {
  font-family: var(--k-mono);
  text-transform: uppercase;
  letter-spacing: 0.34em;
  font-size: 8pt;
  color: var(--k-accent);
  margin: 3mm 0 0;
}
.k-nameplate {
  font-family: var(--k-display);
  font-weight: 600;
  font-size: 72pt;
  line-height: 0.94;
  letter-spacing: -0.01em;
  text-wrap: balance;
  margin: 2mm 0 0;
}
.k-monogram { display: flex; justify-content: center; margin-bottom: 1mm; }

.k-dateline {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8mm;
  font-family: var(--k-mono);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 8.5pt;
  color: rgba(var(--color-ink), 0.68);
  padding: 2mm 0;
}
.k-dateline .k-dateline-center { letter-spacing: 0.16em; }

/* ── headline + deck ──────────────────────────────────────────────────────── */
.k-headline-block { text-align: center; padding: 4mm 0 3mm; }
.k-super {
  font-family: var(--k-mono);
  text-transform: uppercase;
  letter-spacing: 0.3em;
  font-size: 8pt;
  color: var(--k-mulberry);
  margin: 0;
}
.k-headline {
  font-family: var(--k-display);
  font-weight: 700;
  font-size: 44pt;
  line-height: 0.96;
  letter-spacing: -0.01em;
  text-wrap: balance;
  margin: 2.5mm auto 0;
  max-width: 165mm;
}
.k-deck {
  font-family: var(--k-display);
  font-style: italic;
  font-size: 19pt;
  line-height: 1.15;
  color: rgba(var(--color-ink), 0.72);
  margin: 2.5mm auto 0;
  max-width: 150mm;
  text-wrap: balance;
}
.k-byline {
  font-family: var(--k-mono);
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 8pt;
  color: rgba(var(--color-ink), 0.45);
  margin: 3mm 0 0;
}

/* ── hero photo ───────────────────────────────────────────────────────────── */
.k-hero {
  position: relative;
  margin: 3mm 0 0;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: rgba(var(--color-ink), 0.1);
}
.k-hero img { width: 100%; height: 100%; object-fit: cover; display: block; }
.k-hero figcaption {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  padding: 6mm 4mm 2mm;
  background: linear-gradient(to top, rgba(var(--color-ink), 0.7), transparent);
  font-family: var(--k-mono);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 7.5pt;
  color: var(--k-cream);
}

/* ── lead article (2-col) + drop cap ──────────────────────────────────────── */
.k-lead {
  margin: 4mm 0 0;
  columns: 2;
  column-gap: 9mm;
  text-align: justify;
  font-family: var(--k-display);
  font-size: 11pt;
  line-height: 1.42;
  column-rule: 1px solid rgba(var(--color-ink), 0.12);
}
.k-lead p { margin: 0 0 2.5mm; }
.k-lead .k-dropcap::first-letter {
  float: left;
  margin: 1mm 2mm 0 0;
  font-family: var(--k-display);
  font-weight: 700;
  font-size: 40pt;
  line-height: 0.7;
  color: var(--k-mulberry);
}
.k-pullquote {
  break-inside: avoid;
  margin: 2mm 0;
  padding: 3mm 0;
  border-top: 2px solid var(--k-ink);
  border-bottom: 1px solid rgba(var(--color-ink), 0.15);
  font-family: var(--k-display);
  font-weight: 500;
  font-style: italic;
  font-size: 14pt;
  line-height: 1.15;
}

/* ── section rules ────────────────────────────────────────────────────────── */
.k-section { margin-top: 5mm; break-inside: avoid; }
.k-section-rule {
  display: flex;
  align-items: center;
  gap: 4mm;
  margin: 5mm 0 3mm;
}
.k-section-rule::before,
.k-section-rule::after {
  content: '';
  flex: 1;
  border-top: 1px solid rgba(var(--color-ink), 0.35);
}
.k-section-title {
  font-family: var(--k-mono);
  text-transform: uppercase;
  letter-spacing: 0.22em;
  font-size: 9pt;
  color: var(--k-ink);
}
.k-section-note {
  text-align: center;
  font-family: var(--k-mono);
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 7.5pt;
  color: rgba(var(--color-ink), 0.45);
  margin: -1mm 0 3mm;
}

/* ── chapters (compact grid) ──────────────────────────────────────────────── */
.k-chapters {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3mm;
}
.k-chapter { break-inside: avoid; }
.k-chapter-media {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 5;
  overflow: hidden;
  background: rgba(var(--color-ink), 0.1);
}
.k-chapter-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
.k-chapter-clipcap {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  padding: 4mm 1.5mm 1.2mm;
  background: linear-gradient(to top, rgba(var(--color-ink), 0.72), transparent);
  font-family: var(--k-mono);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 7pt;
  color: var(--k-cream);
}
.k-chapter-time {
  font-family: var(--k-mono);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 7.5pt;
  color: var(--k-accent);
  margin: 1.5mm 0 0;
}
.k-chapter-title {
  font-family: var(--k-display);
  font-weight: 600;
  font-style: italic;
  font-size: 12pt;
  line-height: 1.05;
  margin: 0.5mm 0 0;
}
.k-chapter-writeup {
  font-family: var(--k-display);
  font-size: 9.5pt;
  line-height: 1.32;
  color: rgba(var(--color-ink), 0.78);
  margin: 1mm 0 0;
}

/* ── two-up columns for kwento / credits on the back ──────────────────────── */
.k-cols-2 { columns: 2; column-gap: 9mm; }
.k-quote {
  break-inside: avoid;
  margin: 0 0 3.5mm;
  padding-left: 4mm;
  border-left: 2px solid rgba(var(--color-terracotta), 0.4);
}
.k-quote-body {
  font-family: var(--k-display);
  font-style: italic;
  font-size: 12pt;
  line-height: 1.25;
  color: rgba(var(--color-ink), 0.85);
  margin: 0;
}
.k-quote-author {
  font-family: var(--k-mono);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 7.5pt;
  color: rgba(var(--color-ink), 0.5);
  margin: 1.5mm 0 0;
}

/* ── vendor credit ledger ─────────────────────────────────────────────────── */
.k-credits { columns: 2; column-gap: 9mm; list-style: none; margin: 0; padding: 0; }
.k-credit {
  break-inside: avoid;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 3mm;
  padding: 1.4mm 0;
  border-bottom: 1px dotted rgba(var(--color-ink), 0.18);
}
.k-credit-name {
  font-family: var(--k-display);
  font-weight: 600;
  font-size: 10.5pt;
}
.k-credit-cat {
  font-family: var(--k-mono);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 7.5pt;
  color: rgba(var(--color-ink), 0.5);
  text-align: right;
  white-space: nowrap;
}

/* ── services strip ───────────────────────────────────────────────────────── */
.k-services {
  display: flex;
  flex-wrap: wrap;
  gap: 2mm 3mm;
  justify-content: center;
}
.k-service-chip {
  font-family: var(--k-mono);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 8pt;
  color: var(--k-ink);
  border: 1px solid rgba(var(--color-terracotta), 0.5);
  border-radius: 999px;
  padding: 1.2mm 3mm;
}

/* ── from the couple / their song ─────────────────────────────────────────── */
.k-couple-quote {
  max-width: 150mm;
  margin: 3mm auto 0;
  text-align: center;
  border-top: 2px solid var(--k-ink);
  border-bottom: 2px solid var(--k-ink);
  padding: 4mm 2mm;
}
.k-couple-quote p {
  font-family: var(--k-display);
  font-style: italic;
  font-weight: 500;
  font-size: 16pt;
  line-height: 1.2;
  margin: 0;
}
.k-couple-quote footer {
  font-family: var(--k-mono);
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 8pt;
  color: rgba(var(--color-ink), 0.45);
  margin: 2.5mm 0 0;
}
.k-song {
  text-align: center;
  max-width: 150mm;
  margin: 3mm auto 0;
}
.k-song-title {
  font-family: var(--k-display);
  font-style: italic;
  font-size: 16pt;
  color: rgba(var(--color-ink), 0.8);
  margin: 0;
}
.k-song-credit {
  font-family: var(--k-mono);
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 7.5pt;
  color: rgba(var(--color-ink), 0.45);
  margin: 1.5mm 0 0;
}

/* ── QR colophon (ALWAYS the last element) ────────────────────────────────── */
.k-colophon {
  margin-top: 6mm;
  border-top: 3px double var(--k-ink);
  padding-top: 4mm;
  display: flex;
  align-items: center;
  gap: 6mm;
  justify-content: center;
  text-align: left;
}
.k-colophon-qr {
  width: 30mm;
  height: 30mm;
  flex-shrink: 0;
}
.k-colophon-qr svg { width: 100%; height: 100%; display: block; }
.k-colophon-copy { max-width: 120mm; }
.k-colophon-lead {
  font-family: var(--k-display);
  font-style: italic;
  font-size: 12pt;
  line-height: 1.25;
  margin: 0;
}
.k-colophon-url {
  font-family: var(--k-mono);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 8pt;
  color: var(--k-accent);
  margin: 2mm 0 0;
}
.k-colophon-brand {
  font-family: var(--k-mono);
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 7.5pt;
  color: rgba(var(--color-ink), 0.45);
  margin: 1.5mm 0 0;
}

/* ── PRINT: A3 full page, one sheet per side, toolbar hidden ───────────────── */
@media print {
  @page {
    size: A3 portrait;
    margin: 0;
  }
  html, body { background: #fff; }
  .keepsake-toolbar { display: none !important; }
  .keepsake-root {
    background: #fff;
    padding: 0;
    gap: 0;
    display: block;
  }
  .keepsake-sheet {
    width: 297mm;
    height: 420mm;       /* full A3 page */
    aspect-ratio: auto;
    max-width: none;
    box-shadow: none;
    padding: ${SAFE_MARGIN_MM}mm;
    margin: 0;
    overflow: hidden;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .keepsake-sheet.k-has-back { page-break-after: always; break-after: page; }
  img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
