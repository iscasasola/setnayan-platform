'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, AlertTriangle } from 'lucide-react';
import type { RowActionState } from '@/app/admin/pricing/actions';
import type { AiPriceTier } from '@/lib/setnayan-ai-type-pricing';
import {
  discountComplaints,
  effectiveDiscountPct,
  previewFamilySave,
  signupPriceFor,
} from '@/lib/onboarding-family-discount';

export type EventKindView = {
  eventType: string;
  label: string;
  emoji: string;
  enabled: boolean;
  band: AiPriceTier | null;
};

export type AiBandView = {
  band: AiPriceTier;
  serviceCode: string | null;
  regularPhp: number | null;
  signupPhp: number | null;
  isSellable: boolean;
  kinds: EventKindView[];
};

const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`;

/**
 * The Setnayan AI band editor — ported from the binding prototype.
 *
 * ⚠ ONE KIND, ONE BAND, AND THE EXCLUSIVITY IS STRUCTURAL. Ticking a kind into
 * a band writes a single column on that kind's own row, so it leaves whichever
 * band it was in by construction. There is no "untick the others" pass that
 * could half-fail and leave a celebration quoted two prices.
 */
export function AiBandsEditor({
  bands,
  unassigned,
  totalKinds,
  discountPct,
  setBandAction,
  saveDiscountAction,
}: {
  bands: AiBandView[];
  unassigned: EventKindView[];
  totalKinds: number;
  discountPct: number;
  setBandAction: (prev: RowActionState, fd: FormData) => Promise<RowActionState>;
  saveDiscountAction: (prev: RowActionState, fd: FormData) => Promise<RowActionState>;
}) {
  const router = useRouter();
  const [bandState, bandFormAction] = useActionState<RowActionState, FormData>(setBandAction, {
    ok: false,
    message: null,
  });

  const priced = bands.filter((b) => b.regularPhp != null);
  // Every kind, wherever it currently sits — so each band can offer the ones it
  // does not already hold.
  const allKinds: EventKindView[] = [...bands.flatMap((b) => b.kinds), ...unassigned];

  return (
    <div>
      <p className="mb-5 max-w-prose text-sm leading-relaxed text-ink/70">
        Setnayan AI does not cost the same for a wedding as it does for a coffee catch-up. Five
        price bands; every kind of celebration sits in <strong>exactly one</strong> of them. Ticking
        a kind here takes it out of wherever it was, so the same celebration can never be quoted two
        prices.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-ink/10 bg-ink/[0.02] p-3.5 sm:grid-cols-4">
        <Stat label="Price bands" value={String(bands.length)} />
        <Stat label="Kinds of celebration" value={String(totalKinds)} />
        <Stat label="No price chosen" value={String(unassigned.length)} bad={unassigned.length > 0} />
        <Stat label="Sold as its own row" value={String(bands.filter((b) => b.isSellable).length)} />
      </div>

      <FamilyDiscountCard
        discountPct={discountPct}
        rows={priced.map((b) => ({
          serviceCode: b.serviceCode!,
          title: `Band ${b.band}`,
          regularPhp: b.regularPhp!,
          signupPhp: b.signupPhp,
        }))}
        action={saveDiscountAction}
      />

      {/*
        ⚠ THE TRAY IS PERMANENT, EVEN WHEN EMPTY. Its whole job is to turn a
        silent default into a visible question — so the NEXT kind of celebration
        somebody adds cannot start being sold at the middle price with nothing
        anywhere saying so. An empty tray reads as "nothing unanswered", which is
        information; a removed tray reads as nothing at all.
      */}
      <UnassignedTray kinds={unassigned} />

      {bandState.message && (
        <p
          className={`mb-4 text-[13px] font-semibold ${
            bandState.ok ? 'text-success-800' : 'text-danger-700'
          }`}
        >
          {bandState.message}
        </p>
      )}

      <div className="flex flex-col gap-3.5">
        {bands.map((b) => (
          <BandCard
            key={b.band}
            band={b}
            allKinds={allKinds}
            discountPct={discountPct}
            formAction={bandFormAction}
            onSaved={() => router.refresh()}
          />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div
      className={`rounded-lg border p-2.5 ${
        bad ? 'border-danger-700/35 bg-danger-700/[0.06]' : 'border-ink/8 bg-cream'
      }`}
    >
      <span className="block font-mono text-[9.5px] uppercase tracking-[0.15em] text-ink/55">
        {label}
      </span>
      <span
        className={`mt-0.5 block text-[19px] font-bold tabular-nums tracking-tight ${
          bad ? 'text-danger-700' : 'text-ink'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * ONE discount for the whole family, with the before → after of every row it
 * would move shown BEFORE the save.
 *
 * ⚠ THIS PREVIEW IS THE WHOLE RISK OF THE SINGLE-DISCOUNT SHAPE. Nudging one box
 * reprices every row in the family. The warning is not for the person who chose
 * today's number — it is for the next person who nudges it.
 */
function FamilyDiscountCard({
  discountPct,
  rows,
  action,
}: {
  discountPct: number;
  rows: { serviceCode: string; title: string; regularPhp: number; signupPhp: number | null }[];
  action: (prev: RowActionState, fd: FormData) => Promise<RowActionState>;
}) {
  const [state, formAction] = useActionState<RowActionState, FormData>(action, {
    ok: false,
    message: null,
  });
  const [pct, setPct] = useState(String(discountPct));

  const n = Number(pct);
  const usable = Number.isFinite(n);
  const complaints = usable ? discountComplaints('ai', n) : [];
  const preview = usable && complaints.every((c) => c.kind !== 'out_of_range')
    ? previewFamilySave(rows, n)
    : [];
  const moving = preview.filter((p) => p.moves);

  return (
    <form
      action={formAction}
      className="mb-6 rounded-r-2xl border border-l-[3px] border-ink/10 border-l-gold bg-ink/[0.02] p-4"
    >
      <input type="hidden" name="family" value="ai" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold">One saving for every Setnayan AI band</h3>
          <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-ink/65">
            Buy it while setting up the celebration and it costs this much less. One number covers
            all four bands — each band&apos;s sign-up price is worked out from its regular price, so
            you never type it.
            <br />
            <span className="text-ink/50">
              Papic has its own separate saving, and its 10% floor does not apply here.
            </span>
          </p>
        </div>
        <label className="block shrink-0 text-right">
          <span className="mb-1.5 block font-mono text-[9.5px] uppercase tracking-[0.15em] text-ink/55">
            Saving at set-up
          </span>
          <div className="relative">
            <input
              name="discount_pct"
              type="number"
              step="0.01"
              min="0"
              max="99.99"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              className="input-field w-28 pr-7 text-right font-mono tabular-nums"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[13px] text-ink/50">
              %
            </span>
          </div>
        </label>
      </div>

      {complaints.map((c) => (
        <p
          key={c.kind}
          className="mt-2.5 rounded-lg border border-danger-700/30 bg-danger-700/[0.06] px-3 py-2 text-[12.5px] font-semibold text-danger-700"
        >
          {c.message}
        </p>
      ))}

      {moving.length > 0 && (
        <div className="mt-3 rounded-xl border border-danger-700/30 bg-danger-700/[0.05] p-3">
          <p className="flex items-center gap-2 text-[13px] font-bold text-danger-700">
            <AlertTriangle className="h-4 w-4" strokeWidth={2} aria-hidden />
            Saving this changes {moving.length} sign-up price{moving.length === 1 ? '' : 's'}
          </p>
          <ul className="mt-2 space-y-1 text-[12.5px] text-ink/75">
            {moving.map((p) => (
              <li key={p.serviceCode} className="tabular-nums">
                <span className="font-semibold">{p.title}</span> — {peso(p.regularPhp)} regular ·
                sign-up{' '}
                <span className="font-mono">
                  {p.currentSignupPhp == null ? 'none' : peso(p.currentSignupPhp)}
                </span>{' '}
                → <span className="font-mono font-bold text-danger-700">
                  {p.nextSignupPhp == null ? 'none' : peso(p.nextSignupPhp)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {usable && complaints.length === 0 && moving.length === 0 && (
        <p className="mt-2.5 text-[12.5px] text-ink/55">
          No sign-up price changes at this saving.
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          className="rounded-md bg-terracotta-700 px-4 py-2 text-sm font-semibold text-cream transition hover:bg-terracotta-800"
        >
          Save the saving
        </button>
        {state.message && (
          <span className={`text-xs ${state.ok ? 'text-success-800' : 'text-danger-700'}`}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

function UnassignedTray({ kinds }: { kinds: EventKindView[] }) {
  const empty = kinds.length === 0;
  return (
    <div
      className={`mb-6 rounded-2xl border p-4 ${
        empty
          ? 'border-success-800/30 bg-success-800/[0.06]'
          : 'border-danger-700/35 bg-danger-700/[0.06]'
      }`}
    >
      <h3
        className={`flex items-center gap-2 text-[15px] font-bold ${
          empty ? 'text-success-800' : 'text-danger-700'
        }`}
      >
        {empty ? (
          <Check className="h-4 w-4" strokeWidth={2.4} aria-hidden />
        ) : (
          <AlertTriangle className="h-4 w-4" strokeWidth={2} aria-hidden />
        )}
        {empty
          ? 'Every kind of celebration has a price'
          : `${kinds.length} kind${kinds.length === 1 ? '' : 's'} of celebration ${
              kinds.length === 1 ? 'has' : 'have'
            } no price of their own`}
      </h3>
      <p className="mt-1.5 max-w-prose text-[13px] leading-relaxed text-ink/65">
        {empty
          ? 'This stays here on purpose. The next kind of celebration you add will appear in this box until you give it a band — so a price is never chosen for it by accident.'
          : 'These are being charged already — they fall through to the middle band, because that is what happens when nothing is chosen. Nobody decided that price. Give each one a home, or decide out loud that the middle is right for it.'}
      </p>
      {!empty && (
        <div className="mt-3 flex flex-wrap gap-2">
          {kinds.map((k) => (
            <span
              key={k.eventType}
              className="inline-flex items-center gap-2 rounded-xl border border-danger-700/30 bg-cream px-3 py-2"
            >
              <span className="text-[17px] leading-none" aria-hidden>
                {k.emoji}
              </span>
              <span className="text-[14px] font-bold">{k.label}</span>
              <span className="font-mono text-[11.5px] text-danger-700">falling through</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function BandCard({
  band,
  allKinds,
  discountPct,
  formAction,
  onSaved,
}: {
  band: AiBandView;
  allKinds: EventKindView[];
  discountPct: number;
  formAction: (fd: FormData) => void;
  onSaved: () => void;
}) {
  const notOffered = band.regularPhp == null;
  const computedSignup =
    band.regularPhp != null ? signupPriceFor(band.regularPhp, discountPct) : null;
  const storedDiscount = effectiveDiscountPct(band.regularPhp ?? 0, band.signupPhp);

  return (
    <section
      className={`overflow-hidden rounded-2xl border ${
        notOffered ? 'border-ink/10 bg-ink/[0.03]' : 'border-ink/10 bg-cream'
      }`}
    >
      <header className="flex flex-wrap items-center gap-4 border-b border-ink/10 bg-ink/[0.02] p-4">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] font-mono text-[15px] font-bold ${
            notOffered ? 'bg-ink/8 text-ink/55' : 'bg-gold/[0.16] text-gold-deep'
          }`}
        >
          {band.band}
        </span>

        {notOffered ? (
          <div className="min-w-0 flex-1">
            <p className="rounded-lg border border-dashed border-ink/15 px-3 py-2 text-center font-mono text-[12.5px] text-ink/60">
              Not offered — no price
            </p>
          </div>
        ) : (
          <>
            <div className="w-32">
              <span className="mb-1 block font-mono text-[9.5px] uppercase tracking-[0.15em] text-ink/55">
                Regular price
              </span>
              <p className="font-mono text-[15px] font-bold tabular-nums">{peso(band.regularPhp!)}</p>
            </div>
            <div className="w-40">
              <span className="mb-1 block font-mono text-[9.5px] uppercase tracking-[0.15em] text-ink/55">
                At set-up
              </span>
              <p className="font-mono text-[15px] font-bold tabular-nums text-ink">
                {band.signupPhp == null ? '—' : peso(band.signupPhp)}
                {storedDiscount != null && (
                  <span className="ml-1.5 font-sans text-[11.5px] font-semibold text-ink/50">
                    {storedDiscount.toFixed(1)}% off
                  </span>
                )}
              </p>
              {computedSignup != null && computedSignup !== band.signupPhp && (
                <span className="mt-0.5 block text-[11px] font-semibold text-danger-700">
                  the saving above would make this {peso(computedSignup)}
                </span>
              )}
            </div>
          </>
        )}

        <div className="ml-auto flex min-w-0 flex-col gap-1">
          <span className="text-[14.5px] font-bold">
            {band.kinds.length} kind{band.kinds.length === 1 ? '' : 's'}
          </span>
          <span
            className={`inline-flex items-center self-start rounded-full border px-2.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.11em] ${
              band.isSellable
                ? 'border-success-800/30 bg-success-800/[0.10] text-success-800'
                : 'border-ink/12 bg-ink/[0.03] text-ink/55'
            }`}
          >
            {band.isSellable ? 'Sold as its own row' : notOffered ? 'No row' : 'Price source only'}
          </span>
        </div>
      </header>

      <div className="p-4">
        {notOffered && (
          <p className="mb-2.5 max-w-prose text-[12.5px] leading-relaxed text-ink/60">
            Setnayan AI is not sold for these at all. <strong>This is not a free version</strong> —
            there are no suppliers to reach, so the planner has nobody to plan with.
          </p>
        )}
        {band.kinds.length === 0 ? (
          <p className="text-[13px] italic text-ink/50">No kind of celebration pays this price.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {band.kinds.map((k) => (
              <span
                key={k.eventType}
                className="inline-flex items-center gap-2 rounded-[10px] border border-ink/12 bg-cream px-2.5 py-1.5 text-[13.5px] font-semibold"
              >
                <span className="flex h-[17px] w-[17px] items-center justify-center rounded-[5px] border-[1.5px] border-terracotta-700 bg-terracotta-700 text-cream">
                  <Check className="h-[11px] w-[11px]" strokeWidth={2.6} aria-hidden />
                </span>
                <span className="text-[15px] leading-none" aria-hidden>
                  {k.emoji}
                </span>
                {k.label}
              </span>
            ))}
          </div>
        )}

        {/* Moving a kind IN. The select posts one kind + one band; that write is
            the whole move, because a kind's band is a single column on its row. */}
        <form
          action={(fd) => {
            formAction(fd);
            onSaved();
          }}
          className="mt-3 flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="band" value={band.band} />
          <label className="font-mono text-[9.5px] uppercase tracking-[0.15em] text-ink/55">
            Move a kind here
          </label>
          <select
            name="event_type"
            defaultValue=""
            required
            className="input-field h-9 max-w-[15rem] text-sm"
            aria-label={`Move a kind of celebration into band ${band.band}`}
          >
            <option value="" disabled>
              Choose a celebration…
            </option>
            {/* Only kinds NOT already here — moving a kind into the band it is
                already in is a no-op the action would report as "no changes". */}
            {allKinds
              .filter((k) => k.band !== band.band)
              .map((k) => (
                <option key={k.eventType} value={k.eventType}>
                  {k.emoji} {k.label}
                  {k.band == null ? ' — no band yet' : ` — now in ${k.band}`}
                </option>
              ))}
          </select>
          <button
            type="submit"
            className="rounded-md border border-ink/15 px-3 py-1.5 text-[12.5px] font-semibold text-ink/70 transition hover:border-terracotta-700 hover:text-terracotta-700"
          >
            Move
          </button>
        </form>
      </div>
    </section>
  );
}
