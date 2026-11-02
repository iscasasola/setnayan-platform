'use client';

import { useRouter } from 'next/navigation';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

/**
 * The service-scope dropdown of My Performance — "All services" + one line per active service, ONE shared `PickMenu`
 * at every count (owner 2026-10-30 "ONE SELECTOR FOR EVERY PAGE"; house rule "every choice is one dropdown"). It
 * replaced a pill tablist (≤4 services) and a native `<select>` (5+). A pick goes to that option's address (built by
 * the server, momentum window kept), so the scope is a link and Back works.
 * 🔒 performance/the-pickers-are-one-dropdown.test.ts
 */
export function ServiceScopeSelectClient({
  value,
  options,
}: {
  /** The picked option's key — '' = All services. */
  value: string;
  options: ReadonlyArray<{ key: string; label: string; href: string }>;
}) {
  const router = useRouter();
  return (
    <PickMenu
      label="Filter performance by service"
      value={value}
      options={options.map(({ key, label }) => ({ key, label }))}
      compact
      className="!min-h-11"
      dataAttr="data-performance-service"
      onPick={(key) => {
        const hit = options.find((o) => o.key === key);
        if (hit) router.push(hit.href, { scroll: false });
      }}
    />
  );
}
