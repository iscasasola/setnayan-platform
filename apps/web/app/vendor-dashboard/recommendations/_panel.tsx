'use client';

import { useState } from 'react';
import {
  Sparkles,
  Lightbulb,
  Check,
  ThumbsDown,
  Plus,
  ChevronDown,
} from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { setOptIn, flagFeedback } from './actions';

/**
 * RecommendationsPanel — the vendor's private "Recommend to your couples"
 * curation surface (Phase 3a · read-mostly + the vendor's own opt-in / flag
 * writes). All writes go through the two server actions (setOptIn /
 * flagFeedback) under the user-scoped client + RLS — this component only owns
 * presentation + the small local open/close state of the flag + suggest menus.
 *
 * Primitives reused from the vendor dashboard: <SubmitButton> (pending-aware
 * submit), the `button-primary` / `button-secondary` / `input-field` classes,
 * and the same card / pill chrome the Services tab uses (border-ink/10 cards on
 * bg-cream, terracotta accent). No new styling invented.
 */

export type RecCard = {
  tileId: string;
  serviceCode: string;
  title: string;
  priceLabel: string | null;
  rationale: string | null;
  isOptIn: boolean;
  /** True only when the vendor has an enabled optin row for this pairing. */
  optInEnabled: boolean;
  /** True when a pending not_a_fit flag already exists for this pairing. */
  flaggedNotAFit: boolean;
};

export type LeafGroup = {
  tileId: string;
  leafLabel: string;
  /** Always-on recs + the vendor's enabled opt-ins. */
  active: RecCard[];
  /** Opt-in offers the vendor hasn't turned on yet. */
  offers: RecCard[];
  /** True when a pending suggest_add flag already exists for this leaf. */
  suggestFlagged: boolean;
};

export type SkuOption = {
  serviceCode: string;
  title: string;
  priceLabel: string;
};

export function RecommendationsPanel({
  groups,
  suggestSkuOptions,
  savedFlash,
  flaggedFlash,
  errorFlash,
}: {
  groups: LeafGroup[];
  suggestSkuOptions: SkuOption[];
  savedFlash: boolean;
  flaggedFlash: boolean;
  errorFlash: string | null;
}) {
  return (
    <section className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
            <Sparkles aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <span className="rounded-full bg-ink/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Recommend
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Recommend to your couples
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Hand-picked add-ons that make <em>your</em> work shine — the Setnayan
          services we&rsquo;d pair with what you do. Browse them here, switch on
          the ones you want to stand behind, and tell us when something doesn&rsquo;t
          fit or when you&rsquo;d add another.
        </p>
      </header>

      {errorFlash ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {errorFlash}
        </p>
      ) : null}
      {savedFlash ? (
        <p
          role="status"
          className="rounded-md border border-success-300/60 bg-success-50 px-4 py-3 text-sm text-success-800"
        >
          Saved.
        </p>
      ) : null}
      {flaggedFlash ? (
        <p
          role="status"
          className="rounded-md border border-success-300/60 bg-success-50 px-4 py-3 text-sm text-success-800"
        >
          Thanks — we&rsquo;ll review your note and get back to you.
        </p>
      ) : null}

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/15 bg-cream p-8 text-center">
          <Sparkles
            aria-hidden
            className="mx-auto mb-2 h-6 w-6 text-ink/30"
            strokeWidth={1.5}
          />
          <p className="text-sm font-medium text-ink">
            No recommendations for your categories yet.
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs text-ink/60">
            As we curate add-ons that pair with what you do, they&rsquo;ll show up
            here. Add the services you offer on the Services tab to unlock matches.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <LeafSection
              key={group.tileId}
              group={group}
              suggestSkuOptions={suggestSkuOptions}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function LeafSection({
  group,
  suggestSkuOptions,
}: {
  group: LeafGroup;
  suggestSkuOptions: SkuOption[];
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-ink">{group.leafLabel}</h2>
        <SuggestControl
          tileId={group.tileId}
          options={suggestSkuOptions}
          alreadyFlagged={group.suggestFlagged}
        />
      </div>

      {/* Active recommendations — always-on + the vendor's enabled opt-ins. */}
      {group.active.length > 0 ? (
        <ul className="space-y-3">
          {group.active.map((rec) => (
            <li key={`${rec.tileId}:${rec.serviceCode}`}>
              <ActiveRecCard rec={rec} />
            </li>
          ))}
        </ul>
      ) : null}

      {/* Opt-in offers — overlap-risk SKUs the vendor can turn on. */}
      {group.offers.length > 0 ? (
        <ul className="space-y-3">
          {group.offers.map((rec) => (
            <li key={`${rec.tileId}:${rec.serviceCode}`}>
              <OptInOfferCard rec={rec} />
            </li>
          ))}
        </ul>
      ) : null}

      {group.active.length === 0 && group.offers.length === 0 ? (
        <p className="text-sm text-ink/55">
          Nothing to recommend under this category right now.
        </p>
      ) : null}
    </div>
  );
}

/** An active recommendation card — title, price, "Why this helps you", and the
 *  "Not a fit for me" affordance. */
function ActiveRecCard({ rec }: { rec: RecCard }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-cream p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-ink">{rec.title}</p>
            {rec.isOptIn && rec.optInEnabled ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-success-800">
                <Check className="h-3 w-3" strokeWidth={2.5} />
                On
              </span>
            ) : null}
          </div>
          {rec.priceLabel ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
              {rec.priceLabel}
            </p>
          ) : null}
        </div>
        {rec.isOptIn && rec.optInEnabled ? (
          <form action={setOptIn} className="shrink-0">
            <input type="hidden" name="tile_id" value={rec.tileId} />
            <input type="hidden" name="service_code" value={rec.serviceCode} />
            <input type="hidden" name="enabled" value="false" />
            <SubmitButton
              className="inline-flex h-9 items-center justify-center rounded-md border border-ink/20 bg-cream px-3 text-xs font-medium text-ink hover:border-ink/40"
              pendingLabel="Turning off…"
            >
              Turn off
            </SubmitButton>
          </form>
        ) : null}
      </div>

      {rec.rationale ? (
        <div className="mt-3 rounded-xl border border-ink/10 bg-ink/[0.02] p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
            Why this helps you
          </p>
          <p className="mt-1 text-sm text-ink/75">{rec.rationale}</p>
        </div>
      ) : null}

      <div className="mt-3">
        <NotAFitControl rec={rec} />
      </div>
    </div>
  );
}

/** An opt-in offer card — frames the overlap honestly and offers a toggle to
 *  turn the recommendation on. */
function OptInOfferCard({ rec }: { rec: RecCard }) {
  return (
    <div className="rounded-2xl border border-sky-300/60 bg-sky-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-ink">{rec.title}</p>
            <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-sky-800">
              Overlaps your work
            </span>
          </div>
          {rec.priceLabel ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
              {rec.priceLabel}
            </p>
          ) : null}
        </div>
        <form action={setOptIn} className="shrink-0">
          <input type="hidden" name="tile_id" value={rec.tileId} />
          <input type="hidden" name="service_code" value={rec.serviceCode} />
          <input type="hidden" name="enabled" value="true" />
          <SubmitButton className="button-primary h-9 px-3 text-xs" pendingLabel="Turning on…">
            Turn on
          </SubmitButton>
        </form>
      </div>

      <p className="mt-2 text-xs text-ink/65">
        This one can overlap your own service. Turn it on only if you&rsquo;re happy
        to recommend it alongside what you offer.
      </p>
      {rec.rationale ? (
        <p className="mt-2 text-sm text-ink/75">{rec.rationale}</p>
      ) : null}

      <div className="mt-3">
        <NotAFitControl rec={rec} />
      </div>
    </div>
  );
}

/** "Not a fit for me" — collapses to a confirmation form (optional note). When a
 *  pending flag already exists, shows the "pending review" pill instead. */
function NotAFitControl({ rec }: { rec: RecCard }) {
  const [open, setOpen] = useState(false);

  if (rec.flaggedNotAFit) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warn-100 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-warn-900">
        <ThumbsDown className="h-3 w-3" strokeWidth={2} />
        Flagged — pending review
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-ink/55 hover:text-ink"
      >
        <ThumbsDown className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        Not a fit for me
      </button>
    );
  }

  return (
    <form
      action={flagFeedback}
      className="space-y-2 rounded-xl border border-ink/10 bg-cream p-3"
    >
      <input type="hidden" name="feedback_type" value="not_a_fit" />
      <input type="hidden" name="tile_id" value={rec.tileId} />
      <input type="hidden" name="service_code" value={rec.serviceCode} />
      <p className="text-xs font-medium text-ink/75">
        Tell us why this doesn&rsquo;t fit (optional)
      </p>
      <textarea
        name="note"
        rows={2}
        maxLength={1000}
        placeholder="e.g. I already include this · it competes with my package · not relevant to my couples"
        className="input-field resize-none text-sm"
      />
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-ink/55 hover:text-ink"
        >
          Cancel
        </button>
        <SubmitButton
          className="inline-flex h-8 items-center justify-center rounded-md border border-ink/20 bg-cream px-3 text-[11px] font-medium text-ink hover:border-ink/40"
          pendingLabel="Sending…"
        >
          Send flag
        </SubmitButton>
      </div>
    </form>
  );
}

/** "Suggest a service to recommend" — a subtle per-leaf control: pick any active
 *  SKU + an optional note → suggest_add feedback. */
function SuggestControl({
  tileId,
  options,
  alreadyFlagged,
}: {
  tileId: string;
  options: SkuOption[];
  alreadyFlagged: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (alreadyFlagged) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warn-100 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-warn-900">
        <Lightbulb className="h-3 w-3" strokeWidth={2} />
        Suggestion pending review
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-ink/55 hover:text-ink"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        Suggest a service to recommend
      </button>
    );
  }

  return (
    <form
      action={flagFeedback}
      className="w-full max-w-md space-y-2 rounded-xl border border-ink/10 bg-cream p-3"
    >
      <input type="hidden" name="feedback_type" value="suggest_add" />
      <input type="hidden" name="tile_id" value={tileId} />
      <p className="text-xs font-medium text-ink/75">
        Suggest a service we should recommend here
      </p>
      <div className="relative">
        <select
          name="service_code"
          defaultValue=""
          className="input-field cursor-pointer appearance-none pr-9"
        >
          <option value="">Pick a service (optional)…</option>
          {options.map((o) => (
            <option key={o.serviceCode} value={o.serviceCode}>
              {o.title} · {o.priceLabel}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40"
          strokeWidth={1.75}
        />
      </div>
      <textarea
        name="note"
        rows={2}
        maxLength={1000}
        placeholder="Why would this pair well with your work? (optional)"
        className="input-field resize-none text-sm"
      />
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-ink/55 hover:text-ink"
        >
          Cancel
        </button>
        <SubmitButton
          className="inline-flex h-8 items-center justify-center rounded-md border border-ink/20 bg-cream px-3 text-[11px] font-medium text-ink hover:border-ink/40"
          pendingLabel="Sending…"
        >
          Send suggestion
        </SubmitButton>
      </div>
    </form>
  );
}
