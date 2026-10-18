import { NextResponse, type NextRequest } from 'next/server';
import { createMoneyWriterClient } from '@/lib/supabase/admin';
import { handleAppStoreNotification } from '@/lib/iap/notifications.server';

/**
 * 🍎 App Store Server Notifications v2 — the URL the owner enters in App Store
 * Connect (App Information › App Store Server Notifications, Production AND
 * Sandbox). Apple POSTs `{ "signedPayload": "<JWS>" }`.
 *
 * No session, no shared secret: the payload is Apple-signed and verified
 * against Apple Root CA - G3 before a single field is read
 * (`lib/iap/notifications.server.ts`). The status code is Apple's retry signal.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const signedPayload = (body as { signedPayload?: unknown } | null)?.signedPayload;
  const result = await handleAppStoreNotification(createMoneyWriterClient(), signedPayload);
  if (result.http !== 200) console.warn('[app-store-notifications]', result.http, result.what);
  return NextResponse.json({ ok: result.http === 200 }, { status: result.http });
}
