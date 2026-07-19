import { NextResponse, type NextRequest } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@/lib/supabase/server';
import { isAdminProfile } from '@/lib/demo-mode';
import { getNpcDocument } from '@/lib/npc-documents';

/**
 * GET /admin/data-privacy/documents/[doc]
 *
 * Streams a bundled NPC submission PDF (apps/web/assets/npc-docs/, traced via
 * outputFileTracingIncludes). ADMIN-ONLY — these are internal compliance
 * documents; route handlers aren't covered by the /admin layout guard, so we
 * re-check admin here and 404 (not 403) for everyone else to avoid leaking the
 * endpoint. The `[doc]` param is resolved through the manifest allow-list —
 * the filename is NEVER built from raw input, so there is no path traversal.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ doc: string }> },
): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Not found', { status: 404 });

  const { data: profile } = await supabase
    .from('users')
    .select('account_type, is_internal, is_team_member')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!isAdminProfile(profile)) return new NextResponse('Not found', { status: 404 });

  const { doc } = await params;
  const entry = getNpcDocument(doc);
  if (!entry) return new NextResponse('Not found', { status: 404 });

  try {
    // Literal base dir + allow-listed filename (never raw input) → safe join.
    const abs = path.join(process.cwd(), 'assets', 'npc-docs', entry.file);
    const bytes = await readFile(abs);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${entry.file}"`,
        'Content-Length': String(bytes.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
