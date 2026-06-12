import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchGuestsByEvent, guestDisplayName, MEAL_LABELS, type MealPreference } from '@/lib/guests';
import { fetchAssignments, fetchTables } from '@/lib/seating';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Caterer meal-count report — the handover artifact for the caterer:
//   • overall counts per meal choice (attending guests only)
//   • per-table breakdown (linked tables grouped as one unit)
//   • every dietary restriction, called out by name + table
// Printable HTML by default ("Print → Save as PDF", same pattern as the
// seating print pack); `?format=csv` downloads the raw per-guest rows for
// caterers who want a spreadsheet (name · table · meal · dietary).
// ---------------------------------------------------------------------------

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export async function GET(req: Request, ctx: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await ctx.params;
  const wantCsv = new URL(req.url).searchParams.get('format') === 'csv';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  // RLS scopes every read to the couple — a non-member gets null/empty.
  const { data: event } = await supabase
    .from('events')
    .select('display_name, event_date')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) return new NextResponse('Event not found', { status: 404 });

  const [tables, assignments, guests] = await Promise.all([
    fetchTables(supabase, eventId),
    fetchAssignments(supabase, eventId),
    fetchGuestsByEvent(supabase, eventId),
  ]);

  // The caterer counts ATTENDING guests only; unseated attendees still eat, so
  // they land in an explicit "Not seated yet" bucket rather than vanishing.
  const attending = guests.filter((g) => g.rsvp_status === 'attending');
  const tableOfGuest = new Map(assignments.map((a) => [a.guest_id, a.table_id]));

  // Linked tables report as ONE unit (same grouping as the print pack).
  const unitKeyOfTable = new Map(tables.map((t) => [t.table_id, t.link_group_id ?? t.table_id]));
  const unitLabelByKey = new Map<string, string>();
  for (const t of tables) {
    const key = t.link_group_id ?? t.table_id;
    if (!unitLabelByKey.has(key)) unitLabelByKey.set(key, t.link_group_label ?? t.table_label);
  }

  const UNSEATED = '__unseated__';
  const unitOf = (guestId: string) => {
    const tid = tableOfGuest.get(guestId);
    return tid ? unitKeyOfTable.get(tid) ?? UNSEATED : UNSEATED;
  };
  const labelOfUnit = (key: string) => (key === UNSEATED ? 'Not seated yet' : unitLabelByKey.get(key) ?? 'Table');

  const mealOf = (m: string | null): string => MEAL_LABELS[(m ?? 'no_preference') as MealPreference] ?? 'No preference';

  // CSV: one row per attending guest.
  if (wantCsv) {
    const header = 'Guest,Table,Meal,Dietary restrictions';
    const rows = attending
      .map((g) =>
        [
          csvCell(guestDisplayName(g)),
          csvCell(labelOfUnit(unitOf(g.guest_id))),
          csvCell(mealOf(g.meal_preference)),
          csvCell(g.dietary_restrictions ?? ''),
        ].join(','),
      )
      .join('\n');
    const safeName = (event.display_name || 'Wedding').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
    return new NextResponse(`${header}\n${rows}\n`, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="Caterer-Meal-Counts-${safeName}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  // Overall totals per meal.
  const totals = new Map<string, number>();
  for (const g of attending) totals.set(mealOf(g.meal_preference), (totals.get(mealOf(g.meal_preference)) ?? 0) + 1);
  const totalRows = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([meal, n]) => `<tr><td class="meal">${esc(meal)}</td><td class="count">${n}</td></tr>`)
    .join('');

  // Per-unit breakdown: meal counts + dietary notes per table.
  const unitKeys = [...new Set([...tables.map((t) => t.link_group_id ?? t.table_id), UNSEATED])];
  const unitSections = unitKeys
    .map((key) => {
      const members = attending.filter((g) => unitOf(g.guest_id) === key);
      if (members.length === 0) return '';
      const counts = new Map<string, number>();
      for (const g of members) counts.set(mealOf(g.meal_preference), (counts.get(mealOf(g.meal_preference)) ?? 0) + 1);
      const mealsLine = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([meal, n]) => `${n}× ${esc(meal)}`)
        .join(' · ');
      const diets = members
        .filter((g) => g.dietary_restrictions)
        .map((g) => `<li><strong>${esc(guestDisplayName(g))}</strong> — ${esc(g.dietary_restrictions!)}</li>`)
        .join('');
      return `<section class="unit">
        <h3>${esc(labelOfUnit(key))} <span class="muted">· ${members.length} ${members.length === 1 ? 'guest' : 'guests'}</span></h3>
        <p class="meals">${mealsLine}</p>
        ${diets ? `<ul class="diets">${diets}</ul>` : ''}
      </section>`;
    })
    .join('');

  // All dietary restrictions in one caterer-facing list.
  const allDiets = attending
    .filter((g) => g.dietary_restrictions)
    .map(
      (g) =>
        `<li><strong>${esc(guestDisplayName(g))}</strong> (${esc(labelOfUnit(unitOf(g.guest_id)))}) — ${esc(
          g.dietary_restrictions!,
        )}</li>`,
    )
    .join('');

  const dateStr = (() => {
    if (!event.event_date) return '';
    const d = new Date(event.event_date as string);
    return Number.isNaN(d.getTime())
      ? ''
      : d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  })();

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Caterer meal counts — ${esc(event.display_name || 'Wedding')}</title>
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
  @media print { html, body { background:#fff; } .toolbar { display:none; } .doc { max-width:none; padding:0; }
    .sheet { box-shadow:none; margin:0; padding:0; } @page { size: A4; margin: 14mm; } }
</style>
</head><body>
  <div class="toolbar">
    <a href="/dashboard/${esc(eventId)}/seating">← Back to seating</a>
    <span style="color:var(--muted);font-size:12px;">Attending guests only · linked tables count as one</span>
    <span>
      <a href="/dashboard/${esc(eventId)}/seating/caterer?format=csv">Download CSV</a>
      <button type="button" onclick="window.print()">Print / Save as PDF</button>
    </span>
  </div>
  <div class="doc"><section class="sheet">
    <h1>Caterer meal counts</h1>
    <p class="sub">${esc(event.display_name || 'Wedding')}${dateStr ? ` · ${esc(dateStr)}` : ''} · ${attending.length} attending</p>
    <h2>Totals</h2>
    <table><tbody>${totalRows || '<tr><td class="meal">No attending guests yet.</td></tr>'}</tbody></table>
    <h2>Per table</h2>
    ${unitSections || '<p class="muted">No one seated yet.</p>'}
    <h2>All dietary restrictions</h2>
    ${allDiets ? `<ul class="all">${allDiets}</ul>` : '<p class="muted">None recorded.</p>'}
  </section></div>
</body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
