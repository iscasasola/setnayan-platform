import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { pickPayerRail } from '@/lib/gcash-allowance';
import { getGcashGate } from '@/lib/gcash-allowance.server';

/**
 * ⚖ WHICH ONE QR THE CHECKOUT DRAWER DRAWS (owner 2026-11-18) — `GET /api/pay-rail?amount=<php>&event=<id>` answers
 * `{ rail: 'gcash' | 'bdo' }` by `pickPayerRail`. A READ, deliberately not a server action (the action budget is
 * near its ceiling, and this writes nothing).
 *
 * 🔒 Signed-in only; with `event`, only a member of that event (the `events` read runs under the caller's RLS, so a
 * foreign event returns no row). Eventless (per-user subscription checkout) needs only the sign-in. The answer is ONE
 * word: the GCash gate's numbers (the month's total, the allowance) never leave the server.
 *
 * Display only — `submitOrderAction` asks the same rule again with the amount it computes itself and refuses a GCash
 * proof the rule would not give. Anything unreadable ⇒ BDO, the side that never overshoots.
 */
export const dynamic = 'force-dynamic';

const BDO = () => NextResponse.json({ rail: 'bdo' }, { headers: { 'Cache-Control': 'no-store' } });

export async function GET(req: NextRequest) {
  const amount = Number(req.nextUrl.searchParams.get('amount'));
  const eventId = req.nextUrl.searchParams.get('event') ?? '';
  if (!Number.isFinite(amount) || amount <= 0) return BDO();
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (eventId) {
      const { data, error } = await supabase.from('events').select('event_id').eq('event_id', eventId).maybeSingle();
      if (error || !data) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const rail = pickPayerRail(amount, await getGcashGate());
    return NextResponse.json({ rail }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return BDO();
  }
}
