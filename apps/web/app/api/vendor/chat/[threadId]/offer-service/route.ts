import type { NextRequest } from 'next/server';
import { authVendorBearer } from '@/lib/api/vendor-bearer';
import { offerServiceCore } from '@/lib/offer-service-core';

// Native-facing vendor cross-sell — offer one of the vendor's OWN active
// services back to the couple in a thread. Shares offerServiceCore with the web
// action; metadata only (never touches the token/accept flow).
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params;
  const auth = await authVendorBearer(req);
  if (auth.response) return auth.response;

  let vendorServiceId = '';
  try {
    const json = (await req.json()) as { vendorServiceId?: unknown };
    vendorServiceId = typeof json.vendorServiceId === 'string' ? json.vendorServiceId : '';
  } catch {
    return Response.json({ error: 'invalid_json', message: 'Couldn’t read your request.' }, { status: 422 });
  }

  const result = await offerServiceCore(auth.supabase, { threadId, vendorServiceId });
  switch (result.status) {
    case 'ok':
      return Response.json({ ok: true });
    case 'not_signed_in':
      return Response.json({ error: result.status, message: 'Sign in again to continue.' }, { status: 401 });
    case 'not_owner':
      return Response.json({ error: result.status, message: 'This conversation isn’t yours.' }, { status: 403 });
    case 'invalid_service':
      return Response.json(
        { error: result.status, message: 'That service isn’t available to offer anymore.' },
        { status: 422 },
      );
    default:
      return Response.json({ error: 'error', message: result.message }, { status: 400 });
  }
}
