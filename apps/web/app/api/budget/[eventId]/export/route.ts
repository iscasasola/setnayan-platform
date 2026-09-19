import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveProfileByEvent, surfaceEnabled } from '@/lib/event-type-profile';
import { resolveBudgetVisibility } from '@/lib/budget-visibility';
import { isBudgetTruthEnabled } from '@/lib/budget-truth-flag';
import { resolveEventMoney, type EventMoney } from '@/lib/budget-truth';
import { resolveAllocationInputs, fetchSavedAllocationPlan } from '@/lib/budget-allocation-data';
import { buildBudgetLedger, suggestedPlanByBucket } from '@/lib/budget-ledger';
import { budgetExportCsv, budgetExportHtml } from '@/lib/budget-export';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// SUP-64 · the couple's budget as a printable page (default) or a CSV
// (`?format=csv`) — the caterer report's shape (`seating/caterer/route.ts`).
//
// Same doors as `/budget` itself, in the same order, BEFORE any money is read:
//   1. signed in;
//   2. the event type has a Budget surface at all;
//   3. `resolveBudgetVisibility(...).mayRead` — a delegate without the budget
//      area is refused here exactly as the page refuses them. A refusal that
//      still reads the money is a refusal on the screen only.
//
// Same numbers as `/budget`: `resolveEventMoney` + `buildBudgetLedger` fed by
// the saved plan and `suggestedPlanByBucket`. When the resolver gives nothing
// (flag off, or it refused) we say so with a 503 — never a file of ₱0s, which
// would look like a real, empty budget.
// ---------------------------------------------------------------------------

type Params = { params: Promise<{ eventId: string }> };

export async function GET(req: Request, { params }: Params) {
  const { eventId } = await params;
  const wantCsv = new URL(req.url).searchParams.get('format') === 'csv';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Please sign in to export your budget.', { status: 401 });

  const profile = await resolveProfileByEvent(eventId);
  if (!surfaceEnabled(profile, 'budget')) {
    return new NextResponse('This event has no budget to export.', { status: 404 });
  }

  const access = await resolveBudgetVisibility(supabase, eventId, user.id);
  if (!access.mayRead) {
    return new NextResponse("The budget isn't shared with you. Ask the couple for budget access.", {
      status: 403,
    });
  }

  // SEC-2b: `events_host`, the couple/moderator-scoped view (as `/budget`).
  const [eventRes, money, allocInputs, savedPlanPhp] = await Promise.all([
    supabase.from('events_host').select('display_name, event_type').eq('event_id', eventId).maybeSingle(),
    isBudgetTruthEnabled()
      ? resolveEventMoney(supabase, eventId).catch((): EventMoney | null => null)
      : Promise.resolve<EventMoney | null>(null),
    resolveAllocationInputs(supabase, eventId),
    fetchSavedAllocationPlan(supabase, eventId),
  ]);
  const event = eventRes.data as { display_name: string | null; event_type: string | null } | null;
  if (!event) return new NextResponse('Event not found.', { status: 404 });

  if (!money) {
    return new NextResponse(
      "Your budget can't be exported right now. Please try again in a few minutes.",
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  const allocLabels = new Map(allocInputs.leaves.map((l) => [l.canonicalService, l.label]));
  const ledger = buildBudgetLedger({
    money,
    savedPlanPhp,
    suggestedPhp: suggestedPlanByBucket({
      isWedding: (event.event_type ?? 'wedding') === 'wedding',
      budgetPhp: allocInputs.budgetPhp,
      leaves: allocInputs.leaves,
      config: allocInputs.config,
    }),
    labelFor: (id) => allocLabels.get(id) ?? id,
  });

  const eventName = event.display_name?.trim() || 'Your event';
  const input = { eventName, money, ledger, generatedAt: new Date() };

  if (wantCsv) {
    const safeName =
      eventName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'event';
    return new NextResponse(budgetExportCsv(input), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="setnayan-${safeName}-budget.csv"`,
        'Cache-Control': 'private, no-store',
      },
    });
  }

  return new NextResponse(
    budgetExportHtml({ ...input, csvHref: `/api/budget/${eventId}/export?format=csv` }),
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' },
    },
  );
}
