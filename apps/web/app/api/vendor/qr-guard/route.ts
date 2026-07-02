import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { qrPayloadVerdict } from '@/lib/vendor-qr-media-guard';

/**
 * POST /api/vendor/qr-guard — verdicts for QR payloads the CLIENT decoded from
 * a picked file (QR-in-media guard, owner-locked 2026-07-03).
 *
 * Why this exists: the client can decode a QR from an image or a video frame,
 * but it CANNOT resolve a shortener redirect (CORS) — so it posts the decoded
 * payload strings here and the server runs the same redirect-hop resolution
 * the save-time gate uses. For the ≤30s showcase VIDEO this route is the only
 * pre-save check (no server-side frame extraction exists); for images it is a
 * fast-feedback layer in front of the authoritative save-time scan.
 *
 * This is an integrity gate, not a security boundary — a hostile client can
 * skip the client validator entirely; images are re-scanned server-side at
 * save time and the retro-scan + report path cover the rest.
 */

const MAX_PAYLOADS = 12;
const MAX_PAYLOAD_LEN = 2048;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }

  const rl = rateLimit(`qr-guard:${user.id}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many checks — give it a moment.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }

  let body: { payloads?: unknown };
  try {
    body = (await request.json()) as { payloads?: unknown };
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const payloads = Array.isArray(body.payloads)
    ? body.payloads
        .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
        .map((p) => p.slice(0, MAX_PAYLOAD_LEN))
        .slice(0, MAX_PAYLOADS)
    : [];
  if (payloads.length === 0) {
    return NextResponse.json({ invalid: [] }, { status: 200 });
  }

  const invalid: string[] = [];
  for (const p of payloads) {
    try {
      const verdict = await qrPayloadVerdict(p);
      if (verdict.invalid) invalid.push(p);
    } catch {
      // fail-open per payload — the save-time scan is the authoritative gate
    }
  }
  return NextResponse.json({ invalid }, { status: 200 });
}
