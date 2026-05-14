import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * PATCH /api/v1/admin/site-widgets/:widget_id
 *
 * Single-admin authority per 0023 § 4.3. Updates is_enabled on a single
 * widget row. Audit-logged as `site_widgets_toggle` with before/after JSON.
 *
 * V1 admin-editable fields: is_enabled only. display_order is changed via
 * the bulk reorder endpoint to keep the per-page ordering consistent.
 *
 * Body: { is_enabled: boolean }
 *
 * 401 unauthenticated · 403 not admin · 404 widget not found · 200 ok.
 */
type Params = { params: Promise<{ widget_id: string }> };

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

export async function PATCH(req: Request, { params }: Params) {
  const { widget_id } = await params;
  if (!widget_id || typeof widget_id !== 'string') {
    return json(400, { error: { code: 'invalid_request', message: 'Missing widget_id.' } });
  }

  const auth = await requireAdminUserId();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: { code: 'invalid_json', message: 'Body must be JSON.' } });
  }
  const isEnabledRaw = (body as { is_enabled?: unknown })?.is_enabled;
  if (typeof isEnabledRaw !== 'boolean') {
    return json(400, {
      error: { code: 'invalid_request', message: 'is_enabled must be a boolean.' },
    });
  }

  const admin = createAdminClient();

  // Read the current row so we can audit-log the before state.
  const { data: existing, error: readErr } = await admin
    .from('site_widgets')
    .select('widget_id,page,is_enabled,display_order')
    .eq('widget_id', widget_id)
    .maybeSingle();
  if (readErr) {
    return json(500, { error: { code: 'db_error', message: readErr.message } });
  }
  if (!existing) {
    return json(404, { error: { code: 'widget_not_found', message: 'Widget not found.' } });
  }
  if (existing.is_enabled === isEnabledRaw) {
    // Idempotent no-op — return the current row without an audit entry.
    return json(200, { data: existing });
  }

  // Audit row first, then the actual UPDATE.
  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'site_widgets_toggle',
    target_table: 'site_widgets',
    target_id: widget_id,
    before_json: { is_enabled: existing.is_enabled },
    after_json: { is_enabled: isEnabledRaw },
    actor_user_id: auth.userId,
  });
  if (auditErr) {
    return json(500, { error: { code: 'audit_failed', message: auditErr.message } });
  }

  const { data: updated, error: updErr } = await admin
    .from('site_widgets')
    .update({
      is_enabled: isEnabledRaw,
      updated_at: new Date().toISOString(),
      updated_by_admin_id: auth.userId,
    })
    .eq('widget_id', widget_id)
    .select('widget_id,page,display_order,is_enabled,gate_type,config,updated_at,updated_by_admin_id')
    .maybeSingle();
  if (updErr) {
    return json(500, { error: { code: 'db_error', message: updErr.message } });
  }

  // Cache invalidation — the marketing page that renders this widget.
  if (existing.page === 'home') revalidatePath('/');
  revalidatePath('/admin/website');

  return json(200, { data: updated });
}
