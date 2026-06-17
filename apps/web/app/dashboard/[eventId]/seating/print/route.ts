import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/server';
import { fetchGuestsByEvent, guestDisplayName } from '@/lib/guests';
import { fetchAssignments, fetchTables } from '@/lib/seating';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Seating print pack — a self-contained printable HTML document (NOT a page
// under the dashboard layout, so no app chrome bleeds into the printout). The
// couple hits "Print → Save as PDF" in the browser dialog. Three parts:
//   1. Cover + table directory (who's at each table)
//   2. One full-page table SIGN per table — big label + the table's QR
//   3. Place cards (name · table · the guest's personal QR), 8 per page
// QR payloads point at the live event site; the opaque table/guest tokens ride
// along so the future find-my-seat + Papic fan-out can resolve a scan precisely.
// ---------------------------------------------------------------------------

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

const QR_OPTS = { margin: 1, color: { dark: '#1E2229', light: '#FBFBFA' } } as const;

export async function GET(req: Request, ctx: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await ctx.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  // RLS scopes every read to the couple — a non-member gets null/empty.
  const { data: event } = await supabase
    .from('events')
    .select('display_name, slug, event_date, monogram_text')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) return new NextResponse('Event not found', { status: 404 });

  const [tables, assignments, guests] = await Promise.all([
    fetchTables(supabase, eventId),
    fetchAssignments(supabase, eventId),
    fetchGuestsByEvent(supabase, eventId),
  ]);

  const guestById = new Map(guests.map((g) => [g.guest_id, g]));
  // Seated guests per table, ordered by seat number (nulls last).
  const seatedByTable = new Map<string, { name: string; qr_token: string }[]>();
  for (const a of assignments) {
    const g = guestById.get(a.guest_id);
    if (!g) continue;
    const arr = seatedByTable.get(a.table_id) ?? [];
    arr.push({ name: guestDisplayName(g), qr_token: g.qr_token });
    seatedByTable.set(a.table_id, arr);
  }
  for (const arr of seatedByTable.values()) {
    arr.sort((x, y) => x.name.localeCompare(y.name));
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  const site = event.slug ? `${appUrl}/${event.slug}` : appUrl;

  // Group linked tables into ONE printed unit (identity + QR only — owner-locked
  // 2026-06-10): the unit prints a single sign under its shared label, carrying
  // the LEAD table's QR (first member in sort order); sibling tables emit no
  // sign of their own. Unlinked tables are single-member units.
  type Unit = { key: string; label: string; lead: (typeof tables)[number]; members: typeof tables };
  const unitsByKey = new Map<string, Unit>();
  for (const t of tables) {
    const key = t.link_group_id ?? t.table_id;
    const existing = unitsByKey.get(key);
    if (existing) {
      existing.members.push(t);
    } else {
      unitsByKey.set(key, {
        key,
        label: t.link_group_label ?? t.table_label,
        lead: t,
        members: [t],
      });
    }
  }
  const units = [...unitsByKey.values()];
  const unitGuests = (u: Unit) =>
    u.members.flatMap((m) => seatedByTable.get(m.table_id) ?? []).sort((x, y) => x.name.localeCompare(y.name));

  // Pre-render every QR to a data URL (server-side, no network).
  const tableQr = new Map<string, string>(
    await Promise.all(
      units.map(
        async (u) => [u.key, await QRCode.toDataURL(`${site}?t=${u.lead.public_id}`, QR_OPTS)] as const,
      ),
    ),
  );
  const placeCards = units.flatMap((u) => unitGuests(u).map((g) => ({ ...g, tableLabel: u.label })));
  const placeQr = new Map<string, string>(
    await Promise.all(
      placeCards.map(
        async (g) => [g.qr_token, await QRCode.toDataURL(`${site}?g=${g.qr_token}`, QR_OPTS)] as const,
      ),
    ),
  );

  const coupleName = event.monogram_text || event.display_name || 'Our Wedding';
  const dateStr = (() => {
    if (!event.event_date) return '';
    const d = new Date(event.event_date as string);
    return Number.isNaN(d.getTime())
      ? ''
      : d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  })();
  const totalSeated = placeCards.length;

  const directoryRows = units
    .map((u) => {
      const names = unitGuests(u)
        .map((g) => esc(g.name))
        .join(', ');
      return `<tr><td class="dir-t">${esc(u.label)}${
        u.members.length > 1 ? ` <span class="muted">(${u.members.length} tables joined)</span>` : ''
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
          <img class="sign-qr" src="${tableQr.get(u.key)}" alt="QR for ${esc(u.label)}" />
          <p class="sign-sub">Scan to visit our wedding</p>
          <p class="sign-foot">${unitGuests(u).length} seated${
            dateStr ? ` · ${esc(dateStr)}` : ''
          }</p>
        </div>
      </section>`,
    )
    .join('');

  const cards = placeCards
    .map(
      (g) => `
      <div class="card">
        <div class="card-name">${esc(g.name)}</div>
        <div class="card-table">${esc(g.tableLabel)}</div>
        <img class="card-qr" src="${placeQr.get(g.qr_token)}" alt="" />
      </div>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Seating pack — ${esc(coupleName)}</title>
<style>
  :root { --ink:#1E2229; --cream:#FBFBFA; --gold:#C5A059; --muted:#9a958c; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #efece6; color: var(--ink); font-family: Georgia, 'Times New Roman', serif; }
  .toolbar { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; justify-content: space-between;
    gap: 12px; padding: 12px 18px; background: var(--cream); border-bottom: 1px solid rgba(30,34,41,.12);
    font-family: -apple-system, system-ui, sans-serif; }
  .toolbar a, .toolbar button { font: inherit; font-size: 14px; border-radius: 9px; padding: 8px 14px; cursor: pointer;
    text-decoration: none; border: 1px solid rgba(30,34,41,.18); background: var(--cream); color: var(--ink); }
  .toolbar button { background: #C97B4B; border-color: #C97B4B; color: #fff; font-weight: 600; }
  .toolbar .hint { color: var(--muted); font-size: 12px; border: 0; padding: 0; }
  .print-advisory { background: #fffbeb; border: 1px solid #f59e0b; border-radius: 8px; padding: 10px 16px;
    font-family: -apple-system, system-ui, sans-serif; font-size: 12px; color: #92400e; display: flex;
    align-items: center; gap: 8px; }
  .print-advisory::before { content: '⚠'; font-size: 14px; flex-shrink: 0; }
  @media print { .print-advisory { display: none; } }
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
  .sign { display: flex; align-items: center; justify-content: center; min-height: 60vh; text-align: center; }
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
  @media print {
    html, body { background: #fff; }
    .toolbar { display: none; }
    .doc { max-width: none; padding: 0; }
    .sheet { box-shadow: none; margin: 0; padding: 0; }
    .sign { min-height: 0; page-break-after: always; height: 96vh; }
    .cards-sheet { page-break-before: always; }
    @page { size: A4; margin: 14mm; }
  }
</style>
</head><body>
  <div class="toolbar">
    <a href="/dashboard/${esc(eventId)}/seating">← Back to seating</a>
    <span class="hint">One table sign per page · place cards at the end</span>
    <button type="button" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="print-advisory" style="max-width:800px;margin:10px auto 0;box-sizing:border-box;">
    Seat assignments may change after printing. Guests can always scan their QR code for the latest seat.
  </div>
  <div class="doc">
    <section class="sheet cover">
      <h1>${esc(coupleName)}</h1>
      <p class="sub">${dateStr ? esc(dateStr) + ' · ' : ''}Seating pack</p>
      <p class="stat">${units.length} ${units.length === 1 ? 'table' : 'tables'} · ${totalSeated} seated ${
        totalSeated === 1 ? 'guest' : 'guests'
      }</p>
      <table><tbody>${directoryRows || '<tr><td class="muted">No tables yet.</td></tr>'}</tbody></table>
    </section>
    ${signs}
    ${
      cards
        ? `<section class="sheet cards-sheet"><p class="cards-title">Place cards</p><div class="cards">${cards}</div></section>`
        : ''
    }
  </div>
</body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
