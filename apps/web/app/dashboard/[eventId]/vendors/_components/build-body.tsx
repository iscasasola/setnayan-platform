'use client';

/**
 * BuildBody — THE BUILD BODY of the couple's one-screen Suppliers page (owner
 * 2026-10-07; corpus `SUPPLIERS_BUILD_PLAN_2026-10-07_fable.md` § PR3;
 * prototype `prototypes/suppliers_page_2026-10-07_fable.html`, Build mode).
 *
 *   This build   (or the open build's name, "· edited" once it differs)
 *     N of M categories · ₱total · same as "X"
 *     one line per category: the booked supplier · ONE dropdown of the
 *     couple's own shortlist for it · or "Find in ‹Category›"
 *     Booked · If you book these · Budget · Buffer
 *     ✓ N of M priced picks are free on ‹date›   · Help me choose
 *   All builds   this build first, then every saved one — swiped on a phone,
 *                side by side on a computer — Use this build · Delete this build
 *   the bar      ✓ Saved | Save · Save as new | Save this build
 *
 * IT REPLACES `BuildLocked` + `BuildCompare` under the Build segment, and
 * OWNS NO DATA: every figure is `lib/suppliers-build.ts` over what the page
 * already read. The only state here is the sheet, the toast, and WHICH saved
 * build is open (the prototype's `openBuild` — client state, on purpose).
 *
 * EVERY WRITE IS A SHIPPED ACTION, posting what it always posted:
 *   a line's dropdown  → `setBuildPick` / `removeBuildPick`
 *   Save · Save as new → `savePlanBuildNamed` (overwrite by id · create)
 *   Use this build     → `applyBuildToWorking` (never re-opens a booked category)
 *   Delete this build  → `deleteBudgetBuild`
 * A Use, an overwrite and a delete are each followed by an Undo toast that
 * goes back through the same actions (the shipped `PeekToast`).
 *
 * Shipped pieces, not redrawn: `ActionButton` + `useFitRow`, `PickMenu`,
 * `Count`, `Sheet`, `PeekToast`, the shell's mode context (the bar slides up
 * after the mode renders and down before it leaves — BUTTON_RULE rule 5).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { CalendarDays, Check, Pencil, Plus, Save, Search, X } from 'lucide-react';
import { ActionButton, useFitRow } from '@/components/action-button';
import { Count } from '@/components/count';
import { Sheet } from '@/app/_components/sheet';
import { PeekToast } from '@/app/_components/toast/peek-toast';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { goToBuildTab } from '@/lib/budget-build';
import { benchTileAnchorId, scrollBenchAnchor } from '@/lib/bench-anchors';
import { recordFieldHref } from '@/lib/event-details-record';
import { CALENDAR_NOT_SET } from '@/lib/calendar-truth';
import { formatCount } from '@/lib/format-number';
import { MAX_BUILD_TITLE_LEN } from '@/lib/named-builds';
import { formatPhp } from '@/lib/php';
import { isMultiPickGroup } from '@/lib/wedding-plan-groups';
import {
  PICK_ASKED_NOTE,
  buildBarOf,
  pickAnswerNote,
  noPriceNote,
  sameBuild,
  saveSheetOf,
  twinOf,
  type BuildCard,
  type BuildLine,
  type BuildSnapshot,
  type BuildView,
} from '@/lib/suppliers-build';
import { deleteBudgetBuild, savePlanBuildNamed } from '../build-actions';
import { applyBuildToWorking, removeBuildPick, setBuildPick } from '../build-pick-actions';
import { THUMB_SLIDE_MS, useSuppliersMode } from './suppliers-mode';

type Done = { ok: true } | { ok: false; error: string };

/** The body's five writes. On the page they are the shipped server actions. */
export type BuildWrites = {
  setPick: (i: { eventId: string; planGroupId: string; vendorId: string }) => Promise<Done>;
  removePick: (i: { eventId: string; planGroupId: string; vendorId: string }) => Promise<Done>;
  save: (i: { eventId: string; rawName?: string | null; overwriteBuildId?: string | null; snapshot: BuildSnapshot }) => Promise<Done>;
  remove: (i: { eventId: string; buildId: string }) => Promise<Done>;
  use: (i: { eventId: string; picks: { planGroupId: string; vendorId: string }[]; lockedPlanGroupIds?: string[] }) => Promise<Done>;
};

const SHIPPED_WRITES: BuildWrites = {
  setPick: setBuildPick,
  removePick: removeBuildPick,
  save: savePlanBuildNamed,
  remove: deleteBudgetBuild,
  use: applyBuildToWorking,
};

/**
 * A STAND-IN FOR THE WRITES — `/dev/suppliers-lab` only (no session, no
 * database there). `null` everywhere else, the default: the real page always
 * calls the shipped actions and re-reads itself.
 */
export const BuildWritesStandInCtx = createContext<BuildWrites | null>(null);

const NO_PICK = '__none__';
/** On a phone the bar's buttons share its width; on a computer it is a pill
 *  in the corner and each keeps its own. */
const BAR_FLEX = 'max-lg:!flex-1';

const CARDS_CSS =
  '[data-build-cards]{scrollbar-width:none;-webkit-overflow-scrolling:touch}[data-build-cards]::-webkit-scrollbar{display:none}' +
  '[data-build-inclusions] summary::-webkit-details-marker{display:none}' +
  // 44 px, no 40 px rows (owner 2026-10-12 look call 3) — the Find body's own
  // `.slcat .ab` rule, for the Build body and the bar / sheets it portals out.
  ':is([data-build-body],[data-build-bar],[data-build-sheet],[data-book-sheet]) .ab{height:44px;min-height:44px}' +
  '[data-build-body] [data-build-pick]{min-height:44px}';

type Toast = { text: string; tone: 'ok' | 'bad'; undo?: () => void };

export function BuildBody({
  eventId,
  view,
  guardSlot = null,
  extrasSlot = null,
  bookSlot = null,
  basePath,
}: {
  eventId: string;
  view: BuildView;
  /** Sai's watch line over the build (`MerkadoGuardBanner`) — the page decides. */
  guardSlot?: ReactNode;
  /** Shipped controls the prototype is silent about, kept reachable under the
   *  lines: "fill your build from your quotes" and "Clear candidates". */
  extrasSlot?: ReactNode;
  /** "Book this build", at the end of the bar when a pick is not booked yet. */
  bookSlot?: ReactNode;
  /** Where the Suppliers page lives. The lab passes its own address. */
  basePath?: string;
}) {
  const router = useRouter();
  const standIn = useContext(BuildWritesStandInCtx);
  const writes = standIn ?? SHIPPED_WRITES;
  const base = basePath ?? `/dashboard/${eventId}/vendors`;
  const [pending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  // The build being renamed (its name is rewritten over its own suppliers).
  const [renaming, setRenaming] = useState<BuildCard | null>(null);
  const [name, setName] = useState('');
  const [toast, setToast] = useState<Toast | null>(null);
  // A build that was just saved as new becomes the open one once it is read back.
  const openWhenSaved = useRef(false);

  const [current, ...saved] = view.cards as [BuildCard, ...BuildCard[]];
  const twin = useMemo(() => twinOf(view.snapshot.picks, saved), [view.snapshot, saved]);
  const open = saved.find((c) => c.id === openId) ?? null;
  const edited = open != null && !sameBuild(open.picks, view.snapshot.picks);
  const bar = buildBarOf({
    twinId: twin?.id ?? null,
    openId: open?.id ?? null,
    openIsEdited: edited,
    filled: view.counts.filled,
    toBook: view.counts.toBook,
  });
  const sheetKind = saveSheetOf({ twinId: twin?.id ?? null, openId: open?.id ?? null });

  useEffect(() => {
    if (!openWhenSaved.current || !twin) return;
    openWhenSaved.current = false;
    setOpenId(twin.id);
  }, [twin]);

  /** One write (or a short chain of them), then the page reads itself again. */
  const run = useCallback(
    (steps: Array<() => Promise<Done>>, after?: (ok: boolean) => void) => {
      startTransition(async () => {
        let failed: string | null = null;
        for (const step of steps) {
          try {
            const res = await step();
            if (!res.ok) failed = res.error;
          } catch {
            failed = 'That did not save. Try again.';
          }
          if (failed) break;
        }
        if (failed) setToast({ text: failed, tone: 'bad' });
        after?.(failed == null);
        if (!standIn) router.refresh();
      });
    },
    [router, standIn],
  );

  const pick = (line: BuildLine, key: string) => {
    const prev = line.pick;
    if (key === NO_PICK) {
      if (prev?.groupId) run([() => writes.removePick({ eventId, planGroupId: prev.groupId!, vendorId: prev.vendorId })]);
      return;
    }
    const next = line.candidates.find((c) => c.vendorId === key);
    if (!next?.groupId || next.vendorId === prev?.vendorId) return;
    const steps: Array<() => Promise<Done>> = [];
    // A single-pick category replaces its pick in the one write; a category
    // that keeps several (Look · Booths · Prints) would keep the old one too.
    if (prev?.groupId && (prev.groupId !== next.groupId || isMultiPickGroup(prev.groupId))) {
      steps.push(() => writes.removePick({ eventId, planGroupId: prev.groupId!, vendorId: prev.vendorId }));
    }
    steps.push(() => writes.setPick({ eventId, planGroupId: next.groupId!, vendorId: next.vendorId }));
    run(steps);
  };

  const findIn = (tile: string) => {
    // The shipped doorway (`TeamDecisionDoorway`): the deep link the bench
    // reads, the bus, then the row itself when it is already on the page.
    const currentOpen = new URLSearchParams(window.location.search).get('open');
    // The bus FIRST: it rewrites `?tab=` on the address as it stands, and a
    // push that had not landed yet lost its `open=` to that rewrite (seen in
    // the lab: Find opened with no row open).
    goToBuildTab('shortlist');
    router.push(`${base}?tab=shortlist&open=${encodeURIComponent(tile)}`, { scroll: false });
    if ((currentOpen ?? '') === tile) scrollBenchAnchor(benchTileAnchorId(tile));
  };

  const overwrite = () => {
    if (!open) return;
    const before: BuildSnapshot = { budgetPhp: open.savedBudgetPhp, totalPhp: open.totalPhp, picks: open.picks };
    const target = open;
    run([() => writes.save({ eventId, rawName: target.title, overwriteBuildId: target.id, snapshot: view.snapshot })], (ok) => {
      if (!ok) return;
      setToast({
        text: `Updated "${target.name}"`,
        tone: 'ok',
        undo: () => run([() => writes.save({ eventId, rawName: target.title, overwriteBuildId: target.id, snapshot: before })]),
      });
    });
  };

  const saveAsNew = () => {
    const typed = name.trim();
    const shown = typed || `Build ${formatCount(saved.length + 1)}`;
    run([() => writes.save({ eventId, rawName: typed || null, overwriteBuildId: null, snapshot: view.snapshot })], (ok) => {
      if (!ok) return;
      openWhenSaved.current = true;
      setSheet(false);
      setName('');
      setToast({ text: `Saved "${shown}" — see All builds`, tone: 'ok' });
    });
  };

  const use = (card: BuildCard) => {
    const before = current.apply;
    const beforeOpen = openId;
    const locked = view.lockedGroupIds;
    run([() => writes.use({ eventId, picks: card.apply, lockedPlanGroupIds: locked })], (ok) => {
      if (!ok) return;
      setOpenId(card.id);
      window.scrollTo({ top: 0 });
      setToast({
        text: `Using "${card.name}"`,
        tone: 'ok',
        undo: () =>
          run([() => writes.use({ eventId, picks: before, lockedPlanGroupIds: locked })], (undone) => {
            if (undone) setOpenId(beforeOpen);
          }),
      });
    });
  };

  // Rename = the shipped rename-by-overwrite: the SAME build, its own
  // suppliers, a new name (`planSaveAs` lets exactly that through).
  const rename = () => {
    const target = renaming;
    if (!target) return;
    const typed = name.trim();
    const own: BuildSnapshot = { budgetPhp: target.savedBudgetPhp, totalPhp: target.totalPhp, picks: target.picks };
    run([() => writes.save({ eventId, rawName: typed || null, overwriteBuildId: target.id, snapshot: own })], (ok) => {
      if (!ok) return;
      setRenaming(null);
      setName('');
      setToast({ text: typed ? `Renamed to "${typed}"` : 'Renamed', tone: 'ok' });
    });
  };

  const remove = (card: BuildCard) => {
    const kept: BuildSnapshot = { budgetPhp: card.savedBudgetPhp, totalPhp: card.totalPhp, picks: card.picks };
    run([() => writes.remove({ eventId, buildId: card.id })], (ok) => {
      if (!ok) return;
      setSheet(false);
      if (openId === card.id) setOpenId(null);
      setToast({
        text: `Deleted "${card.name}"`,
        tone: 'ok',
        // Back through the shipped save — the build returns under its name.
        undo: () => run([() => writes.save({ eventId, rawName: card.title ?? card.name, overwriteBuildId: null, snapshot: kept })]),
      });
    });
  };

  const { money, fit, counts } = view;
  const total = money.bookedPhp + money.toBookPhp;
  // ✓ only when every priced pick is READ free — a calendar not set or not checked is not a yes (P5, the prototype's rule).
  const allFree = fit.priced > 0 && fit.free === fit.priced;

  return (
    <div data-build-body="" className="space-y-9 max-lg:pb-20">

      {/* ── THIS BUILD ─────────────────────────────────────────────────── */}
      <section id="svc-build" aria-labelledby="svc-build-h">
        <h2 id="svc-build-h" className="font-display text-[21px] font-medium leading-tight text-ink">
          {open ? open.name : 'This build'}
          {edited ? <span className="text-sm font-normal text-ink/55"> · edited</span> : null}
        </h2>
        <p className="mt-0.5 text-sm text-ink/60" data-build-sub="" data-money="">
          {counts.filled > 0 ? (
            <>
              <Count value={counts.filled} id="sup-build-filled" /> of <Count value={counts.total} id="sup-build-total" /> categories
              {' · '}
              <Count value={total} format="peso" id="sup-build-sub" />
              {twin ? <span className="text-success-700 dark:text-success-200"> · same as “{twin.name}”</span> : null}
            </>
          ) : (
            'Nothing in your build yet — add suppliers in Find.'
          )}
        </p>
        {guardSlot ? <div className="mt-2.5">{guardSlot}</div> : null}

        <ul className="mt-2 divide-y divide-ink/10">
          {view.lines.map((line) => (
            <BuildLineRow
              key={line.tile}
              line={line}
              busy={pending}
              onPick={(key) => pick(line, key)}
              onFind={() => findIn(line.tile)}
              priceHref={(vendorId) => `${base}/${vendorId}/workspace`}
            />
          ))}
        </ul>
        {extrasSlot ? (
          <div className="mt-2 space-y-2" data-build-extras="">
            {extrasSlot}
          </div>
        ) : null}

        {/* ── the money ── */}
        <dl className="mt-1.5 grid grid-cols-2 gap-x-6 gap-y-3.5 border-t border-ink/10 pb-1.5 pt-3.5" data-money="" data-build-money="">
          <Figure k="Booked">
            <Count value={money.bookedPhp} format="peso" id="sup-build-booked" />
          </Figure>
          <Figure k="If you book these">
            <Count value={money.toBookPhp} format="peso" id="sup-build-tobook" />
          </Figure>
          <Figure k="Budget">{money.budgetPhp == null ? '—' : <Count value={money.budgetPhp} format="peso" id="sup-build-budget" />}</Figure>
          <Figure
            k="Buffer"
            small={money.unpriced > 0}
            tone={money.bufferPhp != null && money.bufferPhp < 0 ? 'over' : undefined}
            note={
              money.unpriced > 0 ? (
                <>
                  <Count value={money.unpriced} id="sup-build-unpriced" /> {noPriceNote(money.unpriced)}
                </>
              ) : null
            }
          >
            {money.unpriced > 0 ? (
              'Not knowable'
            ) : money.bufferPhp == null ? (
              '—'
            ) : (
              <Count value={money.bufferPhp} format="peso" id="sup-build-buffer" />
            )}
          </Figure>
        </dl>

        {/* ── the fit line ── */}
        <FitLine eventId={eventId} view={view} allFree={allFree} />
      </section>

      {/* ── ALL BUILDS ─────────────────────────────────────────────────── */}
      <section id="svc-compare" aria-labelledby="svc-compare-h" data-money="">
        <h2 id="svc-compare-h" className="font-display text-[21px] font-medium leading-tight text-ink">
          All builds
        </h2>
        {!view.buildsMeasured ? (
          <p className="mt-1 text-sm text-ink/70" role="status">
            <strong className="text-ink">We couldn’t load your saved builds.</strong> This does not mean you have none — reload in a
            moment. Nothing you saved has been lost.
          </p>
        ) : (
          <>
            <p className="mt-0.5 text-sm text-ink/60">
              {saved.length > 0 ? 'Compared side by side, with the dates each one is free on.' : 'Save this build to compare it with another.'}
            </p>
            {saved.length > 0 ? (
              <>
                <p className="mb-1 mt-2.5 text-xs text-ink/55 lg:hidden" data-build-swipe="">
                  <Count value={view.cards.length} id="sup-build-n" /> builds · swipe to compare ›
                </p>
                <div
                  data-build-cards=""
                  className="mt-1 grid snap-x snap-mandatory grid-flow-col auto-cols-[minmax(160px,1fr)] overflow-x-auto border-t border-ink/10 text-[13px] lg:auto-cols-[minmax(140px,1fr)]"
                >
                  {view.cards.map((card, i) => (
                    <BuildCardColumn
                      key={card.id}
                      card={card}
                      index={i}
                      isCurrent={i === 0}
                      isTwin={i > 0 && twin?.id === card.id}
                      busy={pending}
                      onUse={() => use(card)}
                      onRename={() => {
                        setName(card.title ?? '');
                        setRenaming(card);
                      }}
                      onDelete={() => remove(card)}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </>
        )}
      </section>

      {/* Last, so the first section stays the first child (`space-y`). */}
      <style>{CARDS_CSS}</style>

      <BuildBar
        kind={bar.kind}
        canSave={bar.canSave}
        busy={pending}
        onSaved={() => setSheet(true)}
        onSave={overwrite}
        onSaveAs={() => setSheet(true)}
        // Always mounted: it hides its own button when nothing is left to book,
        // and its toast must outlive the last pick it booked.
        bookSlot={bookSlot}
      />

      {sheet && typeof document !== 'undefined'
        ? createPortal(
            <Sheet
              open
              onClose={() => setSheet(false)}
              labelledById="build-save-h"
              title={sheetKind === 'nothing_changed' ? 'Nothing changed' : sheetKind === 'already_saved' ? 'Already saved' : 'Save this build'}
            >
              <SaveSheetBody
                kind={sheetKind}
                twinName={twin?.name ?? ''}
                placeholder={`Build ${formatCount(saved.length + 1)}`}
                name={name}
                onName={setName}
                busy={pending}
                onClose={() => setSheet(false)}
                onSave={saveAsNew}
                onDeleteTwin={twin ? () => remove(twin) : undefined}
              />
            </Sheet>,
            document.body,
          )
        : null}

      {renaming && typeof document !== 'undefined'
        ? createPortal(
            <Sheet
              open
              onClose={() => {
                setRenaming(null);
                setName('');
              }}
              labelledById="build-save-h"
              title="Rename this build"
            >
              <SaveSheetBody
                kind="name"
                intro={`A new name for “${renaming.name}”. Its suppliers stay as they are.`}
                twinName=""
                placeholder={renaming.name}
                name={name}
                onName={setName}
                busy={pending}
                onClose={() => setRenaming(null)}
                onSave={rename}
              />
            </Sheet>,
            document.body,
          )
        : null}

      {toast && typeof document !== 'undefined'
        ? createPortal(
            <PeekToast
              key={toast.text}
              tone={toast.tone}
              data="build"
              onGone={() => setToast(null)}
              action={
                toast.undo
                  ? {
                      label: 'Undo',
                      onPress: () => {
                        const undo = toast.undo!;
                        setToast(null);
                        undo();
                      },
                    }
                  : undefined
              }
            >
              {toast.text}
            </PeekToast>,
            document.body,
          )
        : null}
    </div>
  );
}

/* ── ONE CATEGORY LINE ────────────────────────────────────────────────────── */

function BuildLineRow({
  line,
  busy,
  onPick,
  onFind,
  priceHref,
}: {
  line: BuildLine;
  busy: boolean;
  onPick: (key: string) => void;
  onFind: () => void;
  priceHref: (vendorId: string) => string;
}) {
  const who = line.booked ?? line.pick;
  // The pick is always in its own dropdown, even while it cannot be booked.
  const options = [
    { key: NO_PICK, label: 'Pick one' },
    ...line.candidates.map((c) => ({ key: c.vendorId, label: `${c.name} · ${formatPhp(c.pricePhp)}` })),
    ...(line.pick && !line.candidates.some((c) => c.vendorId === line.pick!.vendorId)
      ? [{ key: line.pick.vendorId, label: line.pick.name }]
      : []),
  ];
  const canChoose = line.candidates.length > 0 || line.pick != null;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 py-2.5" data-build-line={line.tile} data-booked={line.booked ? '' : undefined}>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.08em] text-ink/55">
          {line.label}
          {line.booked ? ' · booked' : ''}
        </p>
        {line.booked ? (
          <p className="mt-0.5 text-sm font-medium text-ink">{line.booked.name}</p>
        ) : canChoose ? (
          <div className="mt-1 max-w-full" aria-busy={busy || undefined}>
            <PickMenu
              label={`Pick a ${line.label} supplier`}
              value={line.pick?.vendorId ?? NO_PICK}
              buttonText={line.pick ? line.pick.name : 'Pick one'}
              options={options}
              onPick={onPick}
              dataAttr="data-build-pick"
              className="max-w-full border border-ink/15"
            />
            {line.pickNote ? (
              <p className="mt-1 text-xs text-mulberry-700">{line.pickNote}</p>
            ) : line.pickAsked ? (
              <p className="mt-1 text-xs text-mulberry-700">{PICK_ASKED_NOTE}</p>
            ) : line.pickAnswer ? (
              <p className="mt-1 text-xs text-mulberry-700" data-build-answer={line.pickAnswer}>
                {pickAnswerNote(line.pickAnswer)}
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <p className="mt-0.5 text-[13px] text-ink/55">Nobody shortlisted with a price yet</p>
            <div className="mt-1.5">
              <ActionButton tone="brand" icon={Search} label={`Find in ${line.label}`} onClick={onFind} />
            </div>
          </>
        )}
      </div>
      <div className="self-center text-right" data-money="">
        {who == null ? (
          <span className="text-base text-ink/45" aria-hidden>
            —
          </span>
        ) : who.pricePhp != null ? (
          <span className="whitespace-nowrap text-base font-semibold tabular-nums text-ink">
            <Count value={who.pricePhp} format="peso" id={`sup-build-line-${line.tile}`} />
          </span>
        ) : (
          <ActionButton tone="brand" main icon={Pencil} label="Set price" name={`Set price — ${who.name}`} href={priceHref(who.vendorId)} prefetch={false} />
        )}
      </div>
    </li>
  );
}

/* ── THE MONEY ────────────────────────────────────────────────────────────── */

function Figure({
  k,
  children,
  note = null,
  small = false,
  tone,
}: {
  k: string;
  children: ReactNode;
  note?: ReactNode;
  /** Words, not a figure ("Not knowable") — set a size down. */
  small?: boolean;
  tone?: 'over';
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.14em] text-ink/55">{k}</dt>
      <dd
        className={`font-semibold leading-tight tracking-[-0.01em] tabular-nums ${small ? 'text-xl' : 'text-[22px]'} ${
          tone === 'over' ? 'text-mulberry-700' : 'text-ink'
        }`}
      >
        {children}
      </dd>
      {note ? <dd className="text-xs text-ink/55">{note}</dd> : null}
    </div>
  );
}

function FitLine({ eventId, view, allFree }: { eventId: string; view: BuildView; allFree: boolean }) {
  const { fit, dateLabel } = view;
  const hasDay = dateLabel != null;
  return (
    <div className="flex items-center gap-2 border-t border-ink/10 py-2.5 text-sm text-ink" data-build-fit="">
      {hasDay && fit.priced > 0 ? (
        <span className={allFree ? 'text-success-700 dark:text-success-200' : 'text-mulberry-700'} aria-hidden>
          {allFree ? '✓' : '!'}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        {fit.priced === 0 ? (
          'Pick suppliers to check your date'
        ) : !hasDay ? (
          'Set the date to check your picks'
        ) : (
          <>
            <Count value={fit.free} id="sup-build-free" /> of <Count value={fit.priced} id="sup-build-priced" /> priced picks are free on{' '}
            {dateLabel}
            {fit.notSet > 0 ? (
              <span className="text-ink/55" data-build-fit-not-set="">
                {' '}
                · <Count value={fit.notSet} id="sup-build-not-set" /> {CALENDAR_NOT_SET.toLowerCase()}
              </span>
            ) : null}
            {fit.unread > 0 ? (
              <span className="text-ink/55">
                {' '}
                · <Count value={fit.unread} id="sup-build-unread" /> not checked
              </span>
            ) : null}
          </>
        )}
      </span>
      <ActionButton
        tone="warn"
        icon={CalendarDays}
        label={hasDay ? 'Help me choose' : 'Set the date'}
        href={recordFieldHref(eventId, 'date')}
        prefetch={false}
      />
    </div>
  );
}

/* ── ONE BUILD, AS A COLUMN ───────────────────────────────────────────────── */

function BuildCardColumn({
  card,
  index,
  isCurrent,
  isTwin,
  busy,
  onUse,
  onRename,
  onDelete,
}: {
  card: BuildCard;
  index: number;
  isCurrent: boolean;
  isTwin: boolean;
  busy: boolean;
  onUse: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  useFitRow(rowRef);
  return (
    <div
      data-build-card={card.id}
      data-twin={isTwin ? '' : undefined}
      className={`min-w-0 snap-start border-r border-ink/10 px-2 py-2.5 last:border-r-0 ${isTwin ? 'bg-[color-mix(in_srgb,rgb(var(--color-ok))_9%,transparent)]' : ''}`}
    >
      <p className="text-[13.5px] font-semibold text-ink">
        {card.name}
        {isTwin ? <span className="font-normal text-ink/55"> · this build</span> : null}
      </p>
      <p className="text-[17px] font-semibold tabular-nums text-ink">
        <Count value={card.totalPhp} format="peso" id={`sup-build-card-${index}`} />
      </p>
      <p className="text-ink/55">
        {card.unpriced > 0 ? (
          <>
            + <Count value={card.unpriced} id={`sup-build-card-unp-${index}`} /> without a price
          </>
        ) : (
          'all priced'
        )}
      </p>
      <ul className="mt-2">
        {card.rows.map((r) => (
          <li key={r.label} className={r.supplier ? 'text-ink' : 'text-ink/55'}>
            {r.inclusions.length > 0 ? (
              // What the price comes with — folded, as the old compare cell was.
              <details data-build-inclusions="">
                <summary className="flex min-h-11 cursor-pointer list-none items-center">
                  {r.label} · {r.supplier ?? '—'} <span className="text-ink/55">▾</span>
                </summary>
                <p className="text-xs text-ink/55">+ {r.inclusions.join(', ')}</p>
              </details>
            ) : (
              <>
                {r.label} · {r.supplier ?? '—'}
              </>
            )}
          </li>
        ))}
      </ul>
      {card.free ? (
        card.free.kind === 'dates' ? (
          <p className="mt-2 text-success-700 dark:text-success-200">
            Free: {card.free.labels.join(' · ')}
            {card.free.more > 0 ? ` +${formatCount(card.free.more)}` : ''}
          </p>
        ) : (
          <p className="mt-2 text-mulberry-700">
            No shared free date
            {card.free.who.length > 0 ? <span className="block">{card.free.who.join(', ')} taken that day</span> : null}
          </p>
        )
      ) : null}
      <p className={card.bufferPhp == null ? 'text-ink/55' : card.bufferPhp < 0 ? 'text-mulberry-700' : 'text-success-700 dark:text-success-200'}>
        {card.unpriced > 0 ? (
          'Buffer: not knowable'
        ) : card.bufferPhp == null ? (
          'Buffer: —'
        ) : (
          <>
            Buffer <Count value={card.bufferPhp} format="peso" id={`sup-build-card-buf-${index}`} />
          </>
        )}
      </p>
      {isCurrent ? null : (
        <div ref={rowRef} className="mt-2.5 flex min-w-0 flex-wrap items-center gap-2">
          <ActionButton
            tone="brand"
            main
            icon={Check}
            label="Use this build"
            name={`Use this build — ${card.name}`}
            onClick={onUse}
            disabled={busy || card.apply.length === 0}
            title={
              card.apply.length === 0
                ? 'Nothing to use — every supplier in this build is booked already or no longer on your shortlist.'
                : undefined
            }
          />
          <ActionButton tone="neutral" icon={Pencil} label="Rename" name={`Rename — ${card.name}`} onClick={onRename} disabled={busy} aria-haspopup="dialog" />
          <ActionButton tone="danger" icon={X} label="Delete this build" name={`Delete this build — ${card.name}`} onClick={onDelete} disabled={busy} />
        </div>
      )}
    </div>
  );
}

/* ── THE BAR AT THE THUMB ─────────────────────────────────────────────────── */

function BuildBar({
  kind,
  canSave,
  busy,
  onSaved,
  onSave,
  onSaveAs,
  bookSlot,
}: {
  kind: 'saved' | 'edited' | 'new';
  canSave: boolean;
  busy: boolean;
  onSaved: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  bookSlot: ReactNode;
}) {
  const { mode, leaving, thumbUp } = useSuppliersMode();
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);

  // Rule 5 — up once Build has rendered, down first when leaving it.
  const wanted = mode === 'build' && !leaving;
  const [up, setUp] = useState(false);
  useEffect(() => {
    if (!wanted) {
      setUp(false);
      return;
    }
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        thumbUp.current = true;
        setUp(true);
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      thumbUp.current = false;
    };
  }, [wanted, thumbUp]);

  if (!host) return null;
  return createPortal(
    <div
      data-build-bar=""
      data-on={up ? 'true' : 'false'}
      inert={!up}
      className={`pointer-events-none fixed inset-x-0 bottom-[var(--sn-bottomdock-h,64px)] z-[25] px-4 py-2.5 transition-transform ease-out motion-reduce:transition-none lg:bottom-7 lg:left-auto lg:right-7 lg:px-0 ${
        up ? 'translate-y-0' : 'translate-y-[calc(100%_+_32px)]'
      }`}
      style={{ transitionDuration: `${THUMB_SLIDE_MS}ms` }}
    >
      <BarButtons kind={kind} canSave={canSave} busy={busy} onSaved={onSaved} onSave={onSave} onSaveAs={onSaveAs} bookSlot={bookSlot} />
    </div>,
    host,
  );
}

/** Its own component, so `useFitRow` mounts WITH the row (the Find row's trap). */
function BarButtons({
  kind,
  canSave,
  busy,
  onSaved,
  onSave,
  onSaveAs,
  bookSlot,
}: {
  kind: 'saved' | 'edited' | 'new';
  canSave: boolean;
  busy: boolean;
  onSaved: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  bookSlot: ReactNode;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  useFitRow(rowRef);
  return (
    <div ref={rowRef} data-build-bar-kind={kind} className="pointer-events-auto flex min-w-0 items-center gap-2.5">
      {kind === 'saved' ? (
        <ActionButton tone="brand" main icon={Check} label="Saved" onClick={onSaved} aria-haspopup="dialog" className={BAR_FLEX} />
      ) : kind === 'edited' ? (
        <>
          <ActionButton tone="brand" main icon={Save} label="Save" onClick={onSave} disabled={busy} className={BAR_FLEX} />
          <ActionButton
            tone="brand"
            icon={Plus}
            label="Save as new"
            onClick={onSaveAs}
            aria-haspopup="dialog"
            className={BAR_FLEX}
          />
        </>
      ) : (
        <ActionButton tone="brand" main icon={Save} label="Save this build" onClick={onSaveAs} disabled={!canSave} aria-haspopup="dialog" className={BAR_FLEX} />
      )}
      {bookSlot}
    </div>
  );
}

/* ── THE SAVE SHEET ───────────────────────────────────────────────────────── */

function SaveSheetBody({
  kind,
  twinName,
  placeholder,
  intro,
  name,
  onName,
  busy,
  onClose,
  onSave,
  onDeleteTwin,
}: {
  kind: 'nothing_changed' | 'already_saved' | 'name';
  twinName: string;
  placeholder: string;
  /** The sheet's one line; default = saving the current combination. */
  intro?: string;
  name: string;
  onName: (v: string) => void;
  busy: boolean;
  onClose: () => void;
  onSave: () => void;
  onDeleteTwin?: () => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  useFitRow(rowRef);
  if (kind !== 'name') {
    return (
      <div className="space-y-4 px-5 pb-5" data-build-sheet={kind}>
        <p id="build-save-h" className="text-sm text-ink/70">
          {kind === 'nothing_changed'
            ? `“${twinName}” already has exactly these suppliers.`
            : `This is exactly “${twinName}” — the same suppliers in every category. Nothing new to save.`}
        </p>
        <div ref={rowRef} className="flex min-w-0 flex-wrap items-center gap-2">
          <ActionButton tone="neutral" icon={Check} label="OK" onClick={onClose} />
          {kind === 'already_saved' && onDeleteTwin ? (
            <ActionButton tone="danger" icon={X} label={`Delete “${twinName}”`} onClick={onDeleteTwin} disabled={busy} />
          ) : null}
        </div>
      </div>
    );
  }
  return (
    <form
      className="space-y-3.5 px-5 pb-5"
      data-build-sheet="name"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <p id="build-save-h" className="text-sm text-ink/70">
        {intro ?? 'Your current combination, kept to compare later.'}
      </p>
      <label className="block text-sm text-ink">
        Name <span className="text-ink/55">(optional)</span>
        <input
          value={name}
          onChange={(e) => onName(e.target.value)}
          maxLength={MAX_BUILD_TITLE_LEN}
          placeholder={placeholder}
          autoComplete="off"
          data-build-name=""
          className="mt-1.5 block w-full rounded-md border border-ink/15 bg-cream px-3 py-2.5 text-base text-ink outline-none placeholder:text-ink/45 focus:border-mulberry"
        />
      </label>
      <div ref={rowRef} className="flex min-w-0 items-center gap-2">
        <ActionButton tone="brand" main icon={Save} label="Save build" type="submit" disabled={busy} />
      </div>
    </form>
  );
}
