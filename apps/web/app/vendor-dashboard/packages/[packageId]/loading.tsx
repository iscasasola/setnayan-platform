import { Sk, SkCircle, SkLine } from '@/components/skeletons';

/**
 * 🧺 THE BUNDLE MAKER'S OWN LOADING SCREEN (Build 6 · Lane D).
 *
 * The maker RISES FULL SCREEN (`RiseScreen`): no page heading, no bottom nav — its name is drawn in the rise's own head.
 * Borrowing the Shop's `vendor-dashboard/loading.tsx` would paint a page title and the nav the maker never draws, and
 * then re-flow when it lands (`the-skeleton-promises-only-what-the-page-draws.test.ts`). So this one mirrors what the
 * maker draws first: the head (✕ · name · ⓘ), the pinned New total row, then the first fields — on the same cream.
 */
export default function BundleMakerLoading() {
  return (
    <section aria-busy="true" aria-label="Opening the Bundle Maker" className="fixed inset-0 z-sn-pop flex flex-col bg-cream">
      <div className="border-b border-ink/10 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex min-h-[60px] w-full max-w-3xl items-center gap-2.5 px-4 py-2">
          <SkCircle />
          <span className="min-w-0 flex-1 space-y-1.5">
            <SkLine w="w-1/2" />
            <SkLine w="w-1/3" />
          </span>
          <SkCircle />
        </div>
      </div>
      <div className="mx-auto w-full max-w-3xl">
        <div className="sn-pin-hair flex min-h-11 items-center justify-between gap-3 px-4 py-2">
          <SkLine w="w-24" />
          <Sk className="h-5 w-28 rounded" />
        </div>
        <div className="space-y-5 px-4 pt-5">
          <SkLine w="w-16" />
          <Sk className="h-12 w-full rounded-xl" />
          <SkLine w="w-28" />
          <Sk className="h-14 w-full rounded-xl" />
          <Sk className="h-14 w-full rounded-xl" />
        </div>
      </div>
    </section>
  );
}
