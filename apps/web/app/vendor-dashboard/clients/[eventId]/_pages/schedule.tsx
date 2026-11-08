/**
 * 🗂 SCHEDULE — a picked-client page (THE ONE BUILD, 8 Nov 2026 · v113). OWNER: **L2** (B1 step 8).
 *
 * Hour-0 stub: draws the shipped Schedule node unchanged. Step 8 adds the Script fold at the end
 * (`?tab=script` lands there, `#script`). `supplier-schedule.tsx` stays imported in place — never copied.
 */
import type { PickedPageProps } from './context';

export function SchedulePage({ shipped }: PickedPageProps) {
  return <>{shipped ?? null}</>;
}
