import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DatesRow } from '../customers/_components/dates-row';
import { SUPPLIER_HELP_ROWS } from '../settings/settings-rows';

export const metadata = { title: 'Help · Supplier' };

/**
 * /vendor-dashboard/help — HELP for a supplier, five doors (simpler supplier dashboard step 6; prototype
 * SCREENS.help, reached from Settings › Help). Every row opens a page that already exists: the supplier-only fee
 * article (#6528), the help centre, Shop › How clients pay you, Disputes, the contact form. No reads beyond sign-in.
 */
export default async function VendorHelpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10" data-supplier-help="">
      <h1 className="sn-h1">Help</h1>
      <div className="mt-3">
        {SUPPLIER_HELP_ROWS.map((r) => (
          <DatesRow key={r.key} data={`help-${r.key}`} title={r.title} line={r.line} href={r.href} />
        ))}
      </div>
    </div>
  );
}
