import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchBudgetSnapshot, renderBudgetIcs } from '@/lib/budget';

type Params = { params: Promise<{ eventId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: event } = await supabase
    .from('events')
    .select('event_id, display_name')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const snapshot = await fetchBudgetSnapshot(supabase, eventId);
  const ics = renderBudgetIcs({
    eventName: event.display_name,
    vendors: snapshot.vendors,
  });

  const safeName =
    event.display_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'event';

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="setnayan-${safeName}-budget.ics"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
