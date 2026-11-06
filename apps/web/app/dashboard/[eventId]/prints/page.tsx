import LaunchHubPage from '../launch/page';
import { PRINTS_PAGE_CARRY, PRINTS_PAGE_LABEL, PRINTS_PAGE_SURFACE, printsPageItem } from '@/lib/prints-page';

export const metadata = { title: PRINTS_PAGE_LABEL };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const one = (v: string | string[] | undefined): string | undefined => (typeof v === 'string' ? v : undefined);

/**
 * /dashboard/[eventId]/prints — 🖨 PRINTS, ITS OWN PAGE (R8 · owner 2026-10-27, verbatim: *"Prints leaves Studio. It keeps
 * its own page (the approved swipe carousel) and Home gets a Prints line that opens it. No new bottom tab."* —
 * DECISION_LOG "PRINTS LEAVES STUDIO …"; build plan `EVENT_MENU_REORG_BUILD_PLAN_2026-10-27.md` step 7b).
 *
 * 🔑 NOTHING HERE IS REDRAWN. It is the Maker's own page (`../launch/page.tsx`) — the same reads, the same draft bar,
 * the same Details page — told to draw Prints alone (`PRINTS_PAGE_SURFACE`, a key no address can carry), so the swipe
 * carousel, ⚙ Print settings, Download ▾, View as ▾, the share icon, every print format and "Changed since you printed"
 * are the shipped ones, byte for byte. The shell names the page "Prints" where Stages | Studio stood (`printsPage`).
 *
 * The address names the piece: `?item=<print>` (else "On every print", where the Studio tile opened), and it carries a
 * save's flash, a picked size and View as on (`PRINTS_PAGE_CARRY`). Opened from Home's Prints line; every old print
 * address of the Maker forwards here (`printsForward`). A viewer with nothing to make is sent to Home by the Maker's page.
 */
export default async function PrintsPage({ params, searchParams }: Props) {
  const sp = await searchParams;
  const carried = Object.fromEntries(PRINTS_PAGE_CARRY.map((k) => [k, one(sp[k])]));
  return (
    <LaunchHubPage
      params={params}
      searchParams={Promise.resolve({
        ...carried,
        tool: 'details',
        item: printsPageItem({ item: one(sp.item), menuFlash: Boolean(one(sp.menu_saved) || one(sp.menu_error)) }),
        [PRINTS_PAGE_SURFACE]: true,
      })}
    />
  );
}
