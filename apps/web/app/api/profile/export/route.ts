import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildPersonalDataExport, personalDataExportResponse } from '@/lib/personal-data-export';

/**
 * RA 10173 data-export endpoint — the signed-in person's own file.
 *
 * Auth-gated via the Supabase session cookie. The user can only export their
 * OWN data: the subject is `supabase.auth.getUser()`, a server-verified session
 * identity, and this route accepts no input at all.
 *
 * The file itself is built by `lib/personal-data-export.ts` (lifted 2026-10-01
 * so an admin can prepare the same file for someone who asks the DPO —
 * app/admin/users/[userId]/export/route.ts). Every WHY note about what the file
 * contains, how each section is scoped and why three reads are privileged moved
 * with the code; read them there.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const exported = await buildPersonalDataExport(user, supabase, 'self');
  return personalDataExportResponse(exported, user.id);
}
