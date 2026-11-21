'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/require-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { FORM_ANSWER_TYPES } from '@/lib/vendor-forms';
import { cleanTemplateName, parseTemplateText, TEMPLATE_NAME_MAX } from '@/lib/included-templates';
import { CATEGORIES_PATH } from './_components/back';

/**
 * 💡 "SUGGESTED FOR YOUR SERVICE" — the admin side (DECISION_LOG 2026-10-28 "SUGGESTED FOR YOUR SERVICE — APPROVED":
 * *"The suggestion data lives in Admin › Categories (one source, per service), never hard-coded"*; THE ONE BUILD §9 #13:
 * ships EMPTY, no invented seed).
 *
 * ONE dispatcher (the server-action budget sits at its ceiling), three ops:
 *   • `template_new`   — a form template: a title + its question lines (one per line; "Question | type | a, b, c").
 *   • `suggest_add`    — this tile suggests that template (in order).
 *   • `suggest_remove` — it no longer does.
 * A supplier's "Use this" COPIES a template, so nothing here ever rewrites a shop's own form.
 * Written with the service role (no browser holds a write grant on either table); every write is audited.
 */
export type FormSuggestionsState = { status: 'idle' } | { status: 'ok'; message: string } | { status: 'error'; message: string };

const TYPE_KEYS = new Set<string>(FORM_ANSWER_TYPES.map((t) => t.key));
const TYPE_BY_LABEL = new Map<string, string>(FORM_ANSWER_TYPES.map((t) => [t.label.toLowerCase(), t.key]));

/** "Question | type | a, b, c" per line → template items (question lines only). */
function parseTemplateLines(text: string) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 60)
    .map((line) => {
      const [prompt, rawType, rawOptions] = line.split('|').map((x) => x.trim());
      const t = (rawType ?? '').toLowerCase();
      const answer_type = TYPE_KEYS.has(t) ? t : (TYPE_BY_LABEL.get(t) ?? 'short_answer');
      const options = (rawOptions ?? '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
      return { kind: 'question', prompt: (prompt ?? '').slice(0, 200), answer_type, required: false, options };
    })
    .filter((i) => i.prompt.length > 0);
}

function keyOf(title: string): string {
  const k = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
  return /^[a-z]/.test(k) ? k : `form_${k}`;
}

export async function formSuggestionsAction(_prev: FormSuggestionsState, formData: FormData): Promise<FormSuggestionsState> {
  const user = await requireAdmin();
  const admin = createAdminClient();
  const op = String(formData.get('op') ?? '');
  const categoryId = String(formData.get('category_id') ?? '');

  if (op === 'template_new') {
    const title = String(formData.get('title') ?? '').trim().slice(0, 120);
    const items = parseTemplateLines(String(formData.get('lines') ?? ''));
    if (!title) return { status: 'error', message: 'Name the form.' };
    if (items.length === 0) return { status: 'error', message: 'Add at least one question line.' };
    const key = `${keyOf(title)}_${Date.now().toString(36)}`.slice(0, 63);
    const { error } = await admin
      .from('form_templates')
      .insert({ template_key: key, title, items, updated_by: user.userId, updated_at: new Date().toISOString() });
    if (error) return { status: 'error', message: error.message };
    const { error: auditErr } = await admin.from('admin_audit_log').insert({
      action: 'forms.template_new',
      target_table: 'form_templates',
      target_id: key,
      before_json: null,
      after_json: { title, items: items.length },
      actor_user_id: user.userId,
    });
    if (auditErr) console.error('[formSuggestionsAction] audit row not written:', auditErr.message);
    if (categoryId) {
      const { error: sErr } = await admin.from('category_form_suggestions').insert({ category_id: categoryId, template_key: key, sort_order: 0 });
      if (sErr) return { status: 'error', message: `Saved the form, but couldn’t suggest it here: ${sErr.message}` };
    }
    revalidatePath(CATEGORIES_PATH);
    return { status: 'ok', message: categoryId ? 'Saved and suggested here.' : 'Saved.' };
  }

  if (op === 'suggest_add' || op === 'suggest_remove') {
    const key = String(formData.get('template_key') ?? '');
    if (!categoryId || !key) return { status: 'error', message: 'Missing form.' };
    if (op === 'suggest_add') {
      const { data: last, error: lastErr } = await admin
        .from('category_form_suggestions')
        .select('sort_order')
        .eq('category_id', categoryId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastErr) return { status: 'error', message: lastErr.message };
      const sort_order = ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1;
      const { error } = await admin.from('category_form_suggestions').insert({ category_id: categoryId, template_key: key, sort_order });
      if (error) return { status: 'error', message: error.message };
    } else {
      const { error } = await admin.from('category_form_suggestions').delete().eq('category_id', categoryId).eq('template_key', key);
      if (error) return { status: 'error', message: error.message };
    }
    const { error: auditErr } = await admin.from('admin_audit_log').insert({
      action: `forms.${op}`,
      target_table: 'category_form_suggestions',
      target_id: `${categoryId}:${key}`,
      before_json: null,
      after_json: { category_id: categoryId, template_key: key },
      actor_user_id: user.userId,
    });
    if (auditErr) console.error('[formSuggestionsAction] audit row not written:', auditErr.message);
    revalidatePath(CATEGORIES_PATH);
    return { status: 'ok', message: op === 'suggest_add' ? 'Suggested here.' : 'No longer suggested here.' };
  }

  // ── 📋 QUICK FORMS — Setnayan's starting "What's included" templates for ONE service (DECISION_LOG 2026-11-17,
  // 4906a9a8 + 7596f63a: "allow us to add and delete templates for each"). Same dispatcher (the budget), same
  // service-role write, same audit. A supplier's Load COPIES the rows onto a card, so an edit or a delete here never
  // rewrites a card. Rows carry no price — refused here and by the table's CHECK.
  if (op === 'included_new' || op === 'included_save' || op === 'included_delete') {
    const canonical = String(formData.get('canonical_service') ?? '');
    if (!/^[a-z][a-z0-9_]{0,79}$/.test(canonical)) return { status: 'error', message: 'Missing service.' };
    const templateId = String(formData.get('template_id') ?? '');
    if (op !== 'included_new' && !/^[0-9a-f-]{36}$/i.test(templateId)) return { status: 'error', message: 'Missing template.' };

    if (op === 'included_delete') {
      const { data: gone, error } = await admin
        .from('service_included_templates')
        .delete()
        .eq('template_id', templateId)
        .eq('canonical_service', canonical)
        .select('name, rows')
        .maybeSingle();
      if (error) return { status: 'error', message: error.message };
      if (!gone) return { status: 'error', message: 'That template is already gone.' };
      const { error: auditErr } = await admin.from('admin_audit_log').insert({
        action: 'quick_forms.delete',
        target_table: 'service_included_templates',
        target_id: templateId,
        before_json: { canonical_service: canonical, ...(gone as Record<string, unknown>) },
        after_json: null,
        actor_user_id: user.userId,
      });
      if (auditErr) console.error('[formSuggestionsAction] audit row not written:', auditErr.message);
      revalidatePath(CATEGORIES_PATH);
      return { status: 'ok', message: `Deleted “${(gone as { name: string }).name}”. Cards that used it keep their lines.` };
    }

    const name = cleanTemplateName(formData.get('name'));
    if (!name) return { status: 'error', message: `Name the template in up to ${TEMPLATE_NAME_MAX} characters.` };
    const parsed = parseTemplateText(String(formData.get('rows') ?? ''));
    if (!parsed.ok) return { status: 'error', message: parsed.error };
    const now = new Date().toISOString();
    const write =
      op === 'included_new'
        ? admin
            .from('service_included_templates')
            .insert({ canonical_service: canonical, name, rows: parsed.rows, source: 'admin', is_proposal: false, updated_by: user.userId, updated_at: now })
            .select('template_id')
            .single()
        : // An admin's edit makes it Setnayan's own: it is no longer a proposal waiting for review.
          admin
            .from('service_included_templates')
            .update({ name, rows: parsed.rows, is_proposal: false, updated_by: user.userId, updated_at: now })
            .eq('template_id', templateId)
            .eq('canonical_service', canonical)
            .select('template_id')
            .single();
    const { data: saved, error } = await write;
    if (error) {
      return { status: 'error', message: error.code === '23505' ? `“${name}” is already a template of this service.` : error.message };
    }
    const { error: auditErr } = await admin.from('admin_audit_log').insert({
      action: op === 'included_new' ? 'quick_forms.new' : 'quick_forms.save',
      target_table: 'service_included_templates',
      target_id: (saved as { template_id: string }).template_id,
      before_json: null,
      after_json: { canonical_service: canonical, name, rows: parsed.rows.length },
      actor_user_id: user.userId,
    });
    if (auditErr) console.error('[formSuggestionsAction] audit row not written:', auditErr.message);
    revalidatePath(CATEGORIES_PATH);
    return { status: 'ok', message: op === 'included_new' ? `Added “${name}”.` : `Saved “${name}”.` };
  }

  return { status: 'error', message: 'Unknown action.' };
}
