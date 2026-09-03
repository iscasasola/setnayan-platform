'use client';

/**
 * Section 04 — "Make it real" (MB7). Ported from the agreed prototype
 * (atelier-board.html §04), adapted to this app's real data model and
 * Tailwind visual language rather than the prototype's own CSS.
 *
 * FREE, FOREVER, ON EVERY TILE: a colour-swatch preview built from the
 * couple's OWN resolved colours (never a stock photo, never a credit).
 *
 * PAID (simulated in this session — see below): a "Make it real" / "The
 * whole look" tier, gated on having BOTH a deliberately-chosen colour and a
 * reference photo (owner, 2026-09-03). Costs are stated in CREDITS ONLY —
 * see `moodboard-make-it-real.test.ts`'s peso guard.
 *
 * 🔒 WHAT IS SIMULATED, AND WHY. MB7 is the free-tier render SURFACE — the
 * provider call, the real debit (`moodboard_reserve_render_credits`) and the
 * render cache are MB8/MB9, not built yet. Clicking "Generate" here does NOT
 * call the provider and does NOT spend a real credit: it only updates this
 * component's own React state (Lock / Keep / stale marking are explicitly
 * UI STATE ONLY per MB7.md) and decrements a LOCAL, session-only copy of the
 * credit count. Nothing here is persisted, and the tile is honestly tagged
 * "✦ Photoreal — simulated" — never claimed as a real image. The credit
 * BALANCE shown at rest and the BUY button are real (moodboard_render_balance
 * + a genuine apply-then-pay order for MOODBOARD_RENDER_PACK).
 */

import { useMemo, useRef, useState } from 'react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { nearestColorName } from '@/lib/color-names';
import { type RolePalette } from '@/lib/mood-board';
import { type PartId, type ReceptionDesign } from '@/lib/reception-scene';
import { type RenderPart, type MoodboardRenderConfig } from '@/lib/moodboard-render-parts';
import { type MoodboardRenderBalance } from '@/lib/moodboard-render-credits';
import {
  buildTileViewModel,
  colorsForPart,
  colorsForWholeLook,
  designRevisionKey,
  eligiblePartsForVenue,
  EMPTY_PART_STATE,
  gridParts,
  briefColorLine,
  briefZoneLines,
  briefWholeLookZoneLines,
  referencePhotoCount,
  renderGateForPart,
  renderGateForWholeLook,
  type PartRenderState,
  type PartWorkState,
  type TileViewModel,
} from '@/lib/moodboard-make-it-real';
import { InfoButton } from './info-button';
import {
  ChoosePlanSheet,
  type ChoosePlanSheetProps,
  type ChoosePlanSku,
} from '@/app/_components/app-store/choose-plan-sheet';

const WHOLE_LOOK_ID = 'whole_look';

type PartGroupTitle = { key: RenderPart['group']; title: string };
const PART_GROUPS: PartGroupTitle[] = [
  { key: 'room', title: 'The room' },
  { key: 'people', title: 'The people' },
  { key: 'places', title: 'The places' },
];

function swatchBackground(hexes: readonly string[]): string {
  if (hexes.length === 0) return 'transparent';
  if (hexes.length === 1) return `linear-gradient(160deg, ${hexes[0]}, ${hexes[0]}aa)`;
  return `linear-gradient(115deg, ${hexes.join(', ')})`;
}

export type MakeItRealProps = {
  eventId: string;
  /** RENDER_PARTS, pre-filtered to attire roles actually present on this event's guest list. */
  eligibleParts: RenderPart[];
  palette: RolePalette;
  receptionDesign: ReceptionDesign;
  /** Inspiration slot keys that currently hold at least one photo. */
  inspirationPresence: string[];
  venueSetting: string | null;
  venueLabel: string;
  config: MoodboardRenderConfig | null;
  /** null = not permitted to know (moodboard_render_balance returned zero rows) — never a fabricated zero. */
  balance: MoodboardRenderBalance | null;
  packPlan: ChoosePlanSku | null;
  checkoutSettings: ChoosePlanSheetProps['settings'];
};

export function MakeItReal({
  eventId,
  eligibleParts,
  palette,
  receptionDesign,
  inspirationPresence,
  venueSetting,
  venueLabel,
  config,
  balance,
  packPlan,
  checkoutSettings,
}: MakeItRealProps) {
  const inspirationPresenceSet = useMemo(
    () => new Set(inspirationPresence),
    [inspirationPresence],
  );
  // A room part the venue does not have (a beach's ceiling, a garden's
  // walls) is dropped BEFORE it can become a tile, a suggestion, or a
  // chooser entry — "excluded from the render brief, not just hidden".
  const venueEligibleParts = useMemo(
    () => eligiblePartsForVenue(eligibleParts, venueSetting),
    [eligibleParts, venueSetting],
  );
  const ctx = useMemo(
    () => ({ palette, receptionDesign, inspirationPresence: inspirationPresenceSet, venueSetting }),
    [palette, receptionDesign, inspirationPresenceSet, venueSetting],
  );
  const currentRevisionKey = useMemo(
    () => designRevisionKey(palette, receptionDesign, venueSetting),
    [palette, receptionDesign, venueSetting],
  );

  const [partStates, setPartStates] = useState<Record<string, PartRenderState>>({});
  const [addedParts, setAddedParts] = useState<Set<string>>(new Set());
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  // Session-only, optimistic. Starts from the REAL balance; never written back
  // to it. `null` mirrors "not permitted to know" through the whole surface.
  const [localCreditsLeft, setLocalCreditsLeft] = useState<number | null>(
    balance?.creditsLeft ?? null,
  );
  const [chooserOpen, setChooserOpen] = useState(false);
  const chooserRef = useRef<HTMLDivElement>(null);
  useModalA11y({ open: chooserOpen, onClose: () => setChooserOpen(false), containerRef: chooserRef });

  const stateFor = (id: string): PartRenderState => partStates[id] ?? EMPTY_PART_STATE;
  const patchState = (id: string, patch: Partial<PartRenderState>) =>
    setPartStates((prev) => ({ ...prev, [id]: { ...stateFor(id), ...patch } }));

  const work = useMemo(() => {
    const m = new Map<string, PartWorkState>();
    for (const [id, st] of Object.entries(partStates)) {
      m.set(id, {
        added: addedParts.has(id),
        hasWork: !!(st.generated || st.locked || st.kept || st.note || st.briefOpen),
        committed: !!(st.generated || st.locked || st.kept || st.note),
      });
    }
    for (const id of addedParts) if (!m.has(id)) m.set(id, { added: true });
    return m;
  }, [partStates, addedParts]);

  const { own, suggested } = gridParts(venueEligibleParts, ctx, work, dismissedSuggestions);
  const shown = [...own, ...suggested];
  const shownIds = new Set(shown.map((p) => p.id));
  const chooserGroups = PART_GROUPS.map((g) => ({
    ...g,
    parts: venueEligibleParts.filter((p) => p.group === g.key && !shownIds.has(p.id)),
  })).filter((g) => g.parts.length > 0);

  const configUnavailable = !config;

  function buildPartTile(part: RenderPart, isSuggested: boolean): TileViewModel & { part: RenderPart } {
    const cost = configUnavailable ? 0 : config!.creditsPerPart;
    const hexes = colorsForPart(part, palette);
    const gate = renderGateForPart(part, ctx);
    const lines = [
      briefColorLine(hexes, nearestColorName),
      ...(part.group === 'room'
        ? briefZoneLines(part.sourceKey as PartId, receptionDesign, venueSetting)
        : []),
      `Reference photos — ${referencePhotoCount(part, inspirationPresenceSet)} uploaded`,
    ];
    const vm = buildTileViewModel({
      id: part.id,
      label: part.label,
      cost,
      hexes,
      gate,
      briefLines: lines,
      state: stateFor(part.id),
      currentRevisionKey,
    });
    return { ...vm, part };
  }

  function buildWholeTile(): TileViewModel {
    const cost = configUnavailable ? 0 : config!.creditsWholeLook;
    const hexes = colorsForWholeLook(palette);
    const gate = renderGateForWholeLook(ctx);
    const lines = [
      briefColorLine(hexes, nearestColorName),
      ...briefWholeLookZoneLines(receptionDesign, venueSetting),
    ];
    return buildTileViewModel({
      id: WHOLE_LOOK_ID,
      label: 'The whole look',
      cost,
      hexes,
      gate,
      briefLines: lines,
      state: stateFor(WHOLE_LOOK_ID),
      currentRevisionKey,
    });
  }

  function generate(id: string, vm: TileViewModel) {
    if (localCreditsLeft === null || localCreditsLeft < vm.cost) return;
    setLocalCreditsLeft(localCreditsLeft - vm.cost);
    patchState(id, {
      generated: { revisionKey: currentRevisionKey, hexes: vm.hexes, note: stateFor(id).note.trim() },
      kept: false,
      briefOpen: false,
    });
  }

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section id="make-it-real" className="scroll-mt-24 space-y-4 border-t border-ink/10 pt-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <h2 className="text-2xl font-semibold text-ink">Make it real</h2>
            <InfoButton label="About make it real">
              Designed parts earn a photoreal render — one for each element, or five credits for the
              whole reception in one photo. Every tile shows a free colour preview forever; a paid
              render needs a photo and your colours for that part first.
            </InfoButton>
          </div>
          <p className="max-w-prose text-sm text-ink/65">
            A free colour preview on every box, always. Spend credits to see it as a real photo.
          </p>
        </div>

        <div id="make-it-real-credits" className="flex flex-col items-end gap-1.5 text-right">
          {balance === null ? (
            <p className="text-xs text-ink/55">Render credits aren&rsquo;t available for you here.</p>
          ) : (
            <p className="text-sm font-semibold text-ink/75">
              Credits ·{' '}
              <strong className="text-ink">
                {balance.creditsGranted > 0 ? `${localCreditsLeft ?? balance.creditsLeft} left` : 'none yet'}
              </strong>
            </p>
          )}
          <p className="max-w-[34ch] text-xs text-ink/45">
            {configUnavailable
              ? 'Make it real is temporarily unavailable.'
              : `1 credit per part · ${config!.creditsWholeLook} for the whole look. Payment is verified by hand (~a day).`}
          </p>
          {packPlan ? (
            <ChoosePlanSheet
              eventId={eventId}
              triggerLabel={`Buy ${packPlan.name}`}
              priceFromLabel={packPlan.price}
              plans={[packPlan]}
              introCopy="One pack of Mood Board render credits — use them across every part, or the whole look, whenever you're ready."
              settings={checkoutSettings}
            />
          ) : null}
        </div>
      </header>

      {configUnavailable ? null : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <WholeLookTile
              vm={buildWholeTile()}
              onToggleBrief={() =>
                patchState(WHOLE_LOOK_ID, { briefOpen: !stateFor(WHOLE_LOOK_ID).briefOpen })
              }
              onScrollTo={scrollTo}
              localCreditsLeft={localCreditsLeft}
              state={stateFor(WHOLE_LOOK_ID)}
              onNoteChange={(note) => patchState(WHOLE_LOOK_ID, { note })}
              onGenerate={(vm) => generate(WHOLE_LOOK_ID, vm)}
              onLock={() => patchState(WHOLE_LOOK_ID, { locked: true, briefOpen: false })}
              onUnlock={() => patchState(WHOLE_LOOK_ID, { locked: false })}
              onKeep={() => patchState(WHOLE_LOOK_ID, { kept: !stateFor(WHOLE_LOOK_ID).kept })}
              maxNoteChars={config!.maxNoteChars}
              venueLabel={venueLabel}
            />

            {own.map((part) => (
              <PartTile
                key={part.id}
                vm={buildPartTile(part, false)}
                isSuggested={false}
                onToggleBrief={() => patchState(part.id, { briefOpen: !stateFor(part.id).briefOpen })}
                onScrollTo={scrollTo}
                localCreditsLeft={localCreditsLeft}
                state={stateFor(part.id)}
                onNoteChange={(note) => patchState(part.id, { note })}
                onGenerate={(vm) => generate(part.id, vm)}
                onLock={() => patchState(part.id, { locked: true, briefOpen: false })}
                onUnlock={() => patchState(part.id, { locked: false })}
                onKeep={() => patchState(part.id, { kept: !stateFor(part.id).kept })}
                onRemove={
                  !stateFor(part.id).note
                    ? () => {
                        setAddedParts((prev) => {
                          const next = new Set(prev);
                          next.delete(part.id);
                          return next;
                        });
                        setPartStates((prev) => {
                          const next = { ...prev };
                          delete next[part.id];
                          return next;
                        });
                      }
                    : undefined
                }
                maxNoteChars={config!.maxNoteChars}
                venueLabel={venueLabel}
              />
            ))}
            {suggested.map((part) => (
              <PartTile
                key={part.id}
                vm={buildPartTile(part, true)}
                isSuggested
                onToggleBrief={() => patchState(part.id, { briefOpen: !stateFor(part.id).briefOpen })}
                onScrollTo={scrollTo}
                localCreditsLeft={localCreditsLeft}
                state={stateFor(part.id)}
                onNoteChange={(note) => patchState(part.id, { note })}
                onGenerate={(vm) => generate(part.id, vm)}
                onLock={() => patchState(part.id, { locked: true, briefOpen: false })}
                onUnlock={() => patchState(part.id, { locked: false })}
                onKeep={() => patchState(part.id, { kept: !stateFor(part.id).kept })}
                onRemove={() =>
                  setDismissedSuggestions((prev) => new Set(prev).add(part.id))
                }
                maxNoteChars={config!.maxNoteChars}
                venueLabel={venueLabel}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {shown.length === 0 ? (
              <p className="text-sm text-ink/55">Parts you design above appear here.</p>
            ) : null}
            {shown.length < venueEligibleParts.length ? (
              <button
                type="button"
                onClick={() => setChooserOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-dashed border-ink/20 px-3 py-2 text-xs font-medium text-ink/65 transition-colors hover:border-terracotta hover:text-terracotta"
              >
                + Render another part
              </button>
            ) : null}
          </div>
        </>
      )}

      {chooserOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close part chooser"
            onClick={() => setChooserOpen(false)}
            className="absolute inset-0"
          />
          <div
            ref={chooserRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="part-chooser-title"
            className="relative max-h-[80dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-ink/10 bg-cream p-5 shadow-xl"
          >
            <h3 id="part-chooser-title" className="text-lg font-semibold text-ink">
              Render another part
            </h3>
            <div className="mt-3 space-y-4">
              {chooserGroups.length === 0 ? (
                <p className="text-sm text-ink/55">Every part is already on the board.</p>
              ) : (
                chooserGroups.map((g) => (
                  <div key={g.key}>
                    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                      {g.title}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {g.parts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setAddedParts((prev) => new Set(prev).add(p.id));
                            setChooserOpen(false);
                          }}
                          className="rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-ink/75 hover:border-terracotta hover:text-terracotta"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setChooserOpen(false)}
                className="rounded-lg px-3 py-2 text-xs font-medium text-ink/55 hover:bg-ink/5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/* ── shared tile chrome ──────────────────────────────────────────────────── */

type TileChromeProps = {
  vm: TileViewModel;
  hero?: boolean;
  isSuggested?: boolean;
  venueLabel: string;
  state: PartRenderState;
  localCreditsLeft: number | null;
  maxNoteChars: number;
  onToggleBrief: () => void;
  onScrollTo: (id: string) => void;
  onNoteChange: (note: string) => void;
  onGenerate: (vm: TileViewModel) => void;
  onLock: () => void;
  onUnlock: () => void;
  onKeep: () => void;
  onRemove?: () => void;
};

function TileChrome({
  vm,
  hero,
  isSuggested,
  venueLabel,
  state,
  localCreditsLeft,
  maxNoteChars,
  onToggleBrief,
  onScrollTo,
  onNoteChange,
  onGenerate,
  onLock,
  onUnlock,
  onKeep,
  onRemove,
}: TileChromeProps) {
  const canAfford = localCreditsLeft !== null && localCreditsLeft >= vm.cost;
  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm ${
        hero ? 'col-span-2 sm:col-span-4' : ''
      }`}
    >
      <div
        className={`relative ${hero ? 'aspect-[8/3]' : 'aspect-[4/3]'} ${
          state.generated ? 'ring-4 ring-inset ring-white/10' : ''
        }`}
        style={{ background: swatchBackground(vm.hexes) }}
      >
        <span className="absolute left-1.5 top-1.5 rounded-full bg-ink/55 px-2 py-0.5 text-[10px] font-bold text-white">
          {vm.tag}
        </span>
        {vm.staleBannerText ? (
          <div className="absolute inset-x-0 bottom-0 bg-ink/65 px-2 py-1 text-[10px] font-semibold text-white">
            {vm.staleBannerText}
          </div>
        ) : null}
      </div>

      <div className="px-3 pt-2.5 text-sm font-semibold text-ink">
        {vm.label} ·{' '}
        <span className="font-normal text-ink/55">
          {vm.hasColor ? nearestColorName(vm.hexes[0]!) ?? vm.hexes[0] : 'waiting for your colours'}
        </span>
        {isSuggested ? (
          <span className="ml-1.5 rounded-full bg-terracotta/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-terracotta">
            Suggested
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2.5 text-xs">
        {!state.generated ? (
          !vm.gate.ok ? (
            <>
              <span className="basis-full text-ink/60">
                To render this, add {[vm.gate.needPhoto && 'an inspiration photo', vm.gate.needColor && 'your colours']
                  .filter(Boolean)
                  .join(' and ')}{' '}
                first.
              </span>
              {vm.gate.needPhoto ? (
                <button
                  type="button"
                  onClick={() => onScrollTo('inspiration')}
                  className="rounded-md px-2 py-1 font-medium text-ink/55 hover:bg-ink/5 hover:text-terracotta"
                >
                  + Add a photo
                </button>
              ) : null}
              {vm.gate.needColor ? (
                <button
                  type="button"
                  onClick={() => onScrollTo('palette')}
                  className="rounded-md px-2 py-1 font-medium text-ink/55 hover:bg-ink/5 hover:text-terracotta"
                >
                  Pick your colours
                </button>
              ) : null}
            </>
          ) : canAfford ? (
            <button
              type="button"
              onClick={onToggleBrief}
              className={
                hero
                  ? 'rounded-full bg-mulberry px-4 py-2 font-semibold text-cream hover:bg-mulberry-600'
                  : 'rounded-md border border-ink/15 px-2.5 py-1.5 font-medium text-ink/75 hover:border-terracotta hover:text-terracotta'
              }
            >
              {hero ? 'The whole look' : 'Make it real'} · {vm.costLabel}
            </button>
          ) : (
            <>
              <span className="font-semibold text-danger-700">
                {hero ? 'The whole look' : 'A render'} · {vm.costLabel} — you have {localCreditsLeft ?? 0}
              </span>
              <button
                type="button"
                onClick={() => document.getElementById('make-it-real-credits')?.scrollIntoView({ behavior: 'smooth' })}
                className="rounded-md px-2 py-1 font-medium text-ink/55 hover:bg-ink/5 hover:text-terracotta"
              >
                Buy more credits
              </button>
            </>
          )
        ) : state.locked ? (
          <>
            <span className="text-ink/45">🔒 Locked — kept as is</span>
            <button type="button" onClick={onUnlock} className="rounded-md px-2 py-1 font-medium text-ink/55 hover:bg-ink/5">
              Unlock
            </button>
            <button type="button" onClick={onKeep} className="rounded-md px-2 py-1 font-medium text-ink/55 hover:bg-ink/5">
              {state.kept ? '✓ Kept' : 'Keep photo'}
            </button>
          </>
        ) : (
          <>
            {!vm.gate.ok ? (
              <span className="basis-full text-ink/60">Regenerating needs the same photo and colours again.</span>
            ) : canAfford ? (
              <button type="button" onClick={onToggleBrief} className="rounded-md border border-ink/15 px-2.5 py-1.5 font-medium text-ink/75 hover:border-terracotta hover:text-terracotta">
                Regenerate · {vm.costLabel}
              </button>
            ) : (
              <span className="font-semibold text-danger-700">
                Needs {vm.costLabel} — you have {localCreditsLeft ?? 0}
              </span>
            )}
            <button type="button" onClick={onKeep} className="rounded-md px-2 py-1 font-medium text-ink/55 hover:bg-ink/5">
              {state.kept ? '✓ Kept' : 'Keep photo'}
            </button>
            <button type="button" onClick={onLock} className="rounded-md px-2 py-1 font-medium text-ink/55 hover:bg-ink/5">
              Lock this preview
            </button>
          </>
        )}
        {onRemove ? (
          <button type="button" onClick={onRemove} className="rounded-md px-2 py-1 font-medium text-ink/40 hover:bg-ink/5 hover:text-danger-700">
            Remove
          </button>
        ) : null}
      </div>

      {state.briefOpen && !state.locked ? (
        <div className="space-y-1.5 border-t border-dashed border-ink/10 px-3 py-2.5 text-xs">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink/40">From your board</p>
          <p className="text-ink/70">Venue — {venueLabel}</p>
          {vm.briefLines.map((line) => (
            <p key={line} className="text-ink/70">
              {line}
            </p>
          ))}
          <label className="mt-1.5 flex flex-col gap-1 font-semibold text-ink/70">
            <span>Anything else we should know?</span>
            <input
              type="text"
              maxLength={maxNoteChars}
              value={state.note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="e.g. it's outdoors · lola's veil on the chair"
              className="min-h-[36px] rounded-md border border-ink/15 bg-white px-2 py-1 text-xs font-normal text-ink placeholder:text-ink/35 focus:border-terracotta focus:outline-none"
            />
          </label>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {canAfford ? (
              <button
                type="button"
                onClick={() => onGenerate(vm)}
                className="rounded-full bg-mulberry px-3.5 py-1.5 font-semibold text-cream hover:bg-mulberry-600"
              >
                {hero ? 'Generate the whole look' : 'Generate'} · {vm.costLabel}
              </button>
            ) : (
              <>
                <span className="font-semibold text-danger-700">
                  Needs {vm.costLabel} — you have {localCreditsLeft ?? 0}
                </span>
                <button
                  type="button"
                  onClick={() => document.getElementById('make-it-real-credits')?.scrollIntoView({ behavior: 'smooth' })}
                  className="rounded-md px-2 py-1 font-medium text-ink/55 hover:bg-ink/5 hover:text-terracotta"
                >
                  Buy more credits
                </button>
              </>
            )}
            <button type="button" onClick={onToggleBrief} className="rounded-md px-2 py-1 font-medium text-ink/45 hover:bg-ink/5">
              Not now
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WholeLookTile(props: Omit<TileChromeProps, 'hero' | 'isSuggested'>) {
  return <TileChrome {...props} hero />;
}

function PartTile(props: TileChromeProps & { isSuggested: boolean }) {
  return <TileChrome {...props} />;
}
