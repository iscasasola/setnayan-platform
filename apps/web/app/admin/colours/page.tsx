import { PageMasthead } from '@/app/_components/page-masthead';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { parseAppColours } from '@/lib/app-colours';
import { ColoursEditor } from './_components/colours-editor';
import { saveAppColours } from './actions';

export const metadata = {
  title: 'Colours · Admin',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * /admin/colours — THE APP'S COLOURS, BY JOB (owner approved the prototype 12 Nov 2026: corpus
 * `Design_App_Colours_2026-11-12/app-colours-admin.html`; DECISION_LOG 2026-11-12).
 *
 * Reads the saved set with the UNCACHED service-role client, so the page shows the truth even inside the layout's
 * five-minute cache window. A refused read is SAID, never shown as "today's colours" — the editor would otherwise
 * offer a Save over a set it never saw.
 */
export default async function AdminColoursPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.from('platform_settings').select('app_colours').eq('id', 1).maybeSingle();
  const raw = (data as { app_colours?: unknown } | null)?.app_colours ?? null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <PageMasthead titleNode="Colours" />
      {error ? (
        <p role="alert" className="text-sm text-danger-700">
          Couldn&apos;t read the saved colours — {error.message}. Nothing here can be saved until it reads; reload in a moment.
        </p>
      ) : (
        <ColoursEditor action={saveAppColours} initial={parseAppColours(raw)} />
      )}
    </div>
  );
}
