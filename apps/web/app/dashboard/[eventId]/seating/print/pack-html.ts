import { formatCount } from '@/lib/format-number';
import { PRINT_HTML_BRAND_CSS, printBrandHtml } from '@/lib/print-html-brand';

/**
 * The seating pack's browser-print page (the route's HTML, `?format=` absent) — a self-contained printable HTML document
 * (NOT a page under the dashboard layout, so no app chrome bleeds into the printout). The couple hits "Print → Save as
 * PDF" in the browser dialog. Three parts:
 *   1. Cover + table directory (who's at each table)
 *   2. One full-page table SIGN per table — big label + the table's QR
 *   3. Place cards (name · table · the guest's personal QR), at the end
 *
 * 🏷 Each part — the cover, every sign, the place-card sheet — ENDS with the one "Made with Setnayan · setnayan.com" line
 * (`printBrandHtml`, lib/print-html-brand.ts; owner 2026-10-22). The cover's line sits under the directory table, a
 * sign's at the foot of its page, the cards' under the grid — never in a table row, never on a place card.
 *
 * Pure (no database, no QR drawing): the route hands it the QR pictures as data URLs, so the guard
 * (`lib/every-html-print-carries-setnayan.test.ts`) draws the same page from a fixture.
 */
export type SeatingPackHtmlInput = {
  eventId: string;
  coupleName: string;
  /** The event's date in words, or '' when it has none. */
  dateStr: string;
  /** The line under every sign's QR (`seatingSignLine`). */
  signSub: string;
  units: Array<{
    key: string;
    label: string;
    /** How many tables this printed unit joins (1 = a lone table). */
    joined: number;
    /** The unit's sign QR, as an image source. */
    signQr: string;
    guests: Array<{ name: string; qr: string }>;
  }>;
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

export function seatingPackHtml({ eventId, coupleName, dateStr, signSub, units }: SeatingPackHtmlInput): string {
  const placeCards = units.flatMap((u) => u.guests.map((g) => ({ ...g, tableLabel: u.label })));
  const totalSeated = placeCards.length;
  const brand = printBrandHtml();

  const directoryRows = units
    .map((u) => {
      const names = u.guests.map((g) => esc(g.name)).join(', ');
      return `<tr><td class="dir-t">${esc(u.label)}${
        u.joined > 1 ? ` <span class="muted">(${u.joined} tables joined)</span>` : ''
      }</td><td class="dir-n">${names || '<span class="muted">— no one seated —</span>'}</td></tr>`;
    })
    .join('');

  const signs = units
    .map(
      (u) => `
      <section class="sheet sign">
        <div class="sign-inner">
          <p class="kicker">${esc(coupleName)}</p>
          <h1 class="sign-label">${esc(u.label)}</h1>
          <img class="sign-qr" src="${u.signQr}" alt="QR for ${esc(u.label)}" />
          <p class="sign-sub">${esc(signSub)}</p>
          <p class="sign-foot">${u.guests.length} seated${dateStr ? ` · ${esc(dateStr)}` : ''}</p>
        </div>
        ${brand}
      </section>`,
    )
    .join('');

  const cards = placeCards
    .map(
      (g) => `
      <div class="card">
        <div class="card-name">${esc(g.name)}</div>
        <div class="card-table">${esc(g.tableLabel)}</div>
        <img class="card-qr" src="${g.qr}" alt="" />
      </div>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Seating pack — ${esc(coupleName)}</title>
<style>
  :root { --ink:#1E2229; --cream:#FBFBFA; --gold:#C5A059; --muted:#9a958c; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #efece6; color: var(--ink); font-family: Georgia, 'Times New Roman', serif; }
  .toolbar { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
    gap: 12px; padding: 12px 18px; background: var(--cream); border-bottom: 1px solid rgba(30,34,41,.12);
    font-family: -apple-system, system-ui, sans-serif; }
  .toolbar a, .toolbar button { font: inherit; font-size: 14px; border-radius: 9px; padding: 8px 14px; cursor: pointer;
    text-decoration: none; border: 1px solid rgba(30,34,41,.18); background: var(--cream); color: var(--ink); }
  .toolbar button { background: #C97B4B; border-color: #C97B4B; color: #fff; font-weight: 600; }
  .toolbar .hint { color: var(--muted); font-size: 12px; border: 0; padding: 0; }
  .doc { max-width: 800px; margin: 0 auto; padding: 16px; }
  .sheet { background: var(--cream); margin: 16px auto; padding: 22mm 18mm; box-shadow: 0 1px 6px rgba(0,0,0,.12); }
  .cover h1 { font-size: 40px; margin: 0 0 4px; letter-spacing: .01em; }
  .cover .sub { color: var(--muted); margin: 0 0 18px; font-style: italic; }
  .cover .stat { font-family: -apple-system, system-ui, sans-serif; font-size: 13px; color: var(--ink);
    border-top: 1px solid rgba(30,34,41,.15); border-bottom: 1px solid rgba(30,34,41,.15); padding: 10px 0; margin: 0 0 18px; }
  table { width: 100%; border-collapse: collapse; }
  .dir-t { width: 34%; font-weight: 700; padding: 8px 10px 8px 0; vertical-align: top; border-bottom: 1px solid rgba(30,34,41,.08); }
  .dir-n { padding: 8px 0; vertical-align: top; border-bottom: 1px solid rgba(30,34,41,.08);
    font-family: -apple-system, system-ui, sans-serif; font-size: 13px; line-height: 1.5; }
  .muted { color: var(--muted); font-style: italic; }
  .sign { position: relative; display: flex; align-items: center; justify-content: center; min-height: 60vh; text-align: center; }
  .sign-inner { display: flex; flex-direction: column; align-items: center; }
  .kicker { font-family: -apple-system, system-ui, sans-serif; letter-spacing: .35em; text-transform: uppercase;
    font-size: 11px; color: var(--gold); margin: 0 0 14px; }
  .sign-label { font-size: 68px; line-height: 1.05; margin: 0 0 22px; }
  .sign-qr { width: 280px; height: 280px; }
  .sign-sub { font-family: -apple-system, system-ui, sans-serif; font-size: 13px; color: var(--muted); margin: 12px 0 0; }
  .sign-foot { font-family: -apple-system, system-ui, sans-serif; font-size: 12px; color: var(--muted); margin: 6px 0 0; }
  .cards-title { font-family: -apple-system, system-ui, sans-serif; font-size: 12px; letter-spacing: .2em;
    text-transform: uppercase; color: var(--muted); margin: 0 0 12px; }
  .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .card { border: 1px dashed rgba(30,34,41,.35); border-radius: 8px; padding: 14px; display: flex; flex-direction: column;
    align-items: center; text-align: center; break-inside: avoid; }
  .card-name { font-size: 22px; margin-bottom: 2px; }
  .card-table { font-family: -apple-system, system-ui, sans-serif; font-size: 12px; color: var(--gold);
    letter-spacing: .08em; text-transform: uppercase; margin-bottom: 8px; }
  .card-qr { width: 84px; height: 84px; }
  ${PRINT_HTML_BRAND_CSS}
  /* A sign's line sits at the foot of its own page, under the centred sign — not beside it. */
  .sign > .print-brand { position: absolute; left: 0; right: 0; bottom: 10mm; margin: 0; }
  @media print {
    html, body { background: #fff; }
    .toolbar { display: none; }
    .doc { max-width: none; padding: 0; }
    .sheet { box-shadow: none; margin: 0; padding: 0; }
    .sign { min-height: 0; page-break-after: always; height: 96vh; }
    .sign > .print-brand { bottom: 0; }
    .cards-sheet { page-break-before: always; }
    @page { size: A4; margin: 14mm; }
  }
</style>
</head><body>
  <div class="toolbar">
    <a href="/dashboard/${esc(eventId)}/seating">← Back to seating</a>
    <span class="hint">One table sign per page · place cards at the end</span>
    <a href="/dashboard/${esc(eventId)}/seating/chart">Entrance seating chart</a>
    <button type="button" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="doc">
    <section class="sheet cover">
      <h1>${esc(coupleName)}</h1>
      <p class="sub">${dateStr ? esc(dateStr) + ' · ' : ''}Seating pack</p>
      <p class="stat">${formatCount(units.length)} ${units.length === 1 ? 'table' : 'tables'} · ${formatCount(totalSeated)} seated ${
        totalSeated === 1 ? 'guest' : 'guests'
      }</p>
      <table><tbody>${directoryRows || '<tr><td class="muted">No tables yet.</td></tr>'}</tbody></table>
      ${brand}
    </section>
    ${signs}
    ${
      cards
        ? `<section class="sheet cards-sheet"><p class="cards-title">Place cards</p><div class="cards">${cards}</div>${brand}</section>`
        : ''
    }
  </div>
</body></html>`;
}
