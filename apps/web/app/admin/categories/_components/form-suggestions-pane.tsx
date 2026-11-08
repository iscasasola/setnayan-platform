import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { FormSuggestionsEditor } from './form-suggestions-editor';

/**
 * 💡 A tile's "Suggested forms" (THE ONE BUILD · C3 Forms; DECISION_LOG 2026-10-28 "SUGGESTED FOR YOUR SERVICE").
 * Mounted inside the tile's panel. Ships EMPTY (no seed) and says so. Read with the service role, like the rest of
 * the panel — two reads: this tile's suggestions, and every template (to suggest one).
 */
export async function FormSuggestionsPane({ categoryId, categoryLabel }: { categoryId: string; categoryLabel: string }) {
  const admin = createAdminClient();
  const [sugRes, tplRes] = await Promise.all([
    admin.from('category_form_suggestions').select('template_key, sort_order').eq('category_id', categoryId).order('sort_order'),
    admin.from('form_templates').select('template_key, title, items, is_active').order('title'),
  ]);
  if (sugRes.error || tplRes.error) {
    logQueryError('FormSuggestionsPane', (sugRes.error ?? tplRes.error)!, { category_id: categoryId }, 'graceful_degrade');
    return (
      <p role="alert" className="text-sm text-ink/70">
        Couldn’t read the suggested forms. Reload in a moment.
      </p>
    );
  }
  const templates = ((tplRes.data ?? []) as { template_key: string; title: string; items: unknown; is_active: boolean }[]).map((t) => ({
    key: t.template_key,
    title: t.title,
    count: Array.isArray(t.items) ? t.items.length : 0,
    active: t.is_active,
  }));
  return (
    <FormSuggestionsEditor
      categoryId={categoryId}
      categoryLabel={categoryLabel}
      suggested={((sugRes.data ?? []) as { template_key: string }[]).map((s) => s.template_key)}
      templates={templates}
    />
  );
}
