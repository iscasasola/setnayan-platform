import { getResolvedNavSlots } from '@/lib/nav-registry';
import { NAV_ICON_NAMES } from '@/lib/nav-icons';
import { MenuRegistryEditor } from './_components/menu-registry-editor';

/**
 * Setnayan HQ · Menus & icons — the single source of truth for the NAME (label)
 * and ICON of every menu/route across Setnayan, for all account types. Defaults
 * live in code (lib/nav-registry-defaults.ts); edits here write sparse overrides
 * (lib/nav-registry — public.nav_slot_override). Single-admin + audit.
 */

export const dynamic = 'force-dynamic';

export default async function AdminMenusPage() {
  const slots = await getResolvedNavSlots();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Menus &amp; icons</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink/60">
          The source for the name and icon of every menu across Setnayan — customer, vendor, admin,
          and the public site. Rename a menu, pick a Lucide icon, or upload a custom image. Blank a
          name or hit reset to return to the built-in default.
        </p>
      </header>

      <MenuRegistryEditor slots={slots} iconNames={[...NAV_ICON_NAMES]} />
    </div>
  );
}
