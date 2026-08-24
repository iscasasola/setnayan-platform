// Ugat Studio surface — the body of the former menus page,
// re-homed 2026-07-10. actions/_components stay in /admin/menus; the legacy
// route is now a redirect into /admin/ugat?tab=.
import { PageMasthead } from '@/app/_components/page-masthead';
import { getResolvedNavSlots } from '@/lib/nav-registry';
import { NAV_ICON_NAMES } from '@/lib/nav-icons';
import { MenuRegistryEditor } from '@/app/admin/menus/_components/menu-registry-editor';

/**
 * Setnayan HQ · Menus & icons — the single source of truth for the NAME (label)
 * and ICON of every menu/route across Setnayan, for all account types. Defaults
 * live in code (lib/nav-registry-defaults.ts); edits here write sparse overrides
 * (lib/nav-registry — public.nav_slot_override). Single-admin + audit.
 */

export async function MenusSurface() {
  const slots = await getResolvedNavSlots();

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* The tab strip already says "Menus". The name stays in the document
          at zero pixels.
          ⚖ The sentence survives: it is the only place that says blanking a
          name — not deleting the row — is how you get the built-in default
          back, and that a rename here reaches every doorway at once. */}
      <PageMasthead title="Menus & icons" />
      <p className="mb-6 mt-1 max-w-2xl text-sm text-ink/70">
        The source for the name and icon of every menu across Setnayan — customer, vendor, admin,
        and the public site. Rename a menu, pick a Lucide icon, or upload a custom image. Blank a
        name or hit reset to return to the built-in default.
      </p>

      <MenuRegistryEditor slots={slots} iconNames={[...NAV_ICON_NAMES]} />
    </div>
  );
}
