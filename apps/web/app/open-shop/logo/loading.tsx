/**
 * /open-shop/logo — "Add your logo" while the server answers. Sign-in, "no shop" and "no name yet" are decided by
 * `./layout.tsx` before this streams, so a 307 is never sent as a 200 + skeleton.
 *
 * Shape it mirrors (`_components/add-your-logo.tsx`, inside the open-shop layer): the wordmark over the five filled
 * step bars, the fixed line "Couples see your logo…" (known, so it shows at once), the round picture frame, the
 * upload row, then the bar at the foot with its one button.
 */
import { FirstRunBrand } from '@/app/_components/first-run-brand';
import { Ghost, Screen, Sk, SkCircle } from '@/components/skeletons';

export default function OpenShopLogoLoading() {
  return (
    <Screen className="flex min-h-0 flex-1 flex-col" label="Loading your logo step">
      <div className="flex flex-1 flex-col gap-[18px] px-4 pt-6 md:mx-auto md:w-full md:max-w-[620px] md:px-7 md:pb-9">
        <div className="grid gap-3">
          <FirstRunBrand color="var(--m-ink)" size={13} />
          <div className="flex gap-1.5" aria-hidden>
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="h-1 flex-1 rounded-full" style={{ background: 'rgb(var(--color-mulberry))' }} />
            ))}
          </div>
        </div>
        <Ghost
          known="Couples see your logo on every supplier card. Changes save on their own."
          textClassName="!whitespace-normal text-sm text-[var(--m-slate)]"
        />
        <div className="flex-1 space-y-4">
          <SkCircle size="mx-auto h-56 w-56" />
          <Sk className="h-11 w-full rounded-xl" />
        </div>
      </div>
      <div className="sticky bottom-0 mt-auto flex items-center border-t px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 md:px-7" style={{ borderColor: 'var(--m-line)' }}>
        <Sk className="ml-auto h-11 w-28 rounded-full" />
      </div>
    </Screen>
  );
}
