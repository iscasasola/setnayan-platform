'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Fold } from '@/app/_components/fold';
import { Badge } from '@/app/_components/badge';
import { PeekToast } from '@/app/_components/toast/peek-toast';
import { formatCount } from '@/lib/format-number';
import { nextOpenAfter, setupHeadline, type SetupFoldKey, type SetupView } from '@/lib/supplier-setup';

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
 * 🔒 app/vendor-dashboard/_components/setup-is-done-in-place.test.ts
 */
export function SupplierSetupFolds({
  view,
  bodies,
  gear,
}: {
  view: SetupView;
  bodies: Readonly<Record<SetupFoldKey, ReactNode>>;
  /** Today's ⚙ — the page mounts it once; it rides at the right of the eyebrow (the prototype's spot). */
  gear?: ReactNode;
}) {
  const [open, setOpen] = useState<SetupFoldKey | null>(view.firstOpen);
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
      setSaved((n) => (n ?? 0) + 1);
    }
    doneBefore.current = new Set(view.folds.filter((f) => f.done).map((f) => f.key));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `doneKey` is the folds' done set, in one string
  }, [doneKey]);

  const pct = Math.round((view.done / view.of) * 100);

  return (
    <section data-today-setup="" aria-label="Get your shop live" className="pb-2">
      <div className="flex min-h-11 items-center gap-2" data-first-row="">
        <p className="home-k2 flex-1">Get your shop live</p>
        {gear}
      </div>
      <p className="text-[17px] font-semibold text-ink" data-setup-headline="" aria-live="polite">
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
          className="block h-full rounded-full bg-sn-accent transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-2 divide-y divide-ink/10" data-setup-folds="">
        {view.folds.map((f) => (
          <Fold
            key={f.key}
            data={`setup-${f.key}`}
            anchor={`setup-${f.key}`}
            title={f.title}
            line={f.line}
            open={open === f.key}
            onOpenChange={(o) => setOpen(o ? f.key : open === f.key ? null : open)}
            lead={<StepChip n={f.n} done={f.done} />}
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
              {bodies[f.key]}
            </div>
          </Fold>
        ))}
      </div>

      {saved !== null ? (
        <PeekToast key={saved} tone="ok" data="setup-saved" onGone={() => setSaved(null)}>
          Saved ✓
        </PeekToast>
      ) : null}
    </section>
  );
}

/** The step's round chip — its number, or ✓ once the saved fact says it is done (prototype `.chip`). */
function StepChip({ n, done }: { n: number; done: boolean }) {
  return (
    <span
      aria-hidden
      data-setup-chip={done ? 'done' : String(n)}
      className={`grid h-9 w-9 flex-none place-items-center rounded-full text-[14px] font-semibold ${done ? 'text-[rgb(var(--color-ok))]' : 'text-ink/70'}`}
      style={{
        background: done
          ? 'color-mix(in srgb, rgb(var(--color-ok)) 14%, transparent)'
          : 'color-mix(in srgb, rgb(var(--color-gild)) 16%, transparent)',
      }}
    >
      {done ? <Check className="h-[18px] w-[18px]" strokeWidth={2.2} /> : formatCount(n)}
    </span>
  );
}
