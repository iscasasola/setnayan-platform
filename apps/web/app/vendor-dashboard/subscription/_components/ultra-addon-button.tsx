'use client';

import { Plus, RotateCw } from 'lucide-react';
import { ActionButton } from '@/components/action-button';

/**
 * 🛒 "Add one" on the Plan's Ultra Add-on row (owner 2026-11-19, the ONE add-on). A client part because the house
 * button takes an icon COMPONENT, which a server component cannot hand across. The form posts only the kind; the
 * server action (`buyUltraAddOn`, passed in) reads the shop, its plan and the catalogue price itself.
 */
export function UltraAddOnButton({
  action,
  renewOrderId = null,
}: {
  action: (formData: FormData) => Promise<void>;
  /** 🔁 Set → this button RENEWS that add-on (its window moves on 28 days from its own end); unset → "Add one". */
  renewOrderId?: string | null;
}) {
  return (
    <form action={action} data-ultra-addon-buy={renewOrderId ? 'renew' : ''}>
      <input type="hidden" name="addon" value="ultra" />
      {renewOrderId ? <input type="hidden" name="renew" value={renewOrderId} /> : null}
      <ActionButton
        tone="brand"
        quiet
        icon={renewOrderId ? RotateCw : Plus}
        label={renewOrderId ? 'Renew' : 'Add one'}
        type="submit"
      />
    </form>
  );
}
