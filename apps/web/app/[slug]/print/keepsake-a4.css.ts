// ============================================================================
// A4 booklet print keepsake — the print stylesheet (string constant)
// ============================================================================
//
// Sibling of keepsake.css.ts's A3 broadsheet, same design language (Cormorant
// display / DM Mono / cream-ink-terracotta tokens) but a different EDITORIAL
// shape: one page per written minute of the day, in order, rather than a
// curated front/back spread. Kept in its own file (not a variant flag inside
// keepsake.css.ts) because the @page size and the per-page pagination rules
// are genuinely different documents, not a themed version of the same one.
//
// Shares the SAME solemn-quiet mechanism as the A3 sheet: overriding
// --color-terracotta / --color-mulberry / --k-accent / --k-mulberry on
// `.keepsake-root.k-solemn` is what "one suppression, both formats" means —
// this file re-declares the same tokens (a plain string constant has no
// import), and the-keepsake-stays-quiet-at-a-wake.test.ts pins that both
// files carry it.
// ============================================================================

const SAFE_MARGIN_MM = 14;

export const KEEPSAKE_A4_CSS = `
.keepsake-root {
  --color-cream: 251 251 250;
  --color-ink: 30 34 41;
  --color-terracotta: 197 160 89;
  --color-mulberry: 92 37 66;
  --k-cream: rgb(var(--color-cream));
  --k-ink: rgb(var(--color-ink));
  --k-accent: rgb(var(--color-terracotta));
  --k-mulberry: rgb(var(--color-mulberry));
  --k-display: var(--font-display), 'Cormorant Garamond', ui-serif, Georgia, serif;
  --k-mono: var(--font-mono), 'DM Mono', ui-monospace, SFMono-Regular, monospace;
  color: var(--k-ink);
}

/* Solemn-quiet — see keepsake.css.ts for the full rationale. Same tokens,
   same effect, both sheets. */
.keepsake-root.k-solemn {
  --color-terracotta: var(--color-ink);
  --color-mulberry: var(--color-ink);
  --k-accent: var(--k-ink);
  --k-mulberry: var(--k-ink);
}

.keepsake-root {
  min-height: 100dvh;
  background: #4a4a48;
  padding: 24px 16px 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.k4-page {
  background: var(--k-cream);
  width: 210mm;
  min-height: 297mm;
  max-width: 100%;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.35);
  padding: ${SAFE_MARGIN_MM}mm;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.k4-cover-eyebrow {
  font-family: var(--k-mono);
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 8pt;
  color: var(--k-accent);
  margin: 0 0 4mm;
  text-align: center;
}
.k4-cover-nameplate {
  font-family: var(--k-display);
  font-weight: 600;
  font-size: 30pt;
  text-align: center;
  margin: 0 0 6mm;
}
.k4-cover-dateline {
  font-family: var(--k-mono);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 8pt;
  text-align: center;
  color: rgba(var(--color-ink), 0.6);
  margin: 0 0 8mm;
}
.k4-cover-hero {
  margin: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.k4-cover-hero img {
  width: 100%;
  flex: 1;
  object-fit: cover;
  display: block;
}
.k4-cover-hero figcaption {
  font-family: var(--k-display);
  font-style: italic;
  font-size: 10pt;
  text-align: center;
  margin: 3mm 0 0;
}

/* ── one minute per page ─────────────────────────────────────────────────── */
.k4-minute-index {
  font-family: var(--k-mono);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 7.5pt;
  color: rgba(var(--color-ink), 0.5);
  margin: 0 0 3mm;
  display: flex;
  justify-content: space-between;
}
.k4-minute-time {
  font-family: var(--k-mono);
  font-size: 8pt;
  color: var(--k-accent);
}
.k4-minute-media {
  flex: 1;
  margin: 0 0 4mm;
  overflow: hidden;
  border-radius: 2mm;
}
.k4-minute-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.k4-minute-clipcap {
  font-family: var(--k-mono);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 7pt;
  color: var(--k-accent);
  margin: 2mm 0 0;
}
.k4-minute-title {
  font-family: var(--k-display);
  font-weight: 600;
  font-size: 15pt;
  margin: 0 0 2mm;
}
.k4-minute-writeup {
  font-family: var(--k-body, var(--k-display));
  font-size: 10pt;
  line-height: 1.45;
  margin: 0;
}
.k4-minute-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--k-display);
  font-style: italic;
  font-size: 12pt;
  color: rgba(var(--color-ink), 0.5);
  border: 1px dashed rgba(var(--color-ink), 0.25);
  border-radius: 2mm;
}

/* ── closing page (locked close + colophon), reuses the A3 sheet's classes
   for the couple's words / song / QR colophon so both formats read as one
   family — those class names (.k-couple-quote, .k-song, .k-colophon…) come
   from keepsake.css.ts, loaded alongside this file on the A4 route. ── */
.k4-closing {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 1;
}

/* ── PRINT: A4 portrait, ONE page per minute, toolbar hidden ───────────────── */
@media print {
  @page {
    size: A4 portrait;
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
  .k4-page {
    width: 210mm;
    height: 297mm;
    max-width: none;
    box-shadow: none;
    margin: 0;
    overflow: hidden;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    /*
      🔒 THE PAGINATION GUARD'S WHOLE JOB: every .k4-page (one per minute,
      plus the cover and closing pages) breaks BOTH before and after — a
      minute never shares a printed sheet with its neighbour, and content
      inside a page never spills onto a second one (overflow: hidden above,
      paired with break-inside: avoid on every child block). See
      a4-pagination.test.ts, which sabotages this into a shared-page layout
      and confirms the guard actually fires.
    */
    break-before: page;
    break-after: page;
  }
  .k4-page > * { break-inside: avoid; }
  img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
