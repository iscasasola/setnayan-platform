import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readTemplateRows, type IncludedTemplate } from '@/lib/included-templates';
import { QuickFormsEditor } from './quick-forms-editor';

/**
 * 📋 A service's "Quick Forms" — Setnayan's starting What's included templates (DECISION_LOG 2026-11-17, 4906a9a8 +
 * 7596f63a; 17 Nov "no new admin page; two settings on the service panel"). Mounted inside the service's panel. One
 * read with the service role, like the rest of the panel. A refused read is SAID — never shown as "no templates".
 */
export async function QuickFormsPane({ canonical, label }: { canonical: string; label: string }) {
  const { data, error } = await createAdminClient()
    .from('service_included_templates')
    .select('template_id, name, rows, is_proposal, sort_order')
    .eq('canonical_service', canonical)
    .order('sort_order')
    .order('name');
  if (error) {
    logQueryError('QuickFormsPane', error, { canonical_service: canonical }, 'graceful_degrade');
    return (
      <p role="alert" className="text-sm text-ink/70" data-quick-forms-unread="">
        Couldn’t read the Quick Forms. Reload in a moment.
      </p>
    );
  }
  const templates: IncludedTemplate[] = ((data ?? []) as { template_id: string; name: string; rows: unknown; is_proposal: boolean }[]).map((t) => ({
    id: t.template_id,
    name: t.name,
    rows: readTemplateRows(t.rows),
    isProposal: t.is_proposal === true,
  }));
  return <QuickFormsEditor canonical={canonical} label={label} templates={templates} />;
}
