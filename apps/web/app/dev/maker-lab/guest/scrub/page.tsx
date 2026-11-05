import MakerLabGuestPage from '../page';

/**
 * /dev/maker-lab/guest/scrub — the lab's canvas on its Scrub chain (`../../lab-scrub.ts`): the SAME page as
 * `../page.tsx` with `scrub=1`, at an address the Maker can write its own query after. DEV-ONLY, as that page is.
 */
export default function MakerLabScrubGuestPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return MakerLabGuestPage({ searchParams: searchParams.then((sp) => ({ ...sp, scrub: '1' })) });
}
