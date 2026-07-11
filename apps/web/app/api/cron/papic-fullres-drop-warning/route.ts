import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { eventSkuActive } from '@/lib/entitlements';

// Pre-drop warning email (owner 2026-07-11). ~2 weeks before a couple's oldest
// Papic photo ages into the 90-day full-res-drop window, email them once:
// "your free full-res window is ending — download, connect Drive, or Keep
// Full-Res." Dedup via events.full_res_drop_warned_at. Skips Keep-Full-Res
// owners (they keep full-res). sendEmail no-ops gracefully if Resend isn't
// configured — we then DON'T stamp, so it retries once the key is set.
//
// Auth: Bearer <CRON_SECRET> (Vercel Cron) or x-cron-secret. Timing-safe, fail-closed.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const WARN_LEAD_DAYS = 14;

function retentionDays(): number {
  const n = Number(process.env.PAPIC_FULLRES_RETENTION_DAYS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 90;
}
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function handle(req: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET ?? '';
  if (!expected) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const authz = req.headers.get('authorization') ?? '';
  const bearer = authz.startsWith('Bearer ') ? authz.slice('Bearer '.length) : '';
  const headerSecret = req.headers.get('x-cron-secret') ?? '';
  const ok =
    (bearer.length > 0 && timingSafeEqual(bearer, expected)) ||
    (headerSecret.length > 0 && timingSafeEqual(headerSecret, expected));
  if (!ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const admin = createAdminClient();
  const days = retentionDays();
  // A photo captured before this cutoff is ~WARN_LEAD_DAYS from the drop window.
  const cutoff = new Date(
    Date.now() - (days - WARN_LEAD_DAYS) * 86_400_000,
  ).toISOString();

  // Events with a still-on-us PHOTO aging toward the window (photos only — clips
  // are never dropped).
  const [seat, guest] = await Promise.all([
    admin
      .from('papic_photos')
      .select('event_id')
      .eq('photo_type', 'photo')
      .is('full_res_dropped_at', null)
      .not('display_r2_key', 'is', null)
      .lt('captured_at', cutoff)
      .limit(4000),
    admin
      .from('papic_guest_captures')
      .select('event_id')
      .or('media_type.is.null,media_type.eq.photo')
      .is('full_res_dropped_at', null)
      .not('display_r2_key', 'is', null)
      .lt('captured_at', cutoff)
      .limit(4000),
  ]);
  const eventIds = [
    ...new Set(
      [...(seat.data ?? []), ...(guest.data ?? [])].map((r) => r.event_id as string),
    ),
  ];
  if (eventIds.length === 0) {
    return NextResponse.json({ ok: true, candidates: 0, sent: 0, skipped: 0 });
  }

  // Only events not yet warned.
  const { data: events } = await admin
    .from('events')
    .select('event_id, display_name, full_res_drop_warned_at')
    .in('event_id', eventIds)
    .is('full_res_drop_warned_at', null);

  let sent = 0;
  let skipped = 0;
  for (const ev of events ?? []) {
    const eventId = ev.event_id as string;
    // Keep-Full-Res owners keep their originals — no drop, no warning.
    if (await eventSkuActive(admin, eventId, 'HIGH_RES_ARCHIVE').catch(() => false)) {
      skipped += 1;
      continue;
    }
    // Resolve the couple's email (event_members couple → users.email).
    const { data: member } = await admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('member_type', 'couple')
      .limit(1)
      .maybeSingle();
    if (!member?.user_id) {
      skipped += 1;
      continue;
    }
    const { data: user } = await admin
      .from('users')
      .select('email')
      .eq('id', member.user_id as string)
      .maybeSingle();
    const email = (user?.email as string | null) ?? null;
    if (!email) {
      skipped += 1;
      continue;
    }

    const name = (ev.display_name as string | null) ?? 'your wedding';
    const res = await sendEmail({
      to: email,
      subject: `Your ${name} full-resolution photos — a quick heads-up`,
      text: `Hi! Your ${name} gallery on Setnayan stays online forever, free.\n\nIn about two weeks, we compress the copies we host to keep them light — your full-resolution originals live in your own Google Drive (if you connected it). Two things you can do before then:\n\n• Download your full-res photos any time from your gallery ("Download all").\n• Connect Google Drive so every original is saved to your own account automatically.\n• Or add Keep Full-Res so we hold every pristine original for you (₱999/year).\n\nEither way, nothing is lost — your online gallery keeps every photo. This is just a heads-up so you can grab the full-res if you'd like.\n\n— Setnayan`,
    });
    // Only mark warned when the email actually went (or the address is dead) —
    // if Resend isn't configured yet, leave it unwarned so it retries later.
    if (res.ok || res.reason === 'placeholder_recipient') {
      await admin
        .from('events')
        .update({ full_res_drop_warned_at: new Date().toISOString() })
        .eq('event_id', eventId);
      sent += res.ok ? 1 : 0;
      skipped += res.ok ? 0 : 1;
    } else {
      skipped += 1;
    }
  }

  return NextResponse.json({ ok: true, candidates: events?.length ?? 0, sent, skipped });
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
