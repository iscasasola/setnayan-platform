import Link from 'next/link';

/**
 * VendorHubTabs — the tab strip of the 5-page vendor IA (owner 2026-07-12:
 * Overview · My Shop · My Customers · My Performance · On the Day, every
 * feature integrated as a tab on its hub). Server component, plain links —
 * ?tab= drives the hub page's dispatcher, so tabs deep-link and back-button
 * cleanly. Styling follows the Atelier chip language.
 */
export function VendorHubTabs({
  base,
  active,
  tabs,
}: {
  base: string;
  active: string;
  tabs: { key: string; label: string }[];
}) {
  return (
    <nav
      aria-label="Sections"
      className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-4 pt-6 sm:px-6 lg:px-8 xl:max-w-7xl 2xl:max-w-screen-2xl"
    >
      {tabs.map((t) => {
        const is = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.key === tabs[0]?.key ? base : `${base}?tab=${t.key}`}
            aria-current={is ? 'page' : undefined}
            className={
              is
                ? 'rounded-full bg-terracotta px-4 py-2 text-[13px] font-semibold text-white shadow-sm'
                : 'rounded-full border border-ink/10 bg-white/60 px-4 py-2 text-[13px] font-medium text-ink/65 backdrop-blur-sm transition hover:border-terracotta/40 hover:text-ink'
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
