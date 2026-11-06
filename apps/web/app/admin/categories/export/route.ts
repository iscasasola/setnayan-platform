import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdminProfile } from '@/lib/demo-mode';
import { loadCategories } from '../_components/load';
import { loadMapData } from '../_components/load-map';
import { treeCsv, treePdf, treeRows } from '../_components/tree-export';

/**
 * GET /admin/categories/export?format=csv|pdf[&show=…][&q=…]
 *
 * Download ▾ on the Categories page (🌳 ③b; corpus PLAN admin_taxonomy_four_levels § 7.5): the printable
 * tree (A4 PDF) or the spreadsheet (CSV), built from the same rows the page draws and following its Show ▾
 * and search ("what you see is what you export").
 *
 * Route handlers are NOT covered by the /admin layout's admin guard, so admin is re-checked here and
 * everyone else gets a 404 (not a 403 — the endpoint's existence is not disclosed), exactly as
 * `app/admin/growth/export/route.ts` does. A refused read is a 503 with a sentence, never an empty file
 * that looks like an empty taxonomy.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Not found', { status: 404 });
  const { data: me } = await supabase.from('users').select('account_type, is_internal, is_team_member').eq('user_id', user.id).maybeSingle();
  if (!isAdminProfile(me)) return new NextResponse('Not found', { status: 404 });

  const sp = request.nextUrl.searchParams;
  const format = sp.get('format') === 'pdf' ? 'pdf' : 'csv';
  const show = (sp.get('show') ?? '').slice(0, 20);
  const q = (sp.get('q') ?? '').slice(0, 80);

  const admin = createAdminClient();
  const cats = await loadCategories(admin, null);
  if (cats.failed.includes('the category tree') || cats.failed.includes('services')) {
    return new NextResponse('The category tree could not be read — nothing was exported. Try again in a moment.', { status: 503 });
  }
  const data = await loadMapData(admin, cats);
  const rows = treeRows(data, q, show);
  const day = new Date().toISOString().slice(0, 10);

  if (format === 'csv') {
    return new NextResponse(treeCsv(data, rows), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="setnayan-supplier-categories-${day}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }
  const filter = [show ? `Show: ${show}` : 'Everything', q ? `“${q}”` : ''].filter(Boolean).join(' · ');
  const bytes = await treePdf(data, rows, {
    filter: data.partsRead ? filter : `${filter} · parts could not be read`,
    date: new Date().toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' }),
  });
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="setnayan-supplier-categories-${day}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
