'use client';

import { Plus } from 'lucide-react';
import { ActionButton } from '@/components/action-button';

/**
 * 🛒 "Add one" on the Plan's Ultra Add-on row (owner 2026-11-19, the ONE add-on). A client part because the house
 * button takes an icon COMPONENT, which a server component cannot hand across. The form posts only the kind; the
 * server action (`buyUltraAddOn`, passed in) reads the shop, its plan and the catalogue price itself.
 */
export function UltraAddOnButton({ action }: { action: (formData: FormData) => Promise<void> }) {
  return (
    <form action={action} data-ultra-addon-buy="">
      <input type="hidden" name="addon" value="ultra" />
      <ActionButton tone="brand" quiet icon={Plus} label="Add one" type="submit" />
    </form>
  );
}
