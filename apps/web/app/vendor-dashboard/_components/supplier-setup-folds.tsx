'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Fold } from '@/app/_components/fold';
import { Badge } from '@/app/_components/badge';
import { PeekToast } from '@/app/_components/toast/peek-toast';
import { SidePanel } from '@/app/_components/side-panel';
import { useMediaQuery } from '@/lib/use-responsive';
import { formatCount } from '@/lib/format-number';
import { SpotlightMount } from '@/app/_components/spotlight-mount';
import { completeTour } from '@/lib/tour-actions';
import type { SpotlightScript } from '@/lib/tours';
import { SETUP_TOUR_KEY, nextOpenAfter, setupHeadline, type SetupFoldKey, type SetupView } from '@/lib/supplier-setup';

/**
 * 🔦 THE TOUR AFTER STEP 6 (owner 7 Nov 2026, prototype `open-shop-redesign.html` v21: "Download your QR → the tour
 * starts", once). Step 6's body tells the folds the QR was handed over (`useSetupTour().qrSaved()`); the open step
 * folds, and a moment later the HOUSE spotlight (`SpotlightMount` → `spotlight-tour.tsx`: dim + a gliding ring) runs
 * `SETUP_TOUR_KEY`. Ending or skipping it records it with the shipped `completeTour` — that record is step 6's ✓.
 * Never a centred popup; never a second run once it is on record (`seen`), and never on a refused read (`seen` null).
 */
const SetupTourContext = createContext<{ qrSaved: () => void } | null>(null);

export function useSetupTour(): { qrSaved: () => void } | null {
  return useContext(SetupTourContext);
}

/** The dev lab records nothing. */
const labComplete = async () => {};

/** How long the saved QR stays on screen before the tour takes over (the prototype's beat). */
const TOUR_AFTER_MS = 1200;

/**
 * 🧰 GET YOUR SHOP LIVE — a new shop's six steps, each DONE IN PLACE on Today (owner 2026-10-28, DECISION_LOG
 * "SUPPLIER DASHBOARD APPROVED — EVERYTHING IN PLACE, A ⚙ PER PAGE"; prototype `supplier_in_place_2026-10-28`
 * `renderToday` new-shop frame): the eyebrow and Today's ⚙ · "N of 6 done" · the bar · six folds.
 *
 *   · Each fold's body is a SHIPPED editor, mounted (handed in by the page — the details rows, the logo upload, the
 *     service cards with the maker as a sheet, the documents, the QR and the days-off form). Each saves itself.
 *   · ✓ IS THE SAVED FACT, NEVER THE PRESS: the folds' `done` arrive from the server's own reads (`assembleSetup`).
 *     When a save makes the OPEN fold done, it ticks, the bar grows, "Saved ✓" is said and the NEXT step opens
 *     (`nextOpenAfter`) — in place, nothing reloads the screen ("no jumping").
 *
 * 🪟 FROM 768px THE OPEN STEP IS A THIRD PANE ON THE RIGHT (owner 2026-11-06, the sign-up redesign's Today: "on
 * tablet and desktop a pop-up is a third pane on the right, never floating; on the phone it is the bottom sheet").
 * The pane is the shipped `SidePanel` in `CreateEventPanel`'s shape (`size="wide"`, `phone="sheet"`); the checklist
 * stays the full width beside it and each body is the SAME shipped editor, mounted ONCE — in the pane at ≥768, in
 * its fold below that (a fold keeps a closed body mounted, so drawing it in both would mount every form twice).
 * Nothing opens by itself at ≥768: a modal pane on arrival would trap focus before the supplier asked for anything.
 *
 * 🔒 app/vendor-dashboard/_components/setup-is-done-in-place.test.ts
 */
export function SupplierSetupFolds({
  view,
  bodies,
  gear,
  tour,
}: {
  view: SetupView;
  bodies: Readonly<Record<SetupFoldKey, ReactNode>>;
  /** Today's ⚙ — the page mounts it once; it rides at the right of the eyebrow (the prototype's spot). */
  gear?: ReactNode;
  /** The tour after step 6: its words (read on the server — `lib/tours.ts` never reaches the browser) and whether it
      is already on record (null: the read was refused — it does not run). */
  tour?: { script: SpotlightScript; seen: boolean | null; lab?: boolean } | null;
}) {
  const [open, setOpen] = useState<SetupFoldKey | null>(view.firstOpen);
  const wide = useMediaQuery('(min-width: 768px)');
  /** The step open in the right-hand pane (≥768 only). */
  const [pane, setPane] = useState<SetupFoldKey | null>(null);
  const [touring, setTouring] = useState(false);
  const asked = useRef(false);
  const canTour = tour != null && tour.seen === false;
  const qrSaved = useCallback(() => {
    if (!canTour || asked.current) return;
    asked.current = true;
    window.setTimeout(() => {
      setOpen(null);
      setPane(null);
      setTouring(true);
    }, TOUR_AFTER_MS);
  }, [canTour]);
  const tourCtx = useMemo(() => ({ qrSaved }), [qrSaved]);
  const [saved, setSaved] = useState<number | null>(null);
  const doneBefore = useRef<Set<SetupFoldKey>>(new Set(view.folds.filter((f) => f.done).map((f) => f.key)));
  const doneKey = view.folds.map((f) => (f.done ? '1' : '0')).join('');

  // A save landed (the server re-read the shop): a fold that just turned ✓ is said, and if it was the open one the
  // next step opens.
  useEffect(() => {
    const was = doneBefore.current;
    const turned = view.folds.filter((f) => f.done && !was.has(f.key));
    if (turned.length > 0) {
      setOpen((o) => nextOpenAfter(view.folds, o, was));
      setPane((o) => nextOpenAfter(view.folds, o, was));
      setSaved((n) => (n ?? 0) + 1);
    }
    doneBefore.current = new Set(view.folds.filter((f) => f.done).map((f) => f.key));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `doneKey` is the folds' done set, in one string
  }, [doneKey]);

  const pct = Math.round((view.done / view.of) * 100);

  return (
    <SetupTourContext.Provider value={tourCtx}>
    <section data-today-setup="" data-tour="today-setup" aria-label="Get your shop live" className="pb-2">
      <div className="flex min-h-11 items-center gap-2" data-first-row="">
        <p className="home-k2 flex-1">Get your shop live</p>
        {gear}
      </div>
      <p className="text-[24px] font-bold leading-tight text-ink" data-setup-headline="" aria-live="polite">
        {setupHeadline(view)}
      </p>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/10"
        role="meter"
        aria-label="Get your shop live"
        aria-valuemin={0}
        aria-valuemax={view.of}
        aria-valuenow={view.done}
        data-setup-bar={view.done}
      >
        <span
          className="block h-full rounded-full bg-[rgb(var(--color-ok))] transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-2 divide-y divide-ink/10" data-setup-folds="">
        {view.folds.map((f) => (
          <Fold
            key={f.key}
            data={`setup-${f.key}`}
            anchor={`setup-${f.key}`}
            // The papers' ⓘ opens near the fold's foot — let it hang past the edge once the fold is open.
            popovers
            title={f.title}
            line={f.line}
            open={wide ? false : open === f.key}
            onOpenChange={(o) =>
              wide ? setPane(o ? f.key : null) : setOpen(o ? f.key : open === f.key ? null : open)
            }
            lead={<StepChip n={f.n} done={f.done} open={wide ? pane === f.key : open === f.key} />}
            aside={
              f.badge ? (
                <Badge tone={f.badge.tone} data={`setup-${f.key}`}>
                  {f.badge.word}
                </Badge>
              ) : f.done ? (
                <span className="sr-only">Done</span>
              ) : null
            }
          >
            <div className="pb-4" data-setup-body={f.key}>
              {wide ? null : bodies[f.key]}
            </div>
          </Fold>
        ))}
      </div>

      {(() => {
        const f = pane ? view.folds.find((x) => x.key === pane) : null;
        return (
          <SidePanel
            open={wide && f != null}
            onClose={() => setPane(null)}
            title={f?.title ?? ''}
            info={f?.line}
            size="wide"
            phone="sheet"
          >
            {wide && f ? (
              <div data-setup-body={f.key} data-setup-pane="">
                {bodies[f.key]}
              </div>
            ) : null}
          </SidePanel>
        );
      })()}

      {saved !== null ? (
        <PeekToast key={saved} tone="ok" data="setup-saved" onGone={() => setSaved(null)}>
          Saved ✓
        </PeekToast>
      ) : null}
      {touring && tour ? (
        <SpotlightMount tourKey={SETUP_TOUR_KEY} script={tour.script} seen={false} completeAction={tour.lab ? labComplete : completeTour} />
      ) : null}
    </section>
    </SetupTourContext.Provider>
  );
}

/** The step's round chip — its number, or ✓ once the saved fact says it is done (prototype `.chip`). */
function StepChip({ n, done, open }: { n: number; done: boolean; open: boolean }) {
  // ✓ green once done · the open step in the accent (prototype `.step.open .chip`) · otherwise the soft gold wash.
  return (
    <span
      aria-hidden
      data-setup-chip={done ? 'done' : String(n)}
      className={`grid h-9 w-9 flex-none place-items-center rounded-full text-[14px] font-semibold transition-colors duration-200 motion-reduce:transition-none ${
        done ? 'text-[rgb(var(--color-ok))]' : open ? 'bg-sn-accent text-[rgb(var(--sn-on-accent))]' : 'text-ink/70'
      }`}
      style={{
        background: done
          ? 'color-mix(in srgb, rgb(var(--color-ok)) 14%, transparent)'
          : open
            ? undefined
            : 'color-mix(in srgb, rgb(var(--color-gild)) 16%, transparent)',
      }}
    >
      {done ? <Check className="h-[18px] w-[18px]" strokeWidth={2.2} /> : formatCount(n)}
    </span>
  );
}
