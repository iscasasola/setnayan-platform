import { NextResponse } from 'next/server';
import { notFound } from 'next/navigation';
import { buildBudgetLedger } from '@/lib/budget-ledger';
import { budgetExportCsv } from '@/lib/budget-export';
import { BudgetUnreadError, budgetPdf } from '@/lib/budget-pdf';
import { sharePdfPaper } from '@/lib/share-pdf-papers';
import { labMoney } from '../fixture';

export const dynamic = 'force-dynamic';

/**
 * /dev/budget-lab/file — the lab's stand-in for `/api/budget/<id>/export`: the REAL `budgetPdf` / `budgetExportCsv` over
 * the lab's fixture ledger, so Share can be walked end to end (fetch → File → share sheet / download) with no sign-in
 * and no database. DEV-ONLY: production 404s it first, like the lab page.
 *
 *   ?format=pdf|csv   the file
 *   ?state=failed     a refused read — the route's own refusal, no file
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === 'production') notFound();
  const q = new URL(req.url).searchParams;
  const money = q.get('state') === 'failed' ? labMoney({ suppliers: 'ok', orders: 'failed', costs: 'ok' }) : labMoney();
  const ledger = buildBudgetLedger({ money });
  const input = { eventName: 'Mara & Jun', money, ledger, generatedAt: new Date() };
  if (q.get('format') === 'csv') {
    return new NextResponse(budgetExportCsv(input), { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
  }
  try {
    const bytes = await budgetPdf({ ...input, eventDate: 'Saturday · December 12, 2026', venue: 'Seda Vertis North', paper: sharePdfPaper(q.get('paper')) });
    return new NextResponse(Buffer.from(bytes), { headers: { 'Content-Type': 'application/pdf' } });
  } catch (e) {
    if (e instanceof BudgetUnreadError) return new NextResponse(e.message, { status: 503 });
    throw e;
  }
}
