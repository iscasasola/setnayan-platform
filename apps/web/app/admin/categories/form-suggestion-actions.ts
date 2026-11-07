'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/require-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { FORM_ANSWER_TYPES } from '@/lib/vendor-forms';
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
    await admin.from('admin_audit_log').insert({
      action: 'forms.template_new',
      target_table: 'form_templates',
      target_id: key,
      before_json: null,
      after_json: { title, items: items.length },
      actor_user_id: user.userId,
    });
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
      const { data: last } = await admin
        .from('category_form_suggestions')
        .select('sort_order')
        .eq('category_id', categoryId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      const sort_order = ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1;
      const { error } = await admin.from('category_form_suggestions').insert({ category_id: categoryId, template_key: key, sort_order });
      if (error) return { status: 'error', message: error.message };
    } else {
      const { error } = await admin.from('category_form_suggestions').delete().eq('category_id', categoryId).eq('template_key', key);
      if (error) return { status: 'error', message: error.message };
    }
    await admin.from('admin_audit_log').insert({
      action: `forms.${op}`,
      target_table: 'category_form_suggestions',
      target_id: `${categoryId}:${key}`,
      before_json: null,
      after_json: { category_id: categoryId, template_key: key },
      actor_user_id: user.userId,
    });
    revalidatePath(CATEGORIES_PATH);
    return { status: 'ok', message: op === 'suggest_add' ? 'Suggested here.' : 'No longer suggested here.' };
  }

  return { status: 'error', message: 'Unknown action.' };
}
