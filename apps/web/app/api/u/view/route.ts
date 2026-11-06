/**
 * POST /api/u/view — the public profile / chapter view beacon.
 *
 * ── WHY A ROUTE AND NOT THE SERVER ACTION IT REPLACES (2026-10-13) ─────────
 * `recordProfileView` / `recordChapterView` were server actions, and both set
 * the dedup cookie. In Next 15 a server action that SETS A COOKIE makes the
 * server re-render the current page and stream the new tree back — so every
 * fresh view of `/u/<slug>` paid for a SECOND full render of the profile, and
 * that refreshed tree (views N+1) landed while the page was still hydrating
 * the first one (views N). React hydrated "N" against "N+1" and threw error
 * #418 on every first visit — measured on production /u/icecasa and
 * /u/ana-at-marco by the live quality sweep (item 4): server HTML "10 views",
 * hydrated client "11 views", same page load.
 *
 * A route handler sets the same cookie and runs the same atomic RPC with no
 * re-render at all — the shape `/api/std/view` already uses. The count a
 * visitor sees is the one the page was rendered with; theirs shows next load.
 *
 * Privacy unchanged: aggregate counters only (no per-viewer row, no PII); the
 * dedup list is a first-party httpOnly rolling cookie on the viewer's device.
 * The increment RPCs self-gate (never inflate a draft/hidden target).
 */
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days
const VIEW_DEDUP_CAP = 60;
const COOKIE = { chapter: 'sn_vc', profile: 'sn_vp' } as const;

export async function POST(req: Request) {
  // Always 200 — a beacon never surfaces an error and never says whether a target exists.
  const ok = NextResponse.json({ ok: true });

  let kind: 'chapter' | 'profile' | null = null;
  let id = '';
  try {
    const body: unknown = await req.json();
    if (body && typeof body === 'object') {
      const b = body as { kind?: unknown; id?: unknown };
      if (b.kind === 'chapter' || b.kind === 'profile') kind = b.kind;
      if (typeof b.id === 'string') id = b.id.trim();
    }
  } catch {
    /* no body → no-op */
  }
  if (!kind || !id || id.length > 100) return ok;

  const name = COOKIE[kind];
  const store = await cookies();
  const seen = (store.get(name)?.value ?? '').split(',').filter(Boolean);
  if (seen.includes(id)) return ok;

  try {
    const admin = createAdminClient();
    const { error } =
      kind === 'chapter'
        ? await admin.rpc('increment_chapter_view' as never, { p_public_id: id } as never)
        : await admin.rpc('increment_profile_view' as never, { p_user_id: id } as never);
    if (error) console.error(`[supabase-error] app/api/u/view/route.ts · rpc:increment_${kind}_view`, error);
  } catch {
    /* best-effort — a lost view never breaks anything */
  }

  ok.cookies.set({
    name,
    value: [...seen, id].slice(-VIEW_DEDUP_CAP).join(','),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: VIEW_COOKIE_MAX_AGE,
  });
  return ok;
}
