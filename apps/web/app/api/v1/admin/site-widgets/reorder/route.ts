import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * POST /api/v1/admin/site-widgets/reorder
 *
 * Body: { page: string, ordered_widget_ids: string[] }
 *
 * Updates display_order for every widget on the supplied page so the array
 * order matches `ordered_widget_ids` (1-indexed). The supabase-js client
 * doesn't support true multi-statement transactions, so we issue one
 * UPDATE per affected row — each row's display_order is set to the value
 * we computed up front (no read-modify-write race) and a single
 * `admin_audit_log` row captures the before/after state.
 *
 * Per 0023 § 3.10 + § 4.3 — single-admin authority, audit-logged via
 * `site_widgets_reorder`.
 */
function json(status: number, body: unknown): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function requireAdminUserId(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: json(401, { error: { code: 'unauthenticated', message: 'Sign in required.' } }) };
  }
  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    return { ok: false, response: json(403, { error: { code: 'forbidden', message: 'Admin required.' } }) };
  }
  return { ok: true, userId: user.id };
}

export async function POST(req: Request) {
  const auth = await requireAdminUserId();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: { code: 'invalid_json', message: 'Body must be JSON.' } });
  }
  const page = (body as { page?: unknown }).page;
  const ordered = (body as { ordered_widget_ids?: unknown }).ordered_widget_ids;
  if (typeof page !== 'string' || !page.trim()) {
    return json(400, {
      error: { code: 'invalid_request', message: 'page must be a non-empty string.' },
    });
  }
  if (!Array.isArray(ordered) || ordered.length === 0) {
    return json(400, {
      error: {
        code: 'invalid_request',
        message: 'ordered_widget_ids must be a non-empty array.',
      },
    });
  }
  if (!ordered.every((id) => typeof id === 'string' && id.length > 0)) {
    return json(400, {
      error: {
        code: 'invalid_request',
        message: 'ordered_widget_ids entries must be non-empty strings.',
      },
    });
  }
  // No duplicates allowed.
  if (new Set(ordered).size !== ordered.length) {
    return json(400, {
      error: { code: 'invalid_request', message: 'ordered_widget_ids must be unique.' },
    });
  }

  const admin = createAdminClient();

  // Confirm every supplied widget actually belongs to the page — we don't
  // want a stale client to silently move widgets across pages.
  const { data: existingRows, error: readErr } = await admin
    .from('site_widgets')
    .select('widget_id,display_order')
    .eq('page', page);
  if (readErr) {
    // Sanitize → admin API still leaks if `error.message` carries Postgres
    // detail. Full error → Sentry + Vercel Functions. Pre-pilot audit
    // cleanup 2026-05-30.
    logQueryError('POST reorder (site_widgets read)', readErr, { page });
    return json(500, {
      error: {
        code: 'db_error',
        message: 'Could not read site widgets right now. Try again in a moment.',
      },
    });
  }
  const existing = new Map<string, number>(
    (existingRows ?? []).map((r) => [r.widget_id, r.display_order]),
  );
  const unknown = (ordered as string[]).filter((id) => !existing.has(id));
  if (unknown.length > 0) {
    return json(400, {
      error: {
        code: 'unknown_widget_ids',
        message: `Widget ids not on this page: ${unknown.join(', ')}.`,
      },
    });
  }
  // We allow a partial reorder (subset of widgets on the page) but only as
  // long as the request still results in unique display_order values; the
  // simplest contract is "send every widget on the page". Enforce that.
  if (ordered.length !== existing.size) {
    return json(400, {
      error: {
        code: 'invalid_request',
        message:
          'ordered_widget_ids must include every widget on the page (counts must match).',
      },
    });
  }

  const orderedIds = ordered as string[];

  // Compute the new order map and the before/after snapshot for audit.
  const nextOrder = new Map<string, number>();
  orderedIds.forEach((id, idx) => nextOrder.set(id, idx + 1));
  const beforeSnap = Object.fromEntries(existing);
  const afterSnap = Object.fromEntries(nextOrder);

  // Audit row before any UPDATE so the trail is intact if a row fails.
  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'site_widgets_reorder',
    target_table: 'site_widgets',
    target_id: page,
    before_json: beforeSnap,
    after_json: afterSnap,
    actor_user_id: auth.userId,
  });
  if (auditErr) {
    logQueryError('POST reorder (admin_audit_log)', auditErr, { page });
    return json(500, {
      error: {
        code: 'audit_failed',
        message: 'Could not record audit row. Reorder did not apply.',
      },
    });
  }

  // Apply the UPDATEs. To avoid transient unique-constraint violations if
  // we later add a (page, display_order) unique index, we first park every
  // affected row at a negative offset, then assign the final values.
  const nowIso = new Date().toISOString();
  const PARK_OFFSET = -1000;

  for (const id of orderedIds) {
    const { error } = await admin
      .from('site_widgets')
      .update({
        display_order: PARK_OFFSET - (nextOrder.get(id) ?? 0),
        updated_at: nowIso,
        updated_by_admin_id: auth.userId,
      })
      .eq('widget_id', id);
    if (error) {
      logQueryError('POST reorder (park step)', error, { page, widget_id: id });
      return json(500, {
        error: {
          code: 'db_error',
          message: 'Reorder failed mid-park. Refresh and try again.',
        },
      });
    }
  }
  for (const id of orderedIds) {
    const { error } = await admin
      .from('site_widgets')
      .update({
        display_order: nextOrder.get(id),
        updated_at: nowIso,
        updated_by_admin_id: auth.userId,
      })
      .eq('widget_id', id);
    if (error) {
      logQueryError('POST reorder (final step)', error, { page, widget_id: id });
      return json(500, {
        error: {
          code: 'db_error',
          message: 'Reorder failed during final step. Refresh and try again.',
        },
      });
    }
  }

  if (page === 'home') revalidatePath('/');
  revalidatePath('/admin/website');

  return json(200, { data: { page, ordered_widget_ids: orderedIds } });
}
