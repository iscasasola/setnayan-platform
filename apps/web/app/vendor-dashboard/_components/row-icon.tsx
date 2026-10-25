import type { ComponentType, SVGProps } from 'react';

/**
 * A ROW'S ICON — the round mark at the left of a supplier list row (simpler supplier dashboard, the prototype's
 * look-and-feel pass: "icons on rows"). Decorative: the row's words carry the meaning. A soft wash of the app's
 * accent, so it reads in light and dark alike. Server-safe (no hooks), so a server list and a client fold both use it.
 */
export function RowIcon({ icon: Icon }: { icon: ComponentType<SVGProps<SVGSVGElement> & { strokeWidth?: number | string }> }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[color-mix(in_srgb,rgb(var(--sn-accent))_12%,transparent)] text-ink/75"
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
    </span>
  );
}
