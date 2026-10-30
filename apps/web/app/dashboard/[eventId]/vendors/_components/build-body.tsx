'use client';

/**
 * BuildBody — THE BUILD BODY of the couple's Suppliers page, drawn to the APPROVED FINAL frames (owner 2026-10-30,
 * "that is the last rule for the suppliers. we are done and good"; `carry-2026-10-29/suppliers-final-proto/`, frames
 * 12-build · 12b-build-with-pick · 13-build-compare · 14-build-book). Owner 2026-10-31, live iPhone: *"I also previously
 * saw you design the Build with a better interpretation where they can create and load build and compare them safely
 * all in one screen."*
 *
 *   [This build ▾]  [＋ New build]                         ⓘ   load any saved build · snapshot this one · the figures
 *   ₱290,000 of ₱600,000 budget · ₱310,000 buffer               the budget line
 *   ████████████▓▓▓▓░░░░░░░░░                                   the meter: booked · if you book these
 *   ● booked ₱290,000   ● if you book these ₱0
 *   ✓ N of M priced picks are free on ‹date›   [Help me choose]
 *   ─────────────────────────────────────────
 *   VENUE · BOOKED      Hacienda Isabel              ₱180,000    one line per category: the booked supplier,
 *   CATERING            [Pick one ▾]                        —    ONE dropdown of the couple's priced picks (Yours),
 *   FLOWERS             Nobody shortlisted…  [Find in Flowers]    or the door back to Find
 *   Compare builds ⓘ    [Compare N builds]                       → the Compare sheet (2 side by side; "hide what's
 *                                                                  the same"; green = lowest total) — from 1024 the
 *                                                                  same table is the "All builds" pane on the right
 *   [Save this build] [Book this build]                          the bar at the thumb
 *
 * NO NEW STATE, NO NEW READ, NO NEW TABLE. "＋ New build" is a SNAPSHOT: the shipped save-as-new into `budget_builds`
 * (owner's open note: "＋ New build = snapshot (no new table)"). Loading a build is the shipped Use. Every figure is
 * `lib/suppliers-build.ts` over what the page already read; the only state here is which build is open, which builds
 * the Compare shows, and the sheets.
 *
 * EVERY WRITE IS A SHIPPED ACTION, posting what it always posted:
 *   a line's dropdown       → `setBuildPick` / `removeBuildPick`
 *   This build ▾ (a saved)  → `applyBuildToWorking` (never re-opens a booked category)
 *   ＋ New build · Save     → `savePlanBuildNamed` (create · overwrite by id)
 *   Rename                  → `savePlanBuildNamed` (the same build, its own suppliers, a new name)
 *   Delete this build       → `deleteBudgetBuild`
 * A Use, an overwrite and a delete are each followed by an Undo toast that goes back through the same actions.
 *
 * EVERY POP-UP IS THE ONE HOUSE TEMPLATE — `ScheduleSheet` + `SheetFoot` (PR 1's "one pop-up template": the house
 * bottom sheet, title and what it is about on one line, the answers in the thumb zone). 🔒 lib/the-build-is-the-approved-frame.test.ts
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { CalendarDays, Check, Columns2, Pencil, Plus, Save, Search, X } from 'lucide-react';
import { ActionButton, useFitRow } from '@/components/action-button';
import { Count } from '@/components/count';
import { Explain } from '@/app/_components/explain';
import { SwitchRow } from '@/app/_components/form-row';
import { PeekToast } from '@/app/_components/toast/peek-toast';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { ScheduleSheet, SheetField, SheetFoot } from '@/app/dashboard/[eventId]/schedule/_components/schedule-sheet';
import { goToBuildTab } from '@/lib/budget-build';
import { benchTileAnchorId, scrollBenchAnchor } from '@/lib/bench-anchors';
import { CALENDAR_NOT_SET } from '@/lib/calendar-truth';
import { openSuppliersFactSheet } from '@/lib/suppliers-fact-sheets';
import { formatCount } from '@/lib/format-number';
import { MAX_BUILD_TITLE_LEN } from '@/lib/named-builds';
import { useThumbRoom } from '@/lib/thumb-room';
import { formatPhp } from '@/lib/php';
import { isMultiPickGroup } from '@/lib/wedding-plan-groups';
import {
  PICK_ASKED_NOTE,
  buildBarOf,
  compareCap,
  compareRowIndexes,
  compareShownAtFirst,
  lowestTotalIds,
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
import { BookPricesCtx } from './book-this-build';
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
const CURRENT = 'current';
/** The bar's two answers share its width on a phone and under the left pane on a computer; a tablet keeps its pill. */
const BAR_FLEX = 'max-tab:!flex-1 lg:!flex-1';
/** The computer's two panes: the build on the left (the frame's 26 rem), All builds on the right. */
const WIDE_QUERY = '(min-width: 1024px)';

const CARDS_CSS =
  '[data-build-inclusions] summary::-webkit-details-marker{display:none}' +
  // 44 px, no 40 px rows (owner 2026-10-12 look call 3) — the Find body's own
  // `.slcat .ab` rule, for the Build body and the bar / sheets it portals out.
  ':is([data-build-body],[data-build-bar],[data-build-sheet],[data-book-sheet]) .ab{height:44px;min-height:44px}' +
  '[data-build-body] [data-build-pick]{min-height:44px}' +
  '[data-build-compare]{scrollbar-width:none}[data-build-compare]::-webkit-scrollbar{display:none}';

type Toast = { text: string; tone: 'ok' | 'bad'; undo?: () => void };

/** True from 1024 — where All builds is a pane, not a sheet. */
function useWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(WIDE_QUERY);
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return wide;
}

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
  /** "Book this build", at the end of the bar. */
  bookSlot?: ReactNode;
  /** Where the Suppliers page lives. The lab passes its own address. */
  basePath?: string;
}) {
  const router = useRouter();
  const standIn = useContext(BuildWritesStandInCtx);
  const writes = standIn ?? SHIPPED_WRITES;
  const base = basePath ?? `/dashboard/${eventId}/vendors`;
  const wide = useWide();
  const [pending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [comparing, setComparing] = useState(false);
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
  // What "Book this build" lists beside each pick — the line's own price, never a second read.
  const prices = useMemo(
    () => new Map(view.lines.flatMap((l) => (l.pick ? [[l.pick.vendorId, l.pick.pricePhp] as const] : []))),
    [view.lines],
  );

  useEffect(() => {
    if (!openWhenSaved.current || !twin) return;
    openWhenSaved.current = false;
    setOpenId(twin.id);
  }, [twin]);

  /** One write (or a short chain of them). Each revalidates the page, so its own answer redraws it — no refresh after. */
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
      });
    },
    [],
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
      setToast({ text: `Saved "${shown}" — see Compare builds`, tone: 'ok' });
    });
  };

  /** Load a saved build into this one — the shipped Use. (Not named `use…`: that is a hook's name.) */
  const load = (card: BuildCard) => {
    const before = current.apply;
    const beforeOpen = openId;
    const locked = view.lockedGroupIds;
    run([() => writes.use({ eventId, picks: card.apply, lockedPlanGroupIds: locked })], (ok) => {
      if (!ok) return;
      setOpenId(card.id);
      setComparing(false);
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

  /** This build ▾ — load a saved build (the shipped Use), or go back to the working one. */
  const choose = (key: string) => {
    if (key === CURRENT) {
      setOpenId(null);
      return;
    }
    const card = saved.find((c) => c.id === key);
    if (!card) return;
    // Already exactly these suppliers: open it by name, nothing to write.
    if (twin?.id === card.id) {
      setOpenId(card.id);
      return;
    }
    load(card);
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

  const { money, fit } = view;
  const total = money.bookedPhp + money.toBookPhp;
  // ✓ only when every priced pick is READ free — a calendar not set or not checked is not a yes (P5, the prototype's rule).
  const allFree = fit.priced > 0 && fit.free === fit.priced;
  const startRename = (card: BuildCard) => {
    setName(card.title ?? '');
    setRenaming(card);
  };
  // The sheet opens only on a phone and the pane only from 1024, so the width alone says how many sit side by side.
  const table = () => (
    <CompareTable
      cards={view.cards}
      cap={compareCap(wide)}
      busy={pending}
      onUse={load}
      onRename={startRename}
      onDelete={remove}
    />
  );

  return (
    <BookPricesCtx.Provider value={prices}>
    <div data-build-body="" className="max-tab:pb-20 lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-x-8">

      {/* ── THIS BUILD ─────────────────────────────────────────────────── */}
      <section id="svc-build" aria-labelledby="svc-build-h" className="min-w-0">
        {/* The row: This build ▾ · ＋ New build · ⓘ (frame 12). */}
        <div className="flex min-w-0 items-center gap-2" data-build-head="">
          <h2 id="svc-build-h" className="sr-only">
            {open ? open.name : 'This build'}
          </h2>
          <PickMenu
            label="Your builds"
            value={open?.id ?? CURRENT}
            buttonText={open ? `${open.name}${edited ? ' · edited' : ''}` : 'This build'}
            options={[
              { key: CURRENT, label: 'This build', trail: { text: formatPhp(total), tone: 'muted' } },
              ...saved.map((c) => ({ key: c.id, label: c.name, trail: { text: formatPhp(c.totalPhp), tone: 'muted' as const } })),
            ]}
            onPick={choose}
            dataAttr="data-build-choose"
            className="min-w-0 border border-ink/15"
          />
          <ActionButton
            tone="neutral"
            icon={Plus}
            label="New build"
            name="New build — keep this combination to compare"
            onClick={() => setSheet(true)}
            disabled={!bar.canSave || pending}
            aria-haspopup="dialog"
          />
          <span className="ml-auto flex shrink-0">
            <Explain title="This build" data="build">
              <BuildFigures view={view} />
            </Explain>
          </span>
        </div>

        {/* The budget line, the meter, the legend (frame 12). */}
        <div className="mt-3" data-money="" data-build-money="">
          <p className="flex flex-wrap items-baseline gap-x-1.5 leading-tight" data-build-sub="">
            <span className="text-[26px] font-semibold tracking-[-0.01em] tabular-nums text-ink">
              <Count value={total} format="peso" id="sup-build-sub" />
            </span>
            <BudgetWords view={view} />
          </p>
          <Meter view={view} />
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-0.5 text-[12.5px] text-ink/65" data-build-legend="">
            <span className="inline-flex items-center gap-1.5">
              <i aria-hidden className="h-2 w-2 rounded-full bg-success-600" />
              booked <Count value={money.bookedPhp} format="peso" id="sup-build-booked" />
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i aria-hidden className="h-2 w-2 rounded-full bg-sn-accent" />
              if you book these <Count value={money.toBookPhp} format="peso" id="sup-build-tobook" />
            </span>
          </p>
        </div>

        {/* ── the fit line ── */}
        <FitLine view={view} allFree={allFree} />

        {/* ── one line per category ── */}
        <ul className="-mx-4 divide-y divide-ink/10 border-t border-ink/10 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0" data-build-lines="">
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
        {/* Sai's watch line under the lines, so the lines start right under the fit line (frame 12). */}
        {guardSlot ? <div className="mt-2.5">{guardSlot}</div> : null}
        {extrasSlot ? (
          <div className="mt-2 space-y-2" data-build-extras="">
            {extrasSlot}
          </div>
        ) : null}
      </section>

      {/* ── COMPARE BUILDS — a sheet on a phone, the "All builds" pane from 1024 ─────────────── */}
      <section id="svc-compare" aria-labelledby="svc-compare-h" data-money="" className="mt-6 border-t border-ink/10 pt-4 lg:mt-0 lg:min-w-0 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
        <div className="flex min-w-0 items-center gap-1">
          <h2 id="svc-compare-h" className="text-[17px] font-semibold leading-tight text-ink">
            {wide ? 'All builds' : 'Compare builds'}
          </h2>
          <Explain title="Compare builds" data="build-compare">
            <span>
              Save a few full sets and see them side by side — totals, what’s left of your budget, and the dates every
              supplier in that set is free on. “Use this build” swaps your picks; booked categories never change.
            </span>
          </Explain>
          {wide && view.buildsMeasured && saved.length > 0 ? (
            <span className="ml-auto text-[13px] text-ink/55">
              <Count value={view.cards.length} id="sup-build-n" /> builds · the dates each is free on
            </span>
          ) : null}
        </div>
        {!view.buildsMeasured ? (
          <p className="mt-1 text-sm text-ink/70" role="status">
            <strong className="text-ink">We couldn’t load your saved builds.</strong> This does not mean you have none — reload in a
            moment. Nothing you saved has been lost.
          </p>
        ) : saved.length === 0 ? (
          <p className="mt-0.5 text-sm text-ink/60">Save this build to compare it with another.</p>
        ) : wide ? (
          <div className="mt-3">{table()}</div>
        ) : (
          <>
            <p className="mt-0.5 text-sm text-ink/60">Side by side, with the dates each one is free on.</p>
            <div className="mt-2.5">
              <ActionButton
                tone="neutral"
                icon={Columns2}
                label={`Compare ${formatCount(view.cards.length)} builds`}
                onClick={() => setComparing(true)}
                aria-haspopup="dialog"
                data-testid="build-compare-open"
              />
            </div>
          </>
        )}
      </section>

      {/* Last, so the first section stays the first child. */}
      <style>{CARDS_CSS}</style>

      <BuildBar
        kind={bar.kind}
        canSave={bar.canSave}
        busy={pending}
        onSaved={() => setSheet(true)}
        onSave={overwrite}
        onSaveNew={() => setSheet(true)}
        // Always mounted: it answers "nothing to book" itself, and its toast
        // must outlive the last pick it booked.
        bookSlot={bookSlot}
      />

      <ScheduleSheet
        open={comparing && !wide}
        onClose={() => setComparing(false)}
        id="build-compare-h"
        title="Compare builds"
        aside={`${formatCount(compareCap(false))} at a time on a phone · green = lowest total`}
        data="build-compare"
        foot={
          <SheetFoot>
            <ActionButton tone="brand" main icon={Check} label="Done" onClick={() => setComparing(false)} className="col-span-2" />
          </SheetFoot>
        }
      >
        {comparing && !wide ? table() : null}
      </ScheduleSheet>

      <ScheduleSheet
        open={sheet}
        onClose={() => setSheet(false)}
        id="build-save-h"
        title={sheetKind === 'nothing_changed' ? 'Nothing changed' : sheetKind === 'already_saved' ? 'Already saved' : 'Save this build'}
        aside={sheetKind === 'name' ? 'Your current combination, kept to compare later.' : undefined}
        data="build-save"
        foot={null}
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
      </ScheduleSheet>

      <ScheduleSheet
        open={renaming != null}
        onClose={() => {
          setRenaming(null);
          setName('');
        }}
        id="build-rename-h"
        title="Rename this build"
        aside={renaming ? `A new name for “${renaming.name}”. Its suppliers stay as they are.` : undefined}
        data="build-rename"
        foot={null}
      >
        {renaming ? (
          <SaveSheetBody
            kind="rename"
            twinName=""
            placeholder={renaming.name}
            name={name}
            onName={setName}
            busy={pending}
            onClose={() => setRenaming(null)}
            onSave={rename}
          />
        ) : null}
      </ScheduleSheet>

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
    </BookPricesCtx.Provider>
  );
}

/* ── THE BUDGET LINE ──────────────────────────────────────────────────────── */

/** "of ₱600,000 budget · ₱310,000 buffer" — or over, or not knowable while a price is missing, or no budget yet. */
function BudgetWords({ view }: { view: BuildView }) {
  const { money } = view;
  if (money.budgetPhp == null) return <span className="text-[13px] text-ink/60">· no budget set yet</span>;
  return (
    <span className="text-[13px] text-ink/60">
      of <Count value={money.budgetPhp} format="peso" id="sup-build-budget" /> budget ·{' '}
      {money.unpriced > 0 ? (
        <span data-build-buffer="unknown">buffer not knowable</span>
      ) : money.bufferPhp == null ? (
        '—'
      ) : money.bufferPhp < 0 ? (
        <b className="font-semibold text-mulberry-700" data-build-buffer="over">
          <Count value={-money.bufferPhp} format="peso" id="sup-build-over" /> over
        </b>
      ) : (
        <span data-build-buffer="left">
          <Count value={money.bufferPhp} format="peso" id="sup-build-buffer" /> buffer
        </span>
      )}
    </span>
  );
}

/** The meter: booked (green) then if you book these (the accent), of the budget. No budget, no meter. */
function Meter({ view }: { view: BuildView }) {
  const { bookedPhp, toBookPhp, budgetPhp } = view.money;
  if (budgetPhp == null || budgetPhp <= 0) return null;
  const booked = Math.min(100, (bookedPhp / budgetPhp) * 100);
  const picks = Math.min(100 - booked, (toBookPhp / budgetPhp) * 100);
  return (
    <div aria-hidden className="mt-2.5 flex h-2 overflow-hidden rounded-full bg-ink/10" data-build-meter="">
      <i className="h-full bg-success-600" style={{ width: `${booked}%` }} />
      <i className="h-full bg-sn-accent" style={{ width: `${picks}%` }} />
    </div>
  );
}

/** What the ⓘ beside the row says: the four figures, and where a line's choices come from. */
function BuildFigures({ view }: { view: BuildView }) {
  const { money } = view;
  const row = (k: string, v: ReactNode) => (
    <span className="flex items-baseline justify-between gap-3 text-left">
      <span>{k}</span>
      <b className="font-semibold tabular-nums text-ink">{v}</b>
    </span>
  );
  return (
    <span className="flex flex-col gap-1.5" data-build-figures="">
      {row('Booked', <Count value={money.bookedPhp} format="peso" id="sup-build-i-booked" />)}
      {row('If you book these', <Count value={money.toBookPhp} format="peso" id="sup-build-i-tobook" />)}
      {row('Budget', money.budgetPhp == null ? '—' : <Count value={money.budgetPhp} format="peso" id="sup-build-i-budget" />)}
      {row('Buffer', money.unpriced > 0 ? 'Not knowable' : money.bufferPhp == null ? '—' : <Count value={money.bufferPhp} format="peso" id="sup-build-i-buffer" />)}
      {money.unpriced > 0 ? (
        <span className="text-left text-[13px]">
          <Count value={money.unpriced} id="sup-build-unpriced" /> {noPriceNote(money.unpriced)}.
        </span>
      ) : null}
      <span className="pt-1 text-left text-[13px]">
        A line picks only from that category’s Yours — suppliers you asked who gave a price. A supplier without a price
        can’t join a build; ask them first. Budget is set in Booked › Budget.
      </span>
    </span>
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
    // A covered supplier ("· with Reception") is offered by name only — their
    // one price lives on their own row (`lib/covered-row-name.ts`).
    ...line.candidates.map((c) => ({ key: c.vendorId, label: c.includedWith ? c.shownName : `${c.name} · ${formatPhp(c.pricePhp)}` })),
    ...(line.pick && !line.candidates.some((c) => c.vendorId === line.pick!.vendorId)
      ? [{ key: line.pick.vendorId, label: line.pick.shownName }]
      : []),
  ];
  const canChoose = line.candidates.length > 0 || line.pick != null;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-3" data-build-line={line.tile} data-booked={line.booked ? '' : undefined}>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/55">
          {line.label}
          {line.booked ? ' · booked' : ''}
        </p>
        {line.booked ? (
          <p className="mt-0.5 text-[15px] font-semibold text-ink">{line.booked.shownName}</p>
        ) : canChoose ? (
          <div className="mt-1 max-w-full" aria-busy={busy || undefined}>
            <PickMenu
              label={`Pick a ${line.label} supplier`}
              value={line.pick?.vendorId ?? NO_PICK}
              buttonText={line.pick ? line.pick.shownName : 'Pick one'}
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
          <p className="mt-0.5 text-[13px] leading-snug text-ink/55">Nobody shortlisted with a price yet</p>
        )}
      </div>
      <div className="text-right" data-money="">
        {who == null ? (
          canChoose ? (
            <span className="text-base text-ink/45" aria-hidden>
              —
            </span>
          ) : (
            <ActionButton tone="brand" icon={Search} label={`Find in ${line.label}`} onClick={onFind} />
          )
        ) : who.includedWith ? null : who.pricePhp != null ? (
          <span className="whitespace-nowrap text-[15px] font-semibold tabular-nums text-ink">
            <Count value={who.pricePhp} format="peso" id={`sup-build-line-${line.tile}`} />
          </span>
        ) : (
          <ActionButton tone="brand" main icon={Pencil} label="Set price" name={`Set price — ${who.name}`} href={priceHref(who.vendorId)} prefetch={false} />
        )}
      </div>
    </li>
  );
}

function FitLine({ view, allFree }: { view: BuildView; allFree: boolean }) {
  const { fit, dateLabel } = view;
  const hasDay = dateLabel != null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 py-3 text-[13px] text-ink/75" data-build-fit="">
      {hasDay && fit.priced > 0 ? (
        <span className={allFree ? 'text-success-700' : 'text-mulberry-700'} aria-hidden>
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
      {/* PR5: opens the date sheet ON this page — on Help me choose when a day is set (owner 2026-10-10 answer 8). */}
      <span className="ml-auto">
        <ActionButton
          tone="warn"
          icon={CalendarDays}
          label={hasDay ? 'Help me choose' : 'Set the date'}
          aria-haspopup="dialog"
          onClick={() => openSuppliersFactSheet('date', hasDay)}
          data-testid="build-fit-date"
        />
      </span>
    </div>
  );
}

/* ── COMPARE BUILDS — ONE TABLE, IN THE SHEET AND IN THE PANE ─────────────── */

function CompareTable({
  cards,
  cap,
  busy,
  onUse,
  onRename,
  onDelete,
}: {
  cards: BuildCard[];
  cap: number;
  busy: boolean;
  onUse: (card: BuildCard) => void;
  onRename: (card: BuildCard) => void;
  onDelete: (card: BuildCard) => void;
}) {
  const [shownIds, setShownIds] = useState<string[]>(() => compareShownAtFirst(cards, cap));
  const [hideSame, setHideSame] = useState(false);
  // A build deleted (or a cap that changed with the width) never leaves a hole: refill from the list, in its order.
  const shown = useMemo(() => {
    const kept = shownIds.flatMap((id) => cards.filter((c) => c.id === id)).slice(0, cap);
    for (const c of cards) if (kept.length < cap && !kept.includes(c)) kept.push(c);
    return kept;
  }, [shownIds, cards, cap]);
  const lowest = new Set(lowestTotalIds(shown));
  const rows = compareRowIndexes(shown, hideSame);
  const swap = cards.length > cap;
  const cols = `5.25rem repeat(${shown.length}, minmax(7.4rem, 1fr))`;
  const cell = 'min-w-0 border-b border-ink/10 px-2 py-2 text-[13px] leading-snug';
  const key = `${cell} text-ink/60`;
  const pickCol = (at: number, id: string) =>
    setShownIds(() => {
      const next = shown.map((c) => c.id);
      const was = next.indexOf(id);
      if (was >= 0) next[was] = next[at]!;
      next[at] = id;
      return next;
    });
  return (
    <div data-build-sheet="compare">
      <SwitchRow name="Hide what’s the same" on={hideSame} onChange={setHideSame} data="build-hide-same" />
      <div data-build-compare="" className="-mx-1 overflow-x-auto">
        <div role="table" aria-label="Compare builds" className="grid min-w-0" style={{ gridTemplateColumns: cols }}>
          <div role="row" className="contents">
            <span role="columnheader" className={cell} />
            {shown.map((c, at) => (
              <span role="columnheader" key={c.id} className={`${cell} font-semibold text-ink`} data-build-col={c.id}>
                {swap ? (
                  <PickMenu
                    label={`Build in column ${at + 1}`}
                    value={c.id}
                    buttonText={c.name}
                    options={cards.map((x) => ({ key: x.id, label: x.name, trail: { text: formatPhp(x.totalPhp), tone: 'muted' as const } }))}
                    onPick={(id) => pickCol(at, id)}
                    dataAttr="data-build-col-pick"
                    compact
                  />
                ) : (
                  c.name
                )}
                {c.id === CURRENT ? <span className={`font-normal text-ink/55 ${swap ? 'block px-1 text-xs' : ''}`}>{swap ? 'now' : ' · now'}</span> : null}
              </span>
            ))}
          </div>
          <div role="row" className="contents">
            <span role="rowheader" className={key}>
              Total
            </span>
            {shown.map((c, i) => (
              <span
                role="cell"
                key={c.id}
                className={`${cell} ${lowest.has(c.id) ? 'bg-success-50' : ''}`}
                data-build-total={lowest.has(c.id) ? 'lowest' : ''}
              >
                <b className="font-semibold tabular-nums text-ink">
                  <Count value={c.totalPhp} format="peso" id={`sup-build-card-${i}`} />
                </b>
                {c.unpriced > 0 ? (
                  <span className="block text-xs text-ink/55">
                    + <Count value={c.unpriced} id={`sup-build-card-unp-${i}`} /> without a price
                  </span>
                ) : null}
              </span>
            ))}
          </div>
          <div role="row" className="contents">
            <span role="rowheader" className={key}>
              Budget left
            </span>
            {shown.map((c, i) => (
              <span
                role="cell"
                key={c.id}
                className={`${cell} tabular-nums ${c.bufferPhp == null ? 'text-ink/55' : c.bufferPhp < 0 ? 'text-mulberry-700' : 'text-success-700'}`}
              >
                {c.unpriced > 0 ? (
                  'Not knowable'
                ) : c.bufferPhp == null ? (
                  '—'
                ) : c.bufferPhp < 0 ? (
                  <>
                    <Count value={-c.bufferPhp} format="peso" id={`sup-build-card-buf-${i}`} /> over
                  </>
                ) : (
                  <Count value={c.bufferPhp} format="peso" id={`sup-build-card-buf-${i}`} />
                )}
              </span>
            ))}
          </div>
          <div role="row" className="contents">
            <span role="rowheader" className={key}>
              Free on
            </span>
            {shown.map((c) => (
              <span role="cell" key={c.id} className={cell}>
                {c.free == null ? (
                  <span className="text-ink/55">—</span>
                ) : c.free.kind === 'dates' ? (
                  <span className="text-success-700">
                    Free: {c.free.labels.join(' · ')}
                    {c.free.more > 0 ? ` +${formatCount(c.free.more)}` : ''}
                  </span>
                ) : (
                  <span className="text-mulberry-700">
                    No shared free date
                    {c.free.who.length > 0 ? <span className="block">{c.free.who.join(', ')} taken that day</span> : null}
                  </span>
                )}
              </span>
            ))}
          </div>
          {rows.map((r) => (
            <div role="row" className="contents" key={r} data-build-compare-row={shown[0]?.rows[r]?.label}>
              <span role="rowheader" className={key}>
                {shown[0]?.rows[r]?.label}
              </span>
              {shown.map((c) => {
                const x = c.rows[r];
                return (
                  <span role="cell" key={c.id} className={`${cell} ${x?.full ? 'text-ink' : 'text-ink/55'}`}>
                    {x?.full ? (
                      x.inclusions.length > 0 ? (
                        // What the price comes with — folded, as the old compare cell was.
                        <details data-build-inclusions="">
                          <summary className="flex min-h-11 cursor-pointer list-none items-center">
                            {x.full} <span className="text-ink/55">&nbsp;▾</span>
                          </summary>
                          <span className="block text-xs text-ink/55">+ {x.inclusions.join(', ')}</span>
                        </details>
                      ) : (
                        <>
                          {x.full}
                          {x.booked ? <span className="text-xs text-ink/55"> · booked</span> : null}
                        </>
                      )
                    ) : (
                      '—'
                    )}
                  </span>
                );
              })}
            </div>
          ))}
          {hideSame && rows.length === 0 ? (
            <p className="col-span-full px-2 py-3 text-[13px] text-ink/60">These builds have the same supplier in every category.</p>
          ) : null}
          <div role="row" className="contents">
            <span role="rowheader" className={`${key} border-b-0`} />
            {shown.map((c) => (
              <span role="cell" key={c.id} className={`${cell} border-b-0`}>
                {c.id === CURRENT ? null : <CardActions card={c} busy={busy} onUse={onUse} onRename={onRename} onDelete={onDelete} />}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A saved build's three verbs, stacked in its column. Its own component, so `useFitRow` mounts with the row. */
function CardActions({
  card,
  busy,
  onUse,
  onRename,
  onDelete,
}: {
  card: BuildCard;
  busy: boolean;
  onUse: (card: BuildCard) => void;
  onRename: (card: BuildCard) => void;
  onDelete: (card: BuildCard) => void;
}) {
  return (
    <span className="grid gap-1.5" data-build-card={card.id}>
      <ActionButton
        tone="brand"
        main
        icon={Check}
        label="Use this build"
        name={`Use this build — ${card.name}`}
        onClick={() => onUse(card)}
        disabled={busy || card.apply.length === 0}
        title={
          card.apply.length === 0
            ? 'Nothing to use — every supplier in this build is booked already or no longer on your shortlist.'
            : undefined
        }
      />
      <ActionButton tone="neutral" icon={Pencil} label="Rename" name={`Rename — ${card.name}`} onClick={() => onRename(card)} disabled={busy} aria-haspopup="dialog" />
      <ActionButton tone="danger" icon={X} label="Delete this build" name={`Delete this build — ${card.name}`} onClick={() => onDelete(card)} disabled={busy} />
    </span>
  );
}

/* ── THE BAR AT THE THUMB ─────────────────────────────────────────────────── */

function BuildBar({
  kind,
  canSave,
  busy,
  onSaved,
  onSave,
  onSaveNew,
  bookSlot,
}: {
  kind: 'saved' | 'edited' | 'new';
  canSave: boolean;
  busy: boolean;
  onSaved: () => void;
  onSave: () => void;
  onSaveNew: () => void;
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
      className={`pointer-events-none fixed inset-x-0 bottom-[var(--sn-ride-h,var(--sn-bottomdock-h,64px))] z-[25] pl-[max(1rem,var(--sn-safe-l))] pr-[max(1rem,var(--sn-safe-r))] py-2.5 transition-transform ease-out motion-reduce:transition-none tab:bottom-7 tab:left-[var(--sup-col-left,auto)] tab:right-[var(--sup-col-right,max(1.75rem,var(--sn-safe-r)))] tab:px-0 ${
        up ? 'translate-y-0' : 'translate-y-[calc(100%_+_32px)]'
      }`}
      style={{ transitionDuration: `${THUMB_SLIDE_MS}ms` }}
    >
      {/* The bar sits on the page's own ground (frame 12; on a computer under the left pane only), so a line
          scrolling under it never shows through. A tablet keeps its floating pill. */}
      <i aria-hidden className="sn-ambient absolute inset-0 -z-10 tab:hidden lg:block lg:max-w-[26rem]" />
      <BarButtons kind={kind} canSave={canSave} busy={busy} onSaved={onSaved} onSave={onSave} onSaveNew={onSaveNew} bookSlot={bookSlot} />
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
  onSaveNew,
  bookSlot,
}: {
  kind: 'saved' | 'edited' | 'new';
  canSave: boolean;
  busy: boolean;
  onSaved: () => void;
  onSave: () => void;
  onSaveNew: () => void;
  bookSlot: ReactNode;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  useFitRow(rowRef);
  // ⬇ Not a ThumbRow, so it leaves its room itself (`lib/thumb-room.ts`) — the page pads by it, never by a number.
  useThumbRoom(rowRef);
  // Frame 12: the quiet answer (Save) on the left, Book this build — the main one — on the right. "Save as new" is
  // the row's ＋ New build now, so the bar holds one Save.
  return (
    <div ref={rowRef} data-build-bar-kind={kind} className="pointer-events-auto flex min-w-0 items-center gap-2.5 lg:max-w-[26rem]">
      {kind === 'saved' ? (
        <ActionButton tone="neutral" icon={Check} label="Saved" onClick={onSaved} aria-haspopup="dialog" className={BAR_FLEX} />
      ) : kind === 'edited' ? (
        <ActionButton tone="neutral" icon={Save} label="Save" onClick={onSave} disabled={busy} className={BAR_FLEX} />
      ) : (
        <ActionButton tone="neutral" icon={Save} label="Save this build" onClick={onSaveNew} disabled={!canSave} aria-haspopup="dialog" className={BAR_FLEX} />
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
  name,
  onName,
  busy,
  onClose,
  onSave,
  onDeleteTwin,
}: {
  kind: 'nothing_changed' | 'already_saved' | 'name' | 'rename';
  twinName: string;
  placeholder: string;
  name: string;
  onName: (v: string) => void;
  busy: boolean;
  onClose: () => void;
  onSave: () => void;
  onDeleteTwin?: () => void;
}) {
  if (kind === 'nothing_changed' || kind === 'already_saved') {
    return (
      <div data-build-sheet={kind}>
        <p className="text-sm text-ink/70">
          {kind === 'nothing_changed'
            ? `“${twinName}” already has exactly these suppliers.`
            : `This is exactly “${twinName}” — the same suppliers in every category. Nothing new to save.`}
        </p>
        <SheetFoot>
          {kind === 'already_saved' && onDeleteTwin ? (
            <ActionButton tone="danger" icon={X} label={`Delete “${twinName}”`} onClick={onDeleteTwin} disabled={busy} />
          ) : (
            <span aria-hidden />
          )}
          <ActionButton tone="brand" main icon={Check} label="OK" onClick={onClose} />
        </SheetFoot>
      </div>
    );
  }
  return (
    <form
      data-build-sheet={kind}
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <SheetField label={kind === 'rename' ? 'Name' : <>Name <span className="text-ink/45">(optional)</span></>}>
        <input
          value={name}
          onChange={(e) => onName(e.target.value)}
          maxLength={MAX_BUILD_TITLE_LEN}
          placeholder={placeholder}
          autoComplete="off"
          data-build-name=""
        />
      </SheetField>
      <SheetFoot>
        <ActionButton tone="neutral" icon={X} label={kind === 'rename' ? 'Cancel' : 'Not now'} onClick={onClose} />
        <ActionButton tone="brand" main icon={Save} label={kind === 'rename' ? 'Rename' : 'Save build'} type="submit" disabled={busy} />
      </SheetFoot>
    </form>
  );
}
