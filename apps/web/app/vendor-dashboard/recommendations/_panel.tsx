'use client';

import { useId, useState } from 'react';
import { ThumbsDown, Plus, ChevronDown, Send, Power } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { setOptIn, flagFeedback } from './actions';
import { suggestToCouple } from './share-actions';
import { ActionButton } from '@/components/action-button';
import { Fold } from '@/app/_components/fold';
import { InfoTip } from '@/app/_components/info-tip';
import { Sheet } from '@/app/_components/sheet';
import { SupplierToast } from '../_components/supplier-toast';
import { ToolChip, ToolEmpty, ToolFail, ToolPage, ToolPin, ToolSection } from '../_components/tool-page';
import { StayForm } from '@/app/_components/stay-form';

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
  /**
   * Studio add-on key IF this SKU maps to a recommendable in-app service —
   * drives the "Suggest to a couple" control. null → no control (the SKU isn't a
   * buyable Studio add-on, so there's nothing the couple could buy from the hub).
   */
  addonKey: string | null;
};

/** A connected couple the vendor can suggest to — an accepted-thread event. */
export type ConnectedCouple = {
  eventId: string;
  /** The event display_name the couple identified themselves with. */
  label: string;
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
  /** Null in the App Store / Play Store shell, which shows no Setnayan price (lib/store-shell.ts). */
  priceLabel: string | null;
};

export function RecommendationsPanel({
  groups,
  suggestSkuOptions,
  connectedCouples,
  suggestedKeys,
  savedFlash,
  flaggedFlash,
  suggestedFlash,
  errorFlash,
}: {
  groups: LeafGroup[];
  suggestSkuOptions: SkuOption[];
  /** Accepted-thread couples the vendor can suggest add-ons to. */
  connectedCouples: ConnectedCouple[];
  /** "<event_id>::<addon_key>" pairs this vendor has already suggested (pending). */
  suggestedKeys: string[];
  savedFlash: boolean;
  flaggedFlash: boolean;
  suggestedFlash: boolean;
  errorFlash: string | null;
}) {
  const suggestedSet = new Set(suggestedKeys);
  return (
    <ToolPage name="recommend">
      {/* The redraw (v3, 21 Nov 2026): the sparkles tile, the mono chip and the three-line intro are one line + ⓘ. */}
      <ToolPin
        route="/vendor-dashboard/recommendations"
        title="Recommend"
        sub={
          <InfoTip label="Add-ons we’d pair with what you do." align="start">
            Recommend to your couples. Hand-picked add-ons that make <em>your</em> work shine — the Setnayan services
            we&rsquo;d pair with what you do. Browse them here, switch on the ones you want to stand behind, and tell us
            when something doesn&rsquo;t fit or when you&rsquo;d add another.
          </InfoTip>
        }
      />

      {errorFlash ? <ToolFail data="recommend" title={errorFlash} /> : null}
      {savedFlash ? <SupplierToast tone="ok" text="Saved." line={false} /> : null}
      {flaggedFlash ? <SupplierToast tone="ok" text="Thanks — we’ll review your note and get back to you." line={false} /> : null}
      {suggestedFlash ? <SupplierToast tone="ok" text="Suggested — the couple will see it in their Studio." line={false} /> : null}

      {groups.length === 0 ? (
        <ToolEmpty data="recommend">
          No recommendations for your categories yet. Add the services you offer to unlock matches.
        </ToolEmpty>
      ) : (
        groups.map((group) => (
          <LeafSection
            key={group.tileId}
            group={group}
            suggestSkuOptions={suggestSkuOptions}
            connectedCouples={connectedCouples}
            suggestedSet={suggestedSet}
          />
        ))
      )}
    </ToolPage>
  );
}

function LeafSection({
  group,
  suggestSkuOptions,
  connectedCouples,
  suggestedSet,
}: {
  group: LeafGroup;
  suggestSkuOptions: SkuOption[];
  connectedCouples: ConnectedCouple[];
  suggestedSet: Set<string>;
}) {
  // Always-on + the vendor's enabled opt-ins first, then the overlap offers they can turn on — the shipped order.
  const rows = [...group.active, ...group.offers];
  return (
    <ToolSection
      label={group.leafLabel}
      right={<SuggestControl tileId={group.tileId} options={suggestSkuOptions} alreadyFlagged={group.suggestFlagged} />}
      data={`recommend-${group.tileId}`}
    >
      {rows.length === 0 ? (
        <ToolEmpty data="recommend-leaf">Nothing to recommend under this category right now.</ToolEmpty>
      ) : (
        <ul className="sn-frame px-4 py-1">
          {rows.map((rec) => (
            <li key={`${rec.tileId}:${rec.serviceCode}`}>
              <RecRow rec={rec} offer={group.offers.includes(rec)} connectedCouples={connectedCouples} suggestedSet={suggestedSet} />
            </li>
          ))}
        </ul>
      )}
    </ToolSection>
  );
}

/**
 * One add-on — a row that opens in place (the shared `Fold`, one at a time). Shut: its title, its catalogue price (hidden
 * in the app-store shell) and its state (On · Overlaps your work · Flagged — pending review). Open: the overlap note,
 * "Why this helps you", Turn on / Turn off, Suggest to a couple and Not a fit for me — the same forms and actions.
 */
function RecRow({
  rec,
  offer,
  connectedCouples,
  suggestedSet,
}: {
  rec: RecCard;
  /** An overlap offer the shop has not turned on (the old sky-blue card). */
  offer: boolean;
  connectedCouples: ConnectedCouple[];
  suggestedSet: Set<string>;
}) {
  const on = rec.isOptIn && rec.optInEnabled;
  return (
    <Fold
      title={rec.title}
      line={rec.priceLabel ?? undefined}
      aside={
        rec.flaggedNotAFit ? (
          <ToolChip tone="wait">Flagged — pending review</ToolChip>
        ) : offer ? (
          <ToolChip tone="info">Overlaps your work</ToolChip>
        ) : on ? (
          <ToolChip tone="ok">On</ToolChip>
        ) : undefined
      }
      data="recommend-row"
    >
      <div className="flex flex-col gap-2 pb-4 pt-1 text-[14px]">
        {offer ? (
          <p className="text-[color:var(--m-slate-2)]">
            This one can overlap your own service. Turn it on only if you&rsquo;re happy to recommend it alongside what you
            offer.
          </p>
        ) : null}
        {rec.rationale ? (
          <div>
            <p className="font-bold text-ink">Why this helps you</p>
            <p className="text-[color:var(--m-slate-2)]">{rec.rationale}</p>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {offer ? (
            <StayForm door="svRecommendations.setOptIn" action={setOptIn}>
              <input type="hidden" name="tile_id" value={rec.tileId} />
              <input type="hidden" name="service_code" value={rec.serviceCode} />
              <input type="hidden" name="enabled" value="true" />
              <SubmitButton className="button-primary inline-flex items-center gap-1.5 text-sm" pendingLabel="Turning on…">
                <Power aria-hidden className="h-4 w-4" strokeWidth={1.8} /> Turn on
              </SubmitButton>
            </StayForm>
          ) : on ? (
            <StayForm door="svRecommendations.setOptIn" action={setOptIn}>
              <input type="hidden" name="tile_id" value={rec.tileId} />
              <input type="hidden" name="service_code" value={rec.serviceCode} />
              <input type="hidden" name="enabled" value="false" />
              <SubmitButton className="button-secondary inline-flex items-center gap-1.5 text-sm" pendingLabel="Turning off…">
                <Power aria-hidden className="h-4 w-4" strokeWidth={1.8} /> Turn off
              </SubmitButton>
            </StayForm>
          ) : null}
          {rec.addonKey ? (
            <SuggestToCoupleControl addonKey={rec.addonKey} title={rec.title} connectedCouples={connectedCouples} suggestedSet={suggestedSet} />
          ) : null}
        </div>
        <div>
          <NotAFitControl rec={rec} />
        </div>
      </div>
    </Fold>
  );
}

/**
 * "Suggest to a couple" — the vendor picks WHICH connected couple to suggest this
 * buyable add-on to. Mirrors the panel's existing collapse-to-form pattern
 * (SuggestControl / NotAFitControl): a subtle trigger that opens a tiny form with
 * a couple <select> + hidden addon_key + submit → suggestToCouple. With no
 * accepted-thread couples, shows a muted "Connect with a couple first" hint
 * instead. Once a (couple, add-on) pair is already suggested, that couple drops
 * out of the picker; if all connected couples have been suggested this add-on, it
 * shows "Suggested ✓".
 */
function SuggestToCoupleControl({
  addonKey,
  title,
  connectedCouples,
  suggestedSet,
}: {
  addonKey: string;
  /** The add-on's name — the sheet says what is being suggested. */
  title: string;
  connectedCouples: ConnectedCouple[];
  suggestedSet: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const headId = useId();

  // No connected couples → nothing to suggest to yet.
  if (connectedCouples.length === 0) {
    return (
      <p className="text-[14px] text-[color:var(--m-slate-2)]">
        Connect with a couple first to suggest this.
      </p>
    );
  }

  // Couples this add-on hasn't been suggested to yet (a sent suggestion drops the
  // couple out so the vendor can't re-suggest the same pair).
  const remaining = connectedCouples.filter(
    (c) => !suggestedSet.has(`${c.eventId}::${addonKey}`),
  );

  if (remaining.length === 0) {
    return (
      <ToolChip tone="ok">Suggested&nbsp;&#10003;</ToolChip>
    );
  }

  return (
    <>
      <ActionButton tone="neutral" icon={Send} label="Suggest to a couple" onClick={() => setOpen(true)} />
      <Sheet open={open} onClose={() => setOpen(false)} labelledById={headId}>
          <form
            action={suggestToCouple}
            className="flex flex-col gap-2.5 px-5 pb-6 pt-5"
          >
            <input type="hidden" name="addon_key" value={addonKey} />
            <div>
              <h2 id={headId} className="sn-sheet-name pr-12 text-ink">
                Suggest to a couple
              </h2>
              <p className="text-[14px] text-[color:var(--m-slate-2)]">{title} · they see it in their Studio</p>
            </div>
            <div className="relative">
              <select
                name="event_id"
                required
                defaultValue=""
                className="input-field cursor-pointer appearance-none pr-9"
              >
                <option value="" disabled>
                  Pick a couple…
                </option>
                {remaining.map((c) => (
                  <option key={c.eventId} value={c.eventId}>
                    {c.label}
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
              maxLength={280}
              placeholder="Add a short note for the couple (optional)"
              className="input-field resize-none text-sm"
            />
            <div className="flex items-center justify-end gap-3">
              <SubmitButton
                className="button-primary inline-flex w-full items-center justify-center gap-1.5"
                pendingLabel="Suggesting…"
              >
                Suggest
              </SubmitButton>
            </div>
          </form>
      </Sheet>
    </>
  );
}

/** "Not a fit for me" — collapses to a confirmation form (optional note). When a
 *  pending flag already exists, shows the "pending review" pill instead. */
function NotAFitControl({ rec }: { rec: RecCard }) {
  const [open, setOpen] = useState(false);
  const headId = useId();

  if (rec.flaggedNotAFit) {
    return (
      <ToolChip tone="wait">Flagged — pending review</ToolChip>
    );
  }

  return (
    <>
      <ActionButton tone="neutral" quiet icon={ThumbsDown} label="Not a fit for me" onClick={() => setOpen(true)} />
      <Sheet open={open} onClose={() => setOpen(false)} labelledById={headId}>
        <StayForm
          door="svRecommendations.flagFeedback"
          action={flagFeedback}
          className="flex flex-col gap-2.5 px-5 pb-6 pt-5"
        >
          <input type="hidden" name="feedback_type" value="not_a_fit" />
          <input type="hidden" name="tile_id" value={rec.tileId} />
          <input type="hidden" name="service_code" value={rec.serviceCode} />
          <div>
            <h2 id={headId} className="sn-sheet-name pr-12 text-ink">
              Not a fit for me
            </h2>
            <p className="text-[14px] text-[color:var(--m-slate-2)]">{rec.title} · Tell us why this doesn&rsquo;t fit (optional)</p>
          </div>
          <textarea
            name="note"
            rows={2}
            maxLength={1000}
            placeholder="e.g. I already include this · it competes with my package · not relevant to my couples"
            className="input-field resize-none text-sm"
          />
          <div className="flex items-center justify-end gap-3">
            <SubmitButton
              className="button-primary inline-flex w-full items-center justify-center gap-1.5"
              pendingLabel="Sending…"
            >
              Send flag
            </SubmitButton>
          </div>
        </StayForm>
      </Sheet>
    </>
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
  const headId = useId();

  if (alreadyFlagged) {
    return (
      <ToolChip tone="wait">Suggestion pending review</ToolChip>
    );
  }

  return (
    <>
      <ActionButton tone="neutral" quiet icon={Plus} label="Suggest a service" name="Suggest a service to recommend" onClick={() => setOpen(true)} />
      <Sheet open={open} onClose={() => setOpen(false)} labelledById={headId}>
        <StayForm
          door="svRecommendations.flagFeedback"
          action={flagFeedback}
          className="flex flex-col gap-2.5 px-5 pb-6 pt-5"
        >
          <input type="hidden" name="feedback_type" value="suggest_add" />
          <input type="hidden" name="tile_id" value={tileId} />
          <h2 id={headId} className="sn-sheet-name pr-12 text-ink">
            Suggest a service we should recommend here
          </h2>
          <div className="relative">
            <select
              name="service_code"
              defaultValue=""
              className="input-field cursor-pointer appearance-none pr-9"
            >
              <option value="">Pick a service (optional)…</option>
              {options.map((o) => (
                <option key={o.serviceCode} value={o.serviceCode}>
                  {o.priceLabel ? `${o.title} · ${o.priceLabel}` : o.title}
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
            <SubmitButton
              className="button-primary inline-flex w-full items-center justify-center gap-1.5"
              pendingLabel="Sending…"
            >
              Send suggestion
            </SubmitButton>
          </div>
        </StayForm>
      </Sheet>
    </>
  );
}
