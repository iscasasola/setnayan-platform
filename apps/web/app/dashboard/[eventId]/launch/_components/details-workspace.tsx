'use client';

import { formatCount } from '@/lib/format-number';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { detailsItemLayout, type DetailsItemKey, type DetailsItemModel } from '@/lib/maker-details-items';
import {
  GUIDE_PARAM,
  backScreen,
  firstOpenScreen,
  guideParamOf,
  homeProgress,
  nextScreen,
  skipScreen,
  stepOf,
  stepOfItem,
  type GuidedRound,
  type GuidedScreen,
} from '@/lib/details-guided-flow';
import { GuideFoot, GuideHead, GuideReady, GuideTop, WhatsLeftDoor, hasUnsavedEdits, type DetailsGuide } from './details-guide';
import type { PrintField } from '@/lib/print-layout';
import { DetailsTapContext, PRINT_FIELD_INPUT } from './details-tap';
import { DetailsPieceContext, DetailsSelectContext, type DetailsPieces } from './details-go';
import { useMaker } from './maker-context';
import { useSameFieldDoors } from './same-field';

/** `DetailsItemModel` (`lib/maker-details-items.ts`) plus its small picture. */
export type DetailsNavItem = DetailsItemModel & {
  /** A small picture or glyph — never a live render (the list is not a gallery). */
  icon: ReactNode;
};

export type DetailsNavGroup = { key: string; label: string; items: DetailsNavItem[] };

/**
 * THE DETAILS PAGE WEARS THE MAKER'S THREE COLUMNS (owner 2026-09-28, verbatim:
 * *"then this means we can have the navigator on the left? so we can pick which
 * one to edit?"*; DECISION_LOG "THE DETAILS PAGE WEARS THE MAKER'S THREE
 * COLUMNS: NAVIGATOR LEFT · PREVIEW BODY · EDITOR RIGHT"; the approved
 * prototype `Setnayan/prototypes/details_themes_page_2026-09-28.html`).
 *
 *   · LEFT — the navigator of Details items, grouped (Theme · Your Event Hub ·
 *     Invitation set · For the day). Groups are DATA (`groups`), so the fact
 *     groups still to come (Your event · Words · Love Story · Schedule) are
 *     added as rows, not rework.
 *   · BODY — the picked item's picture: the theme gallery, the QR, a print.
 *   · RIGHT — the picked item's editor: what it includes, its words, its size,
 *     its downloads.
 *
 * 📱 PHONE (owner: 99% of viewers): the scene navigator's own shape — the body
 * on top, the navigator a sideways strip under it, and the editor a panel under
 * that which opens ("Edit · The Invitation ▴") and closes. All IN THE FLOW —
 * never `fixed` over the page, never a dialog (`MakerPage`'s rule).
 *
 * 🔑 EVERY EDITOR STAYS MOUNTED. The print words form posts every switch and
 * line it owns at once (`/api/hub-print/words` writes the whole
 * `print_details`); its fields live in several items' editors (joined to it by
 * `form=`), so an item that is not showing is HIDDEN, never unmounted — hidden
 * fields still post. A body is mounted the first time its item is opened and
 * then kept, so going back to the gallery keeps its scroll.
 *
 * Picking an item changes no data and loads no page: the address is kept in
 * step (`?tool=details&item=<key>`, `replaceState`) so a reload lands back here.
 * Inside the Maker the item is ALSO the Maker's (`detailsItem`), so a door
 * elsewhere in it — a scene's "Open the hero" — opens Details on that item.
 *
 * 🎨 THE PAGES THAT MOVED IN KEEP THEIR SPLIT (`detailsItemLayout`): the Hero
 * and the Reveal are a live page that FILLS the body, their controls on the
 * right; the Logo studio and the Mood Board carry their own tools, so they fill
 * the body AND the editor's column — no second editor beside them.
 *
 * ✍ TAP IT, EDIT IT ON THE RIGHT: a tap on a card's print-only words
 * (`PrintPreview`, via `DetailsTapContext`) opens the editor and puts the caret
 * in that one field.
 *
 * 🪜 WHAT'S LEFT — THE GUIDED FLOW (Details part 5, `guide`; owner 2026-09-29
 * "IT NEEDS TO BE VERY EASY…" and "THE GUIDED FLOW IS APPROVED — AND ANY STEP
 * CAN BE PICKED ANY TIME"): the SAME items, one at a time. A step is its item's
 * picture and editor exactly as drawn here — only the chrome changes: the
 * progress line and its step list above (`details-guide.tsx`), the step's
 * heading in plain words, the navigator narrowed to the step's own items and
 * pieces (hidden when there is only the one), and ‹ Back · Skip for now ·
 * Next › below. Each round ends on its Ready screen. "All items" returns to
 * the grouped navigator; its "What's left" goes back in. The step showing is
 * DERIVED from the item showing (`stepOfItem`), so a door elsewhere in the
 * Maker that opens an item no step shows simply lands in All items. Every
 * editor stays mounted in both modes — the flow hides, never unmounts.
 */
export function DetailsWorkspace({
  groups,
  bodies,
  editors,
  initial,
  persistent = null,
  pieces = {},
  guide = null,
}: {
  /** 🪜 The guided "What's left" (Details part 5); null = the navigator only (the lab without it). */
  guide?: DetailsGuide | null;
  /**
   * 🧩 A tool's own pieces, listed in the navigator under its item while it is
   * picked (DECISION_LOG "A TOOL MOVED INTO THE MAKER IS REBUILT INTO THE THREE
   * PARTS"): on a desk, rows under the item; on a phone, chips in the strip
   * right after it. Mounted once, only while the item is picked.
   */
  pieces?: Partial<Record<DetailsItemKey, ReactNode>>;
  groups: DetailsNavGroup[];
  bodies: Partial<Record<DetailsItemKey, ReactNode>>;
  editors: Partial<Record<DetailsItemKey, ReactNode>>;
  initial: DetailsItemKey;
  /** Drawn once, outside every item — the print words form, the first-visit tours. */
  persistent?: ReactNode;
}) {
  const items = groups.flatMap((g) => g.items);
  const first = items.some((i) => i.key === initial) ? initial : items[0]!.key;
  const maker = useMaker();
  /* The Maker's word wins when it names one of these items (a door elsewhere
     in the Maker asked for it); otherwise the page's own pick. */
  const asked = maker?.detailsItem && items.some((i) => i.key === maker.detailsItem) ? maker.detailsItem : null;
  const [own, setOwn] = useState<DetailsItemKey>(first);
  const selected = asked ?? own;
  const [visited, setVisited] = useState<ReadonlySet<DetailsItemKey>>(() => new Set([first]));
  const tellMaker = maker?.setDetailsItem;
  /* 🪜 In the flow the step's fields show at once — the editor opens on a phone. */
  const [sheetOpen, setSheetOpen] = useState(Boolean(guide?.open && guide.plan.steps.length > 0));
  /* The piece picked under each item (the three columns meet here). */
  const [pieceMap, setPieceMap] = useState<Partial<Record<DetailsItemKey, string | null>>>({});
  const pieceCtx = useMemo<DetailsPieces>(
    () => ({
      piece: (item) => pieceMap[item] ?? null,
      setPiece: (item, piece, opts) => {
        setPieceMap((m) => (m[item] === piece ? m : { ...m, [item]: piece }));
        if (piece && opts?.openEditor) setSheetOpen(true);
      },
    }),
    [pieceMap],
  );
  const editorRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLOListElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = items.find((i) => i.key === selected) ?? items[0]!;

  const select = useCallback(
    (key: DetailsItemKey) => {
      setOwn(key);
      tellMaker?.(key);
    },
    [tellMaker],
  );

  /* ══ 🪜 THE GUIDED FLOW ══ */
  const plan = guide && guide.plan.steps.length > 0 ? guide.plan : null;
  const [mode, setMode] = useState<'guided' | 'all'>(plan && guide?.open ? 'guided' : 'all');
  const [ready, setReady] = useState<GuidedRound | null>(
    plan && guide?.open && guide.ready !== null && plan.rounds.includes(guide.ready) ? guide.ready : null,
  );
  /** Next (or any move) found unsaved typing here: where it was going. */
  const [unsavedTo, setUnsavedTo] = useState<GuidedScreen | null>(null);
  const stepHere = plan ? stepOfItem(plan, selected) : null;
  const onReady = mode === 'guided' && plan !== null && ready !== null;
  const guidedOn = mode === 'guided' && plan !== null && (onReady || stepHere !== null);
  const at: GuidedScreen | null = !guidedOn ? null : onReady ? { kind: 'ready', round: ready! } : { kind: 'step', step: stepHere!.key };
  const guideAddr = at ? guideParamOf(at) : null;
  const modeKey = maker?.eventId ? `sn-details-mode:${maker.eventId}` : null;
  const remember = (m: 'guided' | 'all') => {
    try {
      if (modeKey) window.sessionStorage.setItem(modeKey, m);
    } catch {
      /* private mode: the flow simply opens as the page says */
    }
  };
  /* A couple who chose All items keeps it for the tab — unless the address itself named the flow. */
  useEffect(() => {
    if (!plan || guide?.addressed || !modeKey) return;
    try {
      if (window.sessionStorage.getItem(modeKey) === 'all') setMode('all');
    } catch {
      /* the page's own choice stands */
    }
    // Once, on the first paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* A door elsewhere in the Maker that opens another item leaves the Ready screen. */
  const lastAsked = useRef(asked);
  useEffect(() => {
    if (asked && asked !== lastAsked.current && asked !== own) setReady(null);
    lastAsked.current = asked;
  }, [asked, own]);

  const goTo = (to: GuidedScreen) => {
    setUnsavedTo(null);
    if (!plan) return;
    if (to.kind === 'ready') {
      setReady(to.round);
      return;
    }
    const step = stepOf(plan, to.step);
    if (!step) return;
    setReady(null);
    select(step.items.includes(selected) ? selected : (step.left[0] ?? step.items[0]!));
    setSheetOpen(true);
  };
  /** Every move away from a step first asks: is there typing here that is not saved? */
  const move = (to: GuidedScreen | null) => {
    if (!to) return;
    if (at?.kind === 'step' && stepHere) {
      const root = rootRef.current;
      const scopes = stepHere.items.flatMap((k) => [
        root?.querySelector(`[data-details-editor="${k}"]`) ?? null,
        root?.querySelector(`[data-details-body-item="${k}"]`) ?? null,
      ]);
      if (hasUnsavedEdits(scopes)) {
        setUnsavedTo(to);
        return;
      }
    }
    goTo(to);
  };
  const openGuide = () => {
    if (!plan) return;
    setMode('guided');
    remember('guided');
    if (stepOfItem(plan, selected)) {
      setReady(null);
      setSheetOpen(true);
    } else {
      const first = firstOpenScreen(plan);
      if (first) goTo(first);
    }
  };
  const allItems = () => {
    setMode('all');
    setReady(null);
    setUnsavedTo(null);
    remember('all');
  };
  const whatsLeftLine = (() => {
    if (!plan) return '';
    const h = homeProgress(plan);
    return h ? `Round ${h.round} · ${formatCount(h.done)} of ${formatCount(h.total)}` : 'All set';
  })();
  /* The navigator, narrowed in the flow to the step's own items (and their pieces). */
  const navGroups: DetailsNavGroup[] =
    guidedOn && stepHere
      ? [{ key: 'step', label: stepHere.title, items: items.filter((i) => stepHere.items.includes(i.key)) }]
      : groups;
  const showNav = !guidedOn || (!onReady && (navGroups[0]!.items.length > 1 || Boolean(pieces[selected])));

  /* The item showing — whoever picked it — is mounted, told to the Maker, and
     kept in the address. */
  useEffect(() => {
    setVisited((v) => (v.has(selected) ? v : new Set(v).add(selected)));
    if (maker && maker.detailsItem !== selected) tellMaker?.(selected);
    try {
      const url = new URL(window.location.href);
      if (
        url.searchParams.get('item') === selected &&
        url.searchParams.get('tool') === 'details' &&
        url.searchParams.get(GUIDE_PARAM) === guideAddr
      ) {
        return;
      }
      url.searchParams.set('tool', 'details');
      url.searchParams.set('item', selected);
      // 🪜 The flow rides in the address too (`?guide=1` / `?guide=ready-2`), so a reload lands back in it.
      if (guideAddr) url.searchParams.set(GUIDE_PARAM, guideAddr);
      else url.searchParams.delete(GUIDE_PARAM);
      window.history.replaceState(window.history.state, '', url);
    } catch {
      /* the address is a convenience; the page works without it */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `maker` changes on every Maker render; only the item matters
  }, [selected, tellMaker, guideAddr]);
  const layout = detailsItemLayout(selected);

  /* 🚪 One field, two doors: a fact drawn in two items is one value (part 2b). */
  useSameFieldDoors();

  /* The picked item stays in view in the navigator — by scrolling the NAVIGATOR
     only (`scrollLeft`/`scrollTop`), never `scrollIntoView`, which also scrolls
     every ancestor, the Maker included. */
  useEffect(() => {
    const nav = navRef.current;
    const el = nav?.querySelector<HTMLElement>(`[data-details-nav-item="${selected}"]`);
    if (!nav || !el) return;
    if (nav.scrollWidth > nav.clientWidth) nav.scrollLeft = Math.max(0, el.offsetLeft - nav.clientWidth / 2 + el.clientWidth / 2);
    else if (el.offsetTop < nav.scrollTop || el.offsetTop > nav.scrollTop + nav.clientHeight - el.clientHeight) nav.scrollTop = el.offsetTop - 24;
  }, [selected]);

  const tap = useCallback((field: PrintField) => {
    setSheetOpen(true);
    // After the panel has opened: the one field, ready to type.
    window.setTimeout(() => {
      const scope = editorRef.current?.querySelector<HTMLElement>(`[data-details-editor="${selected}"]`) ?? document;
      const el = scope.querySelector<HTMLElement>(`[name="${PRINT_FIELD_INPUT[field]}"]`) ??
        document.querySelector<HTMLElement>(`[name="${PRINT_FIELD_INPUT[field]}"]`);
      el?.focus();
    }, 60);
  }, [selected]);

  return (
    <DetailsTapContext.Provider value={tap}>
      <DetailsSelectContext.Provider value={select}>
      <DetailsPieceContext.Provider value={pieceCtx}>
      <div
        ref={rootRef}
        data-details-workspace=""
        data-details-item={selected}
        data-details-layout={layout}
        data-details-mode={guidedOn ? 'guided' : 'all'}
        className="flex h-full min-h-0 w-full flex-1 flex-col"
      >
      {plan && at ? (
        <GuideTop plan={plan} at={at} onPick={(to) => move(to)} onAllItems={allItems} tour={guide?.tour ?? null} />
      ) : null}
      <div
        data-details-row=""
        /* On a round's Ready screen the items step aside — hidden, never
           unmounted, so every editor's fields still post. */
        hidden={onReady}
        className={`${onReady ? 'hidden' : 'flex'} min-h-0 w-full flex-1 flex-col lg:flex-row`}
      >
        {/* ══ BODY — the picked item's picture (or, for a page that moved in, the page) ══ */}
        <section
          aria-label={`${current.label} — preview`}
          data-details-body=""
          className={`order-1 flex min-h-0 flex-1 flex-col overscroll-contain bg-[radial-gradient(120%_90%_at_50%_0%,rgba(203,167,102,.10),transparent_60%)] lg:order-2 ${
            layout === 'flow' ? 'overflow-y-auto px-4 py-5 sm:px-6' : 'overflow-hidden'
          }`}
        >
          <div className={layout === 'flow' ? 'mx-auto flex w-full max-w-4xl flex-col gap-4' : 'flex min-h-0 flex-1 flex-col'}>
            {items.map((i) =>
              visited.has(i.key) || i.key === selected ? (
                <div
                  key={i.key}
                  hidden={i.key !== selected}
                  data-details-body-item={i.key}
                  /* 🔑 `hidden` AND no display class when hidden: Tailwind's `flex` beats
                     the attribute's display:none, and every item would show at once. */
                  className={
                    i.key !== selected ? 'hidden' : detailsItemLayout(i.key) === 'flow' ? 'flex flex-col gap-4' : 'flex min-h-0 flex-1 flex-col'
                  }
                >
                  {guidedOn && stepHere && i.key === selected ? (
                    /* 🪜 In the flow: the step's round, its name, where it shows — plain words. */
                    <GuideHead step={stepHere} itemLabel={i.label} compact={detailsItemLayout(i.key) !== 'flow'} />
                  ) : detailsItemLayout(i.key) === 'flow' ? (
                    <header className="flex flex-col gap-0.5">
                      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
                        {groups.find((g) => g.items.some((x) => x.key === i.key))?.label}
                      </p>
                      <h2 className="font-serif text-2xl text-ink">{i.label}</h2>
                      {i.usedOn?.length ? (
                        <p className="text-xs text-ink/60" data-details-used-on={i.key}>
                          Used on {i.usedOn.join(' · ')}
                        </p>
                      ) : null}
                    </header>
                  ) : (
                    /* A page that moved in keeps its room: one line, not a masthead. */
                    <header className="flex shrink-0 flex-wrap items-baseline gap-x-2 px-4 pb-1 pt-2.5 sm:px-6">
                      <h2 className="font-serif text-lg text-ink">{i.label}</h2>
                      {i.usedOn?.length ? (
                        <p className="text-xs text-ink/60" data-details-used-on={i.key}>
                          Used on {i.usedOn.join(' · ')}
                        </p>
                      ) : null}
                    </header>
                  )}
                  {/* A server-made body can arrive as a lazy client reference; one keyed
                     fragment keeps it out of the header's list (React's key check). */}
                  <Fragment key="body">{bodies[i.key] ?? null}</Fragment>
                </div>
              ) : null,
            )}
          </div>
        </section>

        {/* ══ LEFT — the navigator (a sideways strip on a phone) ══ */}
        {showNav ? (
        <nav aria-label="Details — what to edit" className="order-2 shrink-0 border-t border-ink/10 bg-cream/80 lg:order-1 lg:w-[236px] lg:border-r lg:border-t-0">
          <ol
            ref={navRef}
            className="flex gap-1.5 overflow-x-auto px-3 py-2 [scrollbar-width:none] lg:h-full lg:flex-col lg:gap-0.5 lg:overflow-y-auto lg:overflow-x-hidden lg:py-4"
          >
            {plan && !guidedOn ? <WhatsLeftDoor label={whatsLeftLine} onOpen={openGuide} /> : null}
            {navGroups.map((g) => (
              <li key={g.key} className="contents" data-details-nav-group={g.key}>
                <p className="hidden px-2 pb-1 pt-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink/50 lg:block">{g.label}</p>
                <ul className="contents">
                  {g.items.map((i) => {
                    const on = i.key === selected;
                    return (
                      <li key={i.key} className={on && pieces[i.key] ? 'contents lg:block' : 'shrink-0'}>
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => select(i.key)}
                          data-details-nav-item={i.key}
                          className={`sn-press flex min-h-11 w-[84px] shrink-0 flex-col items-center gap-1 rounded-lg px-1.5 py-1.5 text-center transition-colors duration-sn-control ease-sn lg:w-full lg:flex-row lg:gap-2.5 lg:px-2 lg:text-left ${
                            on ? 'bg-ink/[0.07] text-ink' : 'text-ink/75 hover:bg-ink/[0.04]'
                          }`}
                        >
                          <span className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white ${on ? 'ring-2 ring-ink' : 'ring-1 ring-ink/10'}`}>
                            {i.icon}
                            {i.done ? (
                              <span
                                data-details-done={i.key}
                                aria-label="Done"
                                className="absolute -bottom-0.5 -right-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-success-700 text-white ring-2 ring-cream"
                              >
                                <Check aria-hidden className="h-2.5 w-2.5" strokeWidth={3} />
                              </span>
                            ) : null}
                          </span>
                          <span className="flex min-w-0 flex-col">
                            <span className="line-clamp-2 text-[11.5px] font-medium leading-tight lg:truncate lg:text-[13.5px]">{i.label}</span>
                            {i.sub ? <small className="hidden truncate text-[11.5px] text-ink/55 lg:block">{i.sub}</small> : null}
                          </span>
                        </button>
                        {on && pieces[i.key] ? (
                          /* 🧩 The tool's pieces — rows under it on a desk; on a phone they
                             follow it in the strip (this li is `contents` there). */
                          <div
                            data-details-pieces={i.key}
                            className="contents lg:flex lg:flex-col lg:gap-0.5 lg:py-1 lg:pl-11 lg:pr-1"
                          >
                            {pieces[i.key]}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        </nav>
        ) : null}

        {/* ══ RIGHT — the picked item's editor (a panel that opens, on a phone) ══ */}
        <aside
          aria-label={`${current.label} — edit`}
          data-details-editor-panel=""
          data-open={sheetOpen ? '' : undefined}
          /* A page that carries its own tools (the Logo studio, the Mood Board)
             has no second editor beside it — the column is hidden, never
             unmounted, so every other item's fields still post. */
          hidden={layout === 'whole'}
          className={`order-3 ${layout === 'whole' ? 'hidden' : 'flex'} min-h-0 shrink-0 flex-col border-t border-ink/10 bg-cream lg:max-h-none lg:w-[360px] lg:border-l lg:border-t-0 ${
            sheetOpen ? 'max-h-[72%]' : 'max-h-14 lg:max-h-none'
          }`}
        >
          <button
            type="button"
            onClick={() => setSheetOpen((o) => !o)}
            aria-expanded={sheetOpen}
            data-details-editor-handle=""
            className="flex min-h-14 shrink-0 items-center gap-2 px-4 text-left lg:hidden"
          >
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">Edit · {current.label}</span>
            {sheetOpen ? <ChevronDown aria-hidden className="h-4 w-4 text-ink/55" /> : <ChevronUp aria-hidden className="h-4 w-4 text-ink/55" />}
          </button>
          <p className="hidden px-4 pt-4 font-serif text-lg text-ink lg:block">{current.label}</p>
          <div
            ref={editorRef}
            className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-2 ${sheetOpen ? '' : 'hidden lg:block'}`}
          >
            {items.map((i) => (
              <div key={i.key} hidden={i.key !== selected} data-details-editor={i.key} className={i.key !== selected ? 'hidden' : 'flex flex-col gap-3'}>
                {editors[i.key] ?? null}
              </div>
            ))}
            {persistent}
          </div>
        </aside>
      </div>
      {plan && at?.kind === 'ready' && guide ? (
        <GuideReady plan={plan} round={at.round} actions={guide.actions} onGo={(to) => move(to)} />
      ) : null}
      {plan && at ? (
        <GuideFoot
          at={at}
          plan={plan}
          onBack={backScreen(plan, at) ? () => move(backScreen(plan, at)) : null}
          onSkip={skipScreen(plan, at) ? () => move(skipScreen(plan, at)) : null}
          onNext={nextScreen(plan, at) ? () => move(nextScreen(plan, at)) : null}
          warning={unsavedTo !== null}
          onKeepEditing={() => {
            setUnsavedTo(null);
            setSheetOpen(true);
          }}
          onGoAnyway={() => unsavedTo && goTo(unsavedTo)}
        />
      ) : null}
      </div>
      </DetailsPieceContext.Provider>
      </DetailsSelectContext.Provider>
    </DetailsTapContext.Provider>
  );
}
