'use client';

/**
 * Section 04 — "Make it real" (MB7). Ported from the agreed prototype
 * (atelier-board.html §04), adapted to this app's real data model and
 * Tailwind visual language rather than the prototype's own CSS.
 *
 * FREE, FOREVER, ON EVERY TILE: a colour-swatch preview built from the
 * couple's OWN resolved colours (never a stock photo, never a credit).
 *
 * PAID: a "Make it real" / "The whole look" tier, gated on having BOTH a
 * deliberately-chosen colour and a reference photo (owner, 2026-09-03). Costs
 * are stated in CREDITS ONLY — see `moodboard-make-it-real.test.ts`'s peso
 * guard.
 *
 * ── MB8 MADE THIS REAL. NOTHING HERE IS SIMULATED ANY MORE ────────────────
 * `Generate` calls `requestRender` (render-actions.ts), which debits a real
 * credit and calls a real image model. MB7's session-only decrement is gone:
 * the counter now moves because the ledger moved, and every outcome is read
 * back from the server rather than assumed.
 *
 * 🔑 THE ONE RULE THIS COMPONENT EXISTS TO HOLD: **A FAILED RENDER LOOKS
 * NOTHING LIKE A SUCCESS AND NOTHING LIKE AN IDLE TILE.**
 *
 * The three outcomes of `requestRender` land in three distinct pieces of tile
 * state and three distinct pieces of markup:
 *   · `rendered`     → the photograph, tagged "✦ Photoreal"
 *   · `insufficient` → "you have N credits" + the pack. NOT an error.
 *   · `failed`       → `vm.failure`, printed ON THE BOX: a headline, the
 *                      sentence, and the fact that the credit came back.
 *
 * ⚠ AND `pending` IS NOT OPTIONAL POLISH. A tile that looks idle while a
 * render is in flight invites a second click and a second credit; a tile that
 * looks busy forever after the request died is the stuck upload chip. So
 * `pending` disables the button AND is cleared on every exit path — there is
 * no `return` in `generate()` that leaves it set.
 *
 * The failure text comes from `RENDER_FAILURE_COPY`, which is exhaustive over
 * the provider's failure union by TYPE, so a new failure mode cannot reach a
 * couple as a blank tile — it cannot compile without a sentence.
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
  requestRender,
  readRenderBalance,
  abandonStalledRender,
  setShareConsent,
  type RenderActionResult,
} from '../render-actions';
import {
  classifyRender,
  failureCodeOf,
  type EventRenderRow,
} from '@/lib/moodboard-render-gallery';
import { renderFailureCopy } from '@/lib/moodboard-render-failure';
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
  /**
   * MB8 — this event's own renders, newest first, each with a short-lived
   * viewing URL minted server-side.
   *
   * 🔑 `null` MEANS THE READ WAS REFUSED, NOT THAT THERE ARE NONE. The two
   * render as different sentences below. This is the guest-list failure's
   * shape exactly — a couple with forty photographs must never be shown "no
   * renders yet".
   */
  renders: RenderGalleryItem[] | null;
  /** MB8 — has this event agreed to be featured (and taken the +1 render)? */
  shareConsented: boolean;
};

/** One row of the couple's gallery, with its viewing URL resolved. */
export type RenderGalleryItem = EventRenderRow & {
  /** Presigned GET, or `null` when one could not be minted for this row. */
  imageUrl: string | null;
  /** The part's human label, resolved server-side from the derived registry. */
  partLabel: string;
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
  renders,
  shareConsented,
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
  // MB8: no longer optimistic. Starts from the REAL balance and is only ever
  // replaced by a number the SERVER returned — after a debit, after a refund,
  // after a bonus grant. MB7 decremented this locally because nothing was
  // really spent; now something is, and a locally-guessed balance would drift
  // from the ledger the moment any call failed.
  // `null` mirrors "not permitted to know" through the whole surface and is
  // never replaced by a fabricated zero.
  const [localCreditsLeft, setLocalCreditsLeft] = useState<number | null>(
    balance?.creditsLeft ?? null,
  );
  const [consented, setConsented] = useState(shareConsented);
  const [consentPending, setConsentPending] = useState(false);
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

  /**
   * Spend a credit and get a photograph — the real thing (MB8).
   *
   * Every exit path clears `pending` and sets exactly one of `generated`,
   * `failure` or `insufficient`. There is deliberately no `finally`-less
   * branch and no early `return` after the request starts: a tile left
   * `pending` is the stuck chip, and a tile left blank after a failure is the
   * silent nothing.
   */
  async function generate(id: string, vm: TileViewModel) {
    if (stateFor(id).pending) return; // never two credits for one click
    patchState(id, { pending: true, failure: null, insufficient: false, briefOpen: false });

    const revisionKeyAtRequest = currentRevisionKey;
    let result: RenderActionResult;
    try {
      result = await requestRender({
        eventId,
        partId: id,
        note: stateFor(id).note.trim() || null,
      });
    } catch {
      // The action threw where it promised not to (a network drop between the
      // browser and us, a deploy mid-flight). The couple must still be told,
      // and told the truth: we do not know whether the credit moved, so this
      // says so rather than claiming a refund we cannot vouch for.
      patchState(id, { pending: false, failure: { code: 'network' } });
      return;
    }

    if (result.status === 'insufficient') {
      patchState(id, { pending: false, insufficient: true });
      setLocalCreditsLeft(result.creditsLeft);
      return;
    }
    if (result.status === 'failed') {
      patchState(id, { pending: false, failure: { code: result.code } });
      // The balance is re-read even on a failure, because the refund has
      // already landed server-side and the counter must show it. A decremented
      // balance sitting next to "your credit is back" is the contradiction
      // that makes a couple distrust both numbers.
      void refreshBalance();
      return;
    }

    patchState(id, {
      pending: false,
      failure: null,
      insufficient: false,
      generated: {
        revisionKey: revisionKeyAtRequest,
        hexes: vm.hexes,
        note: stateFor(id).note.trim(),
        renderId: result.renderId,
        imageUrl: result.imageUrl,
      },
      kept: false,
    });
    setLocalCreditsLeft(result.creditsLeft);
  }

  /** Re-read the balance from the ledger. `null` stays `null` — see the counter. */
  async function refreshBalance() {
    try {
      const r = await readRenderBalance({ eventId });
      setLocalCreditsLeft(r.creditsLeft);
    } catch {
      // A failed balance re-read must not overwrite a good number with a
      // fabricated zero. Leaving it stale is the lesser lie, and the next
      // page load fixes it.
    }
  }

  /**
   * Hand back the credit for a render that stopped without ever reporting.
   *
   * The action revalidates the page, so the gallery row re-reads as `failed`
   * from the database rather than being patched optimistically here — the
   * refund is a server fact and the surface should show the server's version
   * of it, not a hopeful local copy.
   */
  async function abandon(renderId: string) {
    await abandonStalledRender({ eventId, renderId }).catch(() => undefined);
    void refreshBalance();
  }

  async function toggleConsent(next: boolean) {
    setConsentPending(true);
    const r = await setShareConsent({ eventId, consented: next }).catch(() => null);
    setConsentPending(false);
    if (r?.ok) {
      setConsented(next);
      setLocalCreditsLeft(r.creditsLeft);
    }
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

          {/* ── the +1 consent bonus (owner design lock 2026-06-09) ────────
              The offer is one extra render for letting Setnayan feature the
              creation. Two things this copy must be honest about, because the
              lock is specific and a vague version would overclaim:
                · consent decides only whether a creation may be SHOWN
                  publicly — Setnayan keeps and reviews every render either
                  way, and saying otherwise here would be false;
                · the bonus is granted once, and withdrawing consent does not
                  take it back.
              The grant happens inside the RPC, so a couple can never end up
              consenting without receiving the render they were promised. */}
          <div className="rounded-xl border border-terracotta/25 bg-terracotta/5 p-3.5">
            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={consented}
                disabled={consentPending}
                onChange={(e) => void toggleConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-terracotta"
              />
              <span className="space-y-1">
                <span className="block font-semibold text-ink">
                  Let Setnayan feature your creation — get 1 extra render
                  {consented ? ' ✓' : ''}
                </span>
                <span className="block text-xs text-ink/60">
                  We may show your renders in our own galleries and marketing. You can turn this
                  off any time, which un-features anything already shown — the bonus render stays
                  yours. Setnayan can always see and keep your renders for quality and to build
                  our own design library; this choice is only about showing them publicly.
                </span>
              </span>
            </label>
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

          <RenderGallery renders={renders} onAbandon={(id) => void abandon(id)} />
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

/* ── the couple's own gallery ─────────────────────────────────────────────── */

/**
 * Every render this event has made, newest first.
 *
 * 🔑 THREE STATES, THREE SENTENCES, AND THE FIRST ONE IS WHY THIS COMPONENT
 * IS WRITTEN THIS WAY:
 *   · `renders === null` — the read FAILED. Say that. A couple who has bought
 *     a pack and made forty photographs must never be shown "no renders yet"
 *     because a gate said no. That exact substitution told a couple with 180
 *     guests that their wedding was empty. (Written without a peso figure on
 *     purpose — MB7's guard forbids the symbol anywhere in this file, comments
 *     included, and keeping it that blunt is worth more than the example.)
 *   · `renders.length === 0` — answered, and genuinely none. The invitation
 *     to start is CORRECT here and only here.
 *   · rows — the gallery, with failed and stalled rows shown AS failures
 *     rather than hidden, so a couple can see what happened to every credit.
 */
function RenderGallery({
  renders,
  onAbandon,
}: {
  renders: RenderGalleryItem[] | null;
  onAbandon: (renderId: string) => void;
}) {
  if (renders === null) {
    return (
      <div className="rounded-xl border border-ink/10 bg-white p-4">
        <p className="text-sm font-semibold text-ink/75">We couldn&rsquo;t load your renders</p>
        <p className="mt-0.5 text-xs text-ink/55">
          Your photos are safe — we just couldn&rsquo;t read them right now. Please reload the
          page. This is not the same as having none.
        </p>
      </div>
    );
  }
  if (renders.length === 0) return null;

  return (
    <section className="space-y-2.5 border-t border-dashed border-ink/10 pt-4">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-medium text-ink/80">Your renders</h3>
        <p className="text-xs text-ink/50">
          {renders.length} {renders.length === 1 ? 'photo' : 'photos'} · only you and Setnayan can
          see these
        </p>
      </header>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {renders.map((r) => {
          const state = classifyRender(r);
          const copy =
            state.kind === 'failed'
              ? renderFailureCopy(failureCodeOf(r.failure_reason))
              : null;
          return (
            <figure
              key={r.render_id}
              className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm"
            >
              <div className="relative aspect-[4/3] bg-ink/5">
                {state.kind === 'ready' && r.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- presigned, short-lived
                  <img
                    src={r.imageUrl}
                    alt={`${r.partLabel} — your render`}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : null}
                {state.kind === 'ready' && !r.imageUrl ? (
                  <div className="absolute inset-0 flex items-center justify-center px-2 text-center text-[10px] font-semibold text-ink/55">
                    Saved — reload to see it
                  </div>
                ) : null}
                {state.kind === 'working' ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-ink/70 px-2 text-center text-[10px] font-semibold text-white">
                    Making your photo…
                  </div>
                ) : null}
                {/* A render that stopped with nobody left to report it. Shown
                    as a FAILURE with the credit named, never as a tile that
                    keeps spinning — that is the stuck upload chip, and it sat
                    at 0% forever because nothing ever said the attempt ended. */}
                {state.kind === 'stalled' ? (
                  <div
                    data-render-failure
                    className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-danger-700/90 px-2 text-center text-white"
                  >
                    <p className="text-[11px] font-bold">This one stopped</p>
                    <p className="text-[10px] leading-snug text-white/90">
                      It never finished. Your {r.credits_debited}{' '}
                      {r.credits_debited === 1 ? 'credit' : 'credits'} {' '}
                      {r.credits_debited === 1 ? 'is' : 'are'} still held.
                    </p>
                    <button
                      type="button"
                      onClick={() => onAbandon(r.render_id)}
                      className="mt-0.5 rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-semibold hover:bg-white/30"
                    >
                      Get the credit back
                    </button>
                  </div>
                ) : null}
                {copy ? (
                  <div
                    data-render-failure
                    className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-danger-700/90 px-2 text-center text-white"
                  >
                    <p className="text-[11px] font-bold">{copy.headline}</p>
                    <p className="text-[10px] leading-snug text-white/90">{copy.detail}</p>
                  </div>
                ) : null}
                {r.featured_at ? (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-mulberry px-2 py-0.5 text-[10px] font-bold text-cream">
                    ★ Featured
                  </span>
                ) : null}
              </div>
              <figcaption className="px-2.5 py-2 text-xs">
                <span className="font-semibold text-ink">{r.partLabel}</span>
                {r.note ? (
                  <span className="mt-0.5 block truncate text-ink/50" title={r.note}>
                    “{r.note}”
                  </span>
                ) : null}
              </figcaption>
            </figure>
          );
        })}
      </div>
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
        {/* The photograph, once there is one. The free colour preview stays
            underneath as the background, so a slow or expired image URL
            degrades to the free swatch rather than to a broken-image icon. */}
        {vm.imageUrl ? (
          // A presigned R2 GET is signed and short-lived; routing it through
          // next/image would need the host allowlisted and would cache a URL
          // that expires out from under the cache.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={vm.imageUrl}
            alt={`${vm.label} — your render`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}

        {/* 🔑 THE FAILURE, ON THE BOX. Not a toast, not a console line, not a
            silently-unchanged tile. It covers the preview so it cannot be
            mistaken for the render having happened, and it is the FIELD
            `vm.failure` — which is what `moodboard-render-failure-reaches-the-
            box.test.ts` pins, so this cannot be quietly deleted. */}
        {vm.failure ? (
          <div
            data-render-failure
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-danger-700/90 px-3 text-center text-white"
          >
            <p className="text-xs font-bold">{vm.failure.headline}</p>
            <p className="text-[10px] leading-snug text-white/90">{vm.failure.detail}</p>
          </div>
        ) : null}

        {/* In flight. A tile that looks idle here invites a second credit. */}
        {vm.pending ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-ink/70 text-center text-white">
            <p className="text-xs font-semibold">Making your photo…</p>
            <p className="text-[10px] text-white/80">This takes up to a minute.</p>
          </div>
        ) : null}

        {/* The render exists but no viewing link could be minted. Saying
            "reload to see it" is true; saying nothing would read as a failure
            for a photograph the couple already owns. */}
        {!vm.imageUrl && !vm.pending && !vm.failure && state.generated ? (
          <div className="absolute inset-x-0 bottom-0 bg-ink/70 px-2 py-1 text-[10px] font-semibold text-white">
            Saved — reload the page to see it
          </div>
        ) : null}

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
        {/* ── MB8: the two outcomes that are neither "idle" nor "done" ──────
            Both sit ABOVE the normal controls, because the freshest fact
            about this tile is what just happened to it. */}
        {vm.insufficient ? (
          <>
            <span className="basis-full font-semibold text-danger-700">
              You don&rsquo;t have {vm.costLabel} left — nothing was made and nothing was
              charged.
            </span>
            <button
              type="button"
              onClick={() =>
                document.getElementById('make-it-real-credits')?.scrollIntoView({ behavior: 'smooth' })
              }
              className="rounded-md border border-ink/15 px-2.5 py-1.5 font-medium text-ink/75 hover:border-terracotta hover:text-terracotta"
            >
              Get more credits
            </button>
          </>
        ) : null}
        {vm.failure ? (
          <>
            <span className="basis-full font-semibold text-danger-700">
              {vm.failure.headline} — your credit was returned.
            </span>
            {/* A retry button on a failure a retry cannot fix would be
                theatre, so `retryable` decides whether it appears at all. */}
            {vm.failure.retryable && vm.gate.ok ? (
              <button
                type="button"
                disabled={vm.pending}
                onClick={() => onGenerate(vm)}
                className="rounded-md border border-ink/15 px-2.5 py-1.5 font-medium text-ink/75 hover:border-terracotta hover:text-terracotta disabled:opacity-50"
              >
                Try again · {vm.costLabel}
              </button>
            ) : null}
          </>
        ) : null}
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
                // Disabled while a render is in flight: a second click here is
                // a second credit for one photograph.
                disabled={vm.pending}
                onClick={() => onGenerate(vm)}
                className="rounded-full bg-mulberry px-3.5 py-1.5 font-semibold text-cream hover:bg-mulberry-600 disabled:opacity-60"
              >
                {vm.pending
                  ? 'Making your photo…'
                  : `${hero ? 'Generate the whole look' : 'Generate'} · ${vm.costLabel}`}
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
