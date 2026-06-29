import type { NextRequest } from 'next/server';
import { authVendorBearer } from '@/lib/api/vendor-bearer';
import { sendChatMessageCore, type SendMessageError } from '@/lib/chat-send';

// Native-facing plain-text send. The Expo app calls this with its Supabase
// session token; we scope a client to it and run sendChatMessageCore — the SAME
// accept-gate + couple-follow-up + FREE-vendor tier gate the web server action
// runs. No gating is re-implemented natively. Mirrors the Papic-gallery pattern.
export const dynamic = 'force-dynamic';

// Map the core's expected-gate codes to HTTP. 401 = auth; 403 = a gate the
// caller can't pass (declined / not accepted / FREE tier); 422 = bad payload;
// 404 = missing thread; 500 = an unexpected insert failure.
const STATUS_BY_CODE: Record<SendMessageError, number> = {
  empty: 422,
  too_long: 422,
  unauthenticated: 401,
  thread_not_found: 404,
  not_member: 403,
  declined: 403,
  followup_used: 403,
  not_accepted: 403,
  tier_free: 403,
  insert_failed: 500,
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params;
  const auth = await authVendorBearer(req);
  if (auth.response) return auth.response;

  let body = '';
  try {
    const json = (await req.json()) as { body?: unknown };
    body = typeof json.body === 'string' ? json.body : '';
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 422 });
  }

  const result = await sendChatMessageCore(auth.supabase, { threadId, body });
  if (!result.ok) {
    return Response.json(
      { error: result.code, message: result.message },
      { status: STATUS_BY_CODE[result.code] ?? 400 },
    );
  }
  return Response.json({ ok: true });
}
