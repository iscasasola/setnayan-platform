import { formatCount } from '@/lib/format-number';
import { PRINT_HTML_BRAND_CSS, printBrandHtml } from '@/lib/print-html-brand';

/**
 * The caterer meal counts' browser-print page (the route's HTML, `?format=` absent; "Print → Save as PDF", same pattern
 * as the seating pack): totals per meal, the per-table breakdown, every dietary restriction.
 *
 * 🏷 The report is ONE section (one sheet), and it ENDS with the one "Made with Setnayan · setnayan.com" line
 * (`printBrandHtml`, lib/print-html-brand.ts; owner 2026-10-22) — under the last list, never inside a table's rows.
 *
 * Pure (no database): the route hands it the counted numbers, so the guard (`lib/every-html-print-carries-setnayan.test.ts`)
 * draws the same page from a fixture.
 */
export type CatererCountsHtmlInput = {
  eventId: string;
  eventName: string;
  /** The event's date in words, or '' when it has none. */
  dateStr: string;
  confirmed: number;
  tentative: number;
  /** [meal, count], largest first. */
  totals: Array<[string, number]>;
  units: Array<{ label: string; guests: number; meals: Array<[string, number]>; diets: Array<{ name: string; restriction: string }> }>;
  allDiets: Array<{ name: string; table: string; restriction: string }>;
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

export function catererCountsHtml({ eventId, eventName, dateStr, confirmed, tentative, totals, units, allDiets }: CatererCountsHtmlInput): string {
  const totalRows = totals.map(([meal, n]) => `<tr><td class="meal">${esc(meal)}</td><td class="count">${n}</td></tr>`).join('');

  const unitSections = units
    .map((u) => {
      const mealsLine = u.meals.map(([meal, n]) => `${n}× ${esc(meal)}`).join(' · ');
      const diets = u.diets.map((d) => `<li><strong>${esc(d.name)}</strong> — ${esc(d.restriction)}</li>`).join('');
      return `<section class="unit">
        <h3>${esc(u.label)} <span class="muted">· ${u.guests} ${u.guests === 1 ? 'guest' : 'guests'}</span></h3>
        <p class="meals">${mealsLine}</p>
        ${diets ? `<ul class="diets">${diets}</ul>` : ''}
      </section>`;
    })
    .join('');

  const dietRows = allDiets
    .map((d) => `<li><strong>${esc(d.name)}</strong> (${esc(d.table)}) — ${esc(d.restriction)}</li>`)
    .join('');

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Caterer meal counts — ${esc(eventName)}</title>
<style>
  :root { --ink:#1E2229; --cream:#FBFBFA; --gold:#C5A059; --muted:#9a958c; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #efece6; color: var(--ink); font-family: -apple-system, system-ui, sans-serif; }
  .toolbar { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; justify-content: space-between;
    gap: 12px; padding: 12px 18px; background: var(--cream); border-bottom: 1px solid rgba(30,34,41,.12); }
  .toolbar a, .toolbar button { font: inherit; font-size: 14px; border-radius: 9px; padding: 8px 14px; cursor: pointer;
    text-decoration: none; border: 1px solid rgba(30,34,41,.18); background: var(--cream); color: var(--ink); }
  .toolbar button { background: #C97B4B; border-color: #C97B4B; color: #fff; font-weight: 600; }
  .doc { max-width: 800px; margin: 0 auto; padding: 16px; }
  .sheet { background: var(--cream); margin: 16px auto; padding: 18mm 16mm; box-shadow: 0 1px 6px rgba(0,0,0,.12); }
  h1 { font-family: Georgia, serif; font-size: 30px; margin: 0 0 2px; }
  .sub { color: var(--muted); margin: 0 0 16px; }
  h2 { font-size: 13px; letter-spacing: .2em; text-transform: uppercase; color: var(--gold); margin: 22px 0 8px; }
  table { border-collapse: collapse; min-width: 50%; }
  .meal { padding: 6px 24px 6px 0; border-bottom: 1px solid rgba(30,34,41,.08); }
  .count { padding: 6px 0; border-bottom: 1px solid rgba(30,34,41,.08); font-weight: 700; text-align: right; }
  .unit { padding: 10px 0; border-bottom: 1px solid rgba(30,34,41,.08); }
  .unit h3 { font-size: 15px; margin: 0 0 2px; }
  .muted { color: var(--muted); font-weight: 400; font-size: 12px; }
  .meals { margin: 0; font-size: 13px; }
  .diets { margin: 6px 0 0; padding-left: 18px; font-size: 12.5px; color: #854f0b; }
  ul.all { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.6; }
  ${PRINT_HTML_BRAND_CSS}
  .sheet > .print-brand { margin-top: 28px; }
  @media print { html, body { background:#fff; } .toolbar { display:none; } .doc { max-width:none; padding:0; }
    .sheet { box-shadow:none; margin:0; padding:0; } @page { size: A4; margin: 14mm; } }
</style>
</head><body>
  <div class="toolbar">
    <a href="/dashboard/${esc(eventId)}/seating">← Back to seating</a>
    <span style="color:var(--muted);font-size:12px;">Meal counts = confirmed guests${tentative > 0 ? ` · ${formatCount(tentative)} tentative (pending replies)` : ''} · linked tables count as one</span>
    <span>
      <a href="/dashboard/${esc(eventId)}/seating/caterer?format=csv">Download CSV</a>
      <button type="button" onclick="window.print()">Print / Save as PDF</button>
    </span>
  </div>
  <div class="doc"><section class="sheet">
    <h1>Caterer meal counts</h1>
    <p class="sub">${esc(eventName)}${dateStr ? ` · ${esc(dateStr)}` : ''} · ${formatCount(confirmed)} confirmed${tentative > 0 ? ` · ${formatCount(tentative)} tentative` : ''}</p>
    <h2>Totals</h2>
    <table><tbody>${totalRows || '<tr><td class="meal">No attending guests yet.</td></tr>'}</tbody></table>
    <h2>Per table</h2>
    ${unitSections || '<p class="muted">No one seated yet.</p>'}
    <h2>All dietary restrictions</h2>
    ${dietRows ? `<ul class="all">${dietRows}</ul>` : '<p class="muted">None recorded.</p>'}
    ${printBrandHtml()}
  </section></div>
</body></html>`;
}
