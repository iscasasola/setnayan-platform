import type { NextRequest } from 'next/server';
import { authVendorBearer } from '@/lib/api/vendor-bearer';
import { sendProposalCore, type SendProposalError } from '@/lib/proposal-send';

// Native-facing in-chat proposal / quote (a quote is a priced proposal). Shares
// sendProposalCore with the web action — same ownership + accepted-thread gating
// + draft→sent freeze. Acceptance still flows through the DB-guarded
// respond_vendor_proposal RPC; we never write a price here.
export const dynamic = 'force-dynamic';

const STATUS_BY_CODE: Record<SendProposalError, number> = {
  unauthenticated: 401,
  not_owner: 403,
  thread_closed: 403,
  tier_free: 403,
  needs_template: 422,
  fee_unpaid: 402, // Payment Required — the booking fee for this send is unpaid
  // S5 · a new quote would supersede an ACCEPTED one the couple has already
  // asked to lock at, or the booking is confirmed — a change order, not a re-quote.
  deal_locked: 409,
  lock_requested: 409,
  // 🎁 the quote's own gifts are over the booking's gift limit or more than the shop's stock — nothing was sent.
  gift_refused: 422,
  // 📅 no lifetime quotation (2026-11-09): sent without a Valid until — nothing was written.
  needs_valid_until: 422,
  plan_not_in_full: 422,
  // 🧪 the demo rule refused the pairing — a retry never changes it.
  demo_scope: 422,
  // 🧾 a "first N couples" offer on the quote is already used up (OWN-01) — nothing was sent.
  offer_taken: 409,
  failed: 500,
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params;
  const auth = await authVendorBearer(req);
  if (auth.response) return auth.response;

  let payload: {
    templateId?: unknown;
    packageId?: unknown;
    totalPhp?: unknown;
    validUntil?: unknown;
    title?: unknown;
  } = {};
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return Response.json({ error: 'invalid_json', message: 'Couldn’t read your request.' }, { status: 422 });
  }

  const totalPhp = Number(payload.totalPhp);
  const result = await sendProposalCore(auth.supabase, {
    threadId,
    templateId: typeof payload.templateId === 'string' ? payload.templateId : '',
    packageId: typeof payload.packageId === 'string' ? payload.packageId : null,
    totalPhp: Number.isFinite(totalPhp) ? totalPhp : null,
    validUntil: typeof payload.validUntil === 'string' ? payload.validUntil : null,
    title: typeof payload.title === 'string' ? payload.title : null,
  });

  if (!result.ok) {
    return Response.json(
      { error: result.code, message: result.message },
      { status: STATUS_BY_CODE[result.code] ?? 400 },
    );
  }
  return Response.json({
    ok: true,
    proposalId: result.proposalId,
    publicId: result.publicId,
    cardPosted: result.cardPosted,
    priceLabel: result.priceLabel,
  });
}
