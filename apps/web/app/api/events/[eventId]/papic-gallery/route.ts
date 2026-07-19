import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchPapicGallery } from '@/lib/papic-gallery';

// Thin native-facing endpoint for the couple's Papic gallery. The Expo app can't
// presign R2 (no server creds on the device), so it calls this with its Supabase
// SESSION token; we scope a client to that token so every read runs under the
// couple's RLS (papic_photos_couple_full + papic_guest_captures_couple_read) —
// the exact same gated, presigned feed the web /studio/papic page renders via
// fetchPapicGallery (moderation/hidden/expiry/consent gating, clips→poster,
// untagged-still-delivered). A foreign eventId simply returns no rows.
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;

  const authz = req.headers.get('authorization') ?? '';
  const token = authz.toLowerCase().startsWith('bearer ') ? authz.slice(7).trim() : '';
  if (!token) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return Response.json({ error: 'server_misconfigured' }, { status: 500 });

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const photos = await fetchPapicGallery(supabase, eventId);
  return Response.json({ photos });
}
