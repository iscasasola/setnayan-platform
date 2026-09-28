'use client';

import { PickMenu } from '../../website/editor/_components/pick-menu';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Monitor, MoreHorizontal, PanelLeft, Plus, Smartphone, X } from 'lucide-react';
import type { TourKey } from '@/lib/tours';
import { useModalA11y } from '@/lib/use-modal-a11y';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import {
  MAKER_BAR,
  MAKER_SNAP_NOTE,
  isStagePhase,
  makerPlaceItem,
  makerPlacePick,
  type MakerBarItem,
} from './maker-bar';
import {
  MakerContext,
  MAKER_MORE_ROWS_ID,
  type MakerAddScene,
  type MakerDevice,
  type MakerLookPages,
  type MakerSelection,
  type MakerState,
} from './maker-context';
import { movedPageItem, type DetailsItemKey } from '@/lib/maker-details-items';
import { MakerTour } from './maker-tour';
import { MAKER_TOOL_BUTTON, MAKER_TOOL_WORD, MakerPlayMenu } from './maker-play-menu';
import { MAKER_OPEN_RESET_EVENT } from '../../website/_components/maker-open-reset';
import { MakerPage } from './maker-page';
import { PUBLIC_STAGE_LABELS } from '@/lib/public-site-stage-labels';
import { HUB_DRAFT_FIELD } from '@/lib/hub-draft';
import { MAKER_STAY_FIELD, makerStayReturn } from '@/lib/maker-stay';
import { announceUnheldWrite } from '@/lib/maker-refresh';
import { PaidMark } from '@/app/_components/paid-mark';
import { paidMarkLabel } from '@/lib/paid-mark';
import { VIEW_AS_FREE_LABEL } from '@/lib/view-as-free';
import { ViewAsFreeStrip, useViewAsFreeToggle } from './view-as-free';

/**
 * THE EVENT HUB MAKER — the full-screen shell (Phase 1 of
 * `EVENT_HUB_MAKER_BUILD_PLAN_2026-09-25.md`; drawing
 * `prototypes/event_hub_editor_FINAL_2026-09-24.html`).
 *
 * Four regions, and only four (owner 2026-09-24: *"a main editing screen, a
 * scrollable navigation, and editing tools each"* · *"we can opt to not have
 * the sidebar and top nav. we can have a button to exit editor"*):
 *
 *   1 · the toolbar — Exit · Play · Add · THE PLACE PICKER · Scenes · View ▾ ·
 *       More ▾ · Restore · Undo · Apply (Keynote's labelled buttons, 2026-09-27)
 *   2 · the navigator  ┐
 *   3 · the canvas     ├ the work area — `children`, built by the editor page
 *   4 · the inspector  ┘ with every panel and its own bound action
 *
 * 🔑 CHROMELESS WITHOUT A NEW PAGE. The event layout cannot skip its rail by
 * segment (a layout is handed `params`, never the path), so instead of a +1
 * route this shell covers the viewport: `fixed inset-0` above the rail, the
 * top bar and the phone's bottom nav, with the document scroll locked while it
 * is open. The menu key `launch` and its route are unchanged (owner 2026-09-25:
 * "label change only").
 *
 * ⛔ NO DEAD BUTTONS. Every bar item does something: a stage switches the
 * canvas, a tool opens a panel that already ships — and a control with no build
 * is not drawn at all (never a "coming in the next build" line; App Review
 * rejects "coming soon", 2026-09-28).
 *
 * 🧩 THE APPLY BAR MOUNTS HERE, ONCE. Restore · Undo · Apply (`applySlot`,
 * `website/_components/hub-draft-bar.tsx`) must stay visible at the upper
 * right of the top nav on every width (owner 2026-09-25). Since the Keynote
 * toolbar (2026-09-27) the toolbar is one wrapping row: on a phone the slot
 * takes a full-width, right-aligned line of its own under the tools; from
 * `md` it sits at the row's right end. One mount — so one draft bar listens
 * for More ▾'s "Reset this stage…" (`maker-open-reset.ts`).
 */
/** One stable empty set, so the context keeps its identity when none is handed in. */
const NO_FACT_EDITORS: Partial<Record<DetailsItemKey, ReactNode>> = {};

export function MakerShell({
  eventId,
  slug,
  liveStage,
  initialStage,
  initialSelection = null,
  storeShell,
  priceLabel,
  firstVisit,
  completeTourAction,
  renderStamp,
  more,
  applySlot = null,
  details = null,
  factEditors = NO_FACT_EDITORS,
  hasWork,
  viewAs = {},
  viewAsFree = null,
  theHost = 'the host',
  children,
}: {
  /** Who the Maker's work is for, in the event type's words (`EventWords.theHost`). */
  theHost?: string;
  /** 👁 "View as a free couple" — internal (§10a) viewers only; null draws
   *  nothing. `on` is the server's reading of this request (`asViewed`). */
  viewAsFree?: { on: boolean } | null;
  /** VIEW AS, per stage — each role's chip word and its server-gated preview
   *  door (`resolveHubRoleView`), or null when there is honestly none. */
  viewAs?: Partial<Record<LifecyclePhase, ReadonlyArray<{ role: string; name: string; href: string | null }>>>;
  eventId: string;
  slug: string | null;
  /** The stage guests meet today — the bar's red dot. Null when unmeasured. */
  liveStage: LifecyclePhase | null;
  initialStage: LifecyclePhase;
  initialSelection?: MakerSelection;
  storeShell: boolean;
  /** The live catalogue price of Event Hub Pro, formatted; null when unread. */
  priceLabel: string | null;
  firstVisit: boolean;
  completeTourAction: (tourKey: TourKey) => Promise<void>;
  renderStamp: string;
  /** The ⋯ sheet: the address, who and when, and the doors the controller kept. */
  more: ReactNode;
  /** Phase 2's Apply · Restore · Reset bar. */
  applySlot?: ReactNode;
  /** Details as a PAGE (Maker bar's Details): `page` is what the details feed —
   *  the address and its QR, and the printed cards they fill — and `controls`
   *  the fields (what the prints include, and every line of wording). */
  details?: { page: ReactNode; controls: ReactNode } | null;
  /** ✍ The Details items' own editors a fact tapped on a stage opens
   *  (`detailsFactEditors`) — the SAME nodes Details draws. RSVP and Love Story
   *  moved into Details whole (part 2b); their pages are Details items now. */
  factEditors?: Partial<Record<DetailsItemKey, ReactNode>>;
  /** False when the work area is not the editor (a coordinator, or an event
   *  type with no Event Hub): the tool items then have nothing to open. */
  hasWork: boolean;
  children: ReactNode;
}) {
  const [stage, setStage] = useState<LifecyclePhase>(initialStage);
  const [device, setDevice] = useState<MakerDevice>('desktop');
  const [navOpen, setNavOpen] = useState(true);
  /* 🧭 A page that moved into Details (Logo · Hero · Reveal, part 3) opens
     Details on its item — from the address, from memory, or from a door in
     the Maker (`movedSelection`). */
  const [detailsItem, setDetailsItem] = useState<DetailsItemKey | null>(() => movedSelection(initialSelection).item);
  const [selection, setSelection] = useState<MakerSelection>(() => movedSelection(initialSelection).selection);
  const [lookPages, setLookPages] = useState<MakerLookPages | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [tour, setTour] = useState<'first' | 'again' | null>(firstVisit ? 'first' : null);
  const [viewAsRole, setViewAsRole] = useState<string | null>(null);
  const stageRoles = viewAs[stage] ?? [];
  const viewAsHref = viewAsRole ? (stageRoles.find((r) => r.role === viewAsRole)?.href ?? null) : null;

  /*
    🪤 MEASURED IN THE BROWSER: EVERY SAVE REMOUNTS THIS SHELL. Each panel
    posts to an action that redirects back here with a new query (`?scene=`,
    `?saved=1`), and the App Router keys a page by its search params — so the
    whole Maker mounts fresh after each write, and the stage, the device and
    the open navigator all snapped back to their defaults. What the couple was
    looking at is kept for the tab in sessionStorage and put back on mount (a
    convenience only: every fact the Maker shows is re-read from the server).
    ✅ 2026-09-28: a Maker save no longer remounts it at all — the submit
    listener below lands every save on the address the couple is already on
    (`lib/maker-stay.ts`). The memory stays for a real reload and a fresh visit.
  */
  const memoryKey = `sn-maker:${eventId}`;
  const restored = useRef(false);
  /** The address named what to open — memory then never moves Details' item. */
  const addressNamed = useRef(initialSelection !== null);
  useEffect(() => {
    let saved: { stage?: string; device?: string; navOpen?: boolean; selection?: MakerSelection } | null = null;
    try {
      saved = JSON.parse(window.sessionStorage.getItem(memoryKey) ?? 'null');
    } catch {
      saved = null;
    }
    if (saved && isStagePhase(saved.stage)) setStage(saved.stage);
    if (saved?.device === 'desktop' || saved?.device === 'phone') setDevice(saved.device);
    else if (window.matchMedia('(max-width: 767px)').matches) setDevice('phone');
    if (typeof saved?.navOpen === 'boolean') setNavOpen(saved.navOpen);
    // An address that names what to open (a save's `?scene=`) wins over memory.
    if (saved?.selection) {
      const moved = movedSelection(saved.selection);
      setSelection((cur) => cur ?? moved.selection);
      if (moved.item && !addressNamed.current) setDetailsItem((d) => d ?? moved.item);
    }
    restored.current = true;
  }, [memoryKey]);
  useEffect(() => {
    if (!restored.current) return;
    try {
      window.sessionStorage.setItem(memoryKey, JSON.stringify({ stage, device, navOpen, selection }));
    } catch {
      /* private mode / blocked storage: the Maker simply opens on its defaults */
    }
  }, [memoryKey, stage, device, navOpen, selection]);

  /* A role is read per stage: a new stage starts back on the host's preview. */
  useEffect(() => setViewAsRole(null), [stage]);

  /* The document under the Maker must not scroll behind it. */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('sn-maker-open');
    return () => root.classList.remove('sn-maker-open');
  }, []);

  /* 📱 THE KEYBOARD NEVER COVERS A FIELD (owner 2026-09-25: *"99% of the viewers
     will use the phone"*). A phone's on-screen keyboard shrinks the VISUAL
     viewport only, so a `fixed inset-0` shell kept its full height and the
     keyboard sat over the controls strip at its foot. While the keyboard is up
     (visual viewport shorter than the layout one, at scale 1 — never a pinch)
     the shell is sized to what is visible. */
  const shellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    const el = shellRef.current;
    if (!vv || !el) return;
    const fit = () => {
      const keyboard = Math.abs(vv.scale - 1) < 0.01 && vv.height < window.innerHeight - 80;
      el.style.height = keyboard ? `${Math.round(vv.height)}px` : '';
      el.style.top = keyboard ? `${Math.round(vv.offsetTop)}px` : '';
      el.style.bottom = keyboard ? 'auto' : '';
    };
    fit();
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
    return () => {
      vv.removeEventListener('resize', fit);
      vv.removeEventListener('scroll', fit);
    };
  }, []);

  /* 🧷 A MAKER SAVE NEVER REMOUNTS THE MAKER (owner 2026-09-28: *"a lot of
     times. it reloads the whole page. which shouldn't"*). Every Maker panel
     posts to an action that redirects to its `return_to` + `?saved=1`; a new
     query is a new page key, so the App Router swapped the whole Maker for the
     launch route's grid skeleton and mounted it fresh. Here, in the CAPTURE
     phase — before React reads the form into its action — a Maker form is
     pointed back at the address the couple is already on, verbatim
     (`lib/maker-stay.ts`). Nothing remounts; only the data changes. Every form
     is also announced as a write the canvas did not draw (its hold is
     dropped), unless the form says the bridge drew it (`data-maker-held`). */
  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const onSubmit = (e: Event) => {
      const form = e.target;
      if (!(form instanceof HTMLFormElement)) return;
      const here = `${window.location.pathname}${window.location.search}`;
      const returnTo = form.querySelector<HTMLInputElement>('input[name="return_to"]');
      const next = makerStayReturn({
        eventId,
        here,
        returnTo: returnTo?.value ?? null,
        drafts: Boolean(form.querySelector(`input[name="${HUB_DRAFT_FIELD}"]`)),
        /* A React action form carries NO method attribute (a client-rendered
           one reads `form.method` as 'get'); only an explicit GET is a search. */
        method: form.getAttribute('method') ?? 'post',
      });
      if (next) {
        setHiddenField(form, 'return_to', next);
        setHiddenField(form, MAKER_STAY_FIELD, '1');
      }
      if ((form.getAttribute('method') ?? 'post').toLowerCase() !== 'get' && form.dataset.makerHeld !== '1') {
        announceUnheldWrite();
      }
    };
    el.addEventListener('submit', onSubmit, true);
    return () => el.removeEventListener('submit', onSubmit, true);
  }, [eventId]);

  const select = useCallback((next: MakerSelection) => {
    const moved = movedSelection(next);
    if (moved.item) setDetailsItem(moved.item);
    setSelection(moved.selection);
  }, []);
  /* ＋ ADD A SCENE — registered by the work area (`MakerAddScene`); the toolbar's
     ＋ and the phone's More ▾ row are drawn from it below. */
  const [addScene, setAddScene] = useState<MakerAddScene | null>(null);

  const value = useMemo<MakerState>(
    () => ({
      eventId,
      stage,
      setStage,
      device,
      navOpen,
      selection,
      select,
      moreOpen,
      renderStamp,
      storeShell,
      viewAsHref,
      addScene,
      setAddScene,
      detailsItem,
      setDetailsItem,
      lookPages,
      setLookPages,
      factEditors,
    }),
    [eventId, stage, device, navOpen, selection, select, moreOpen, renderStamp, storeShell, viewAsHref, addScene, detailsItem, lookPages, factEditors],
  );

  /* ONE HIGHLIGHT (owner 2026-09-25: "there should also be only one highlighted
     here. stage must leave" · "allow other to be highlighted"). Picking a stage
     closes an open made-once tool; opening a tool takes the highlight from the
     stage (see `MakerBar`). The canvas keeps showing the stage either way. */
  const pressBar = (item: MakerBarItem) => {
    if (item.kind === 'stage') {
      setStage(item.key);
      if (selection?.kind === 'tool') select(null);
      return;
    }
    if (item.kind === 'tool' && hasWork) select({ kind: 'tool', key: item.key });
  };

  /* ▶ The stage as guests meet it — page-only, with the host's DRAFT
     (`?preview=draft`, host-verified on the page; `app/[slug]/_lib/editor-canvas.ts`). */
  const playHref = slug ? `/${slug}?phase=${stage}&preview=draft` : null;

  return (
    <MakerContext.Provider value={value}>
      {/* An inline <style>, not a CSS import: unit tests load these modules.
          ① The scroll lock. ② 🪤 MEASURED IN THE BROWSER: the layout's
          `.sn-vt-page` carries `view-transition-name`, which makes it a
          STACKING CONTEXT — so this shell's z-index was trapped inside it and
          the app's sticky top bar (z-20, outside it) painted over the Maker's
          toolbar. While the Maker is on the page that name is dropped, so
          `fixed inset-0 z-[80]` really is above the rail, the top bar and the
          bottom nav. `:has()` applies it from the first server paint; the
          class is the fallback once hydrated. */}
      <style>
        {'html.sn-maker-open,html.sn-maker-open body,html:has([data-maker-shell]),html:has([data-maker-shell]) body{overflow:hidden}' +
          'html.sn-maker-open .sn-vt-page,.sn-vt-page:has([data-maker-shell]){view-transition-name:none}'}
      </style>
      <div
        ref={shellRef}
        className="fixed inset-0 z-[80] flex flex-col bg-cream text-ink"
        data-maker-shell=""
        aria-label="Event Hub Maker"
        role="region"
      >
        {/* ══ 1 · THE TOOLBAR — Keynote's, in the Maker's own look ══
            (owner 2026-09-27: *"use keynote and pages as inspiration on how to
            make our toolbars look"*; approved prototype
            `prototypes/maker_toolbars_keynote_pages_2026-09-27.html`, the
            "Today → New" strip): the Maker's own actions on the left as
            labelled buttons (Exit · Play · Add), the ONE place picker, then
            Scenes · View ▾ · More ▾, and Restore · Undo · Apply on the right.
            ⛔ NO INSPECTOR SWITCHES HERE — Format · Animate · Arrange live only
            as the inspector's own tabs (owner: *"repeated. just place it on
            the sidebar instead of the top bar?"*). Snap grid, a note and not a
            tool, moved into More ▾; About the Maker and the address sheet too. */}
        <header
          data-maker-toolbar=""
          className="sn-glass-bare relative z-20 flex shrink-0 flex-wrap items-center gap-x-0.5 gap-y-1 px-1.5 py-1 md:flex-nowrap md:gap-1 md:px-2.5"
        >
          <div className="flex shrink-0 items-center" data-maker-tools="left">
            <Link
              href={`/dashboard/${eventId}`}
              aria-label="Exit the Event Hub Maker"
              title="Exit"
              data-maker-tool="exit"
              className={MAKER_TOOL_BUTTON}
            >
              <X aria-hidden className="h-5 w-5" strokeWidth={2} />
              <span className={MAKER_TOOL_WORD}>Exit</span>
            </Link>
            {playHref ? (
              /* ▶ Play this scene (in place, in the canvas) · Preview the whole
                 stage (a new tab, page-only, the draft). */
              <MakerPlayMenu
                stageHref={playHref}
                stageLabel={PUBLIC_STAGE_LABELS[stage]}
                sceneSelected={
                  selection?.kind === 'scene' ||
                  (selection?.kind === 'tool' && ['hero', 'reveal', 'post-event'].includes(selection.key)) ||
                  /* The Hero and the Reveal play in their frame inside Details (`details-look-pages.tsx`). */
                  (selection?.kind === 'tool' && selection.key === 'details' && (detailsItem === 'hero' || detailsItem === 'reveal'))
                }
              />
            ) : null}
            {/* ＋ ADD A SCENE (DECISION_LOG 2026-09-27 — it works): drawn from
                what the work area registered. Ready opens its template sheet;
                refused says why (padlocked when it is Event Hub Pro); nothing
                in the store shell. On a phone it is the More ▾ row below. */}
            <span className="hidden md:inline-flex">
              <AddSceneTool addScene={addScene} />
            </span>
          </div>
          <i aria-hidden className="mx-1 hidden h-7 w-px shrink-0 bg-ink/15 md:block" />

          {/* The ONE place picker — kept as is (it collapses to "● Invitation ▾"
              by measured overflow, never a breakpoint). */}
          <div className="flex min-w-0 flex-1 px-2 md:px-0" data-maker-place="">
            <MakerBar
              stage={stage}
              liveStage={liveStage}
              selection={selection}
              hasWork={hasWork}
              theHost={theHost}
              onPress={pressBar}
            />
          </div>

          <i aria-hidden className="mx-1 hidden h-7 w-px shrink-0 bg-ink/15 md:block" />
          <div className="flex shrink-0 items-center" data-maker-tools="right">
            {hasWork ? (
              <button
                type="button"
                aria-label={navOpen ? 'Hide the scenes' : 'Show the scenes'}
                title={navOpen ? 'Hide the scenes' : 'Show the scenes'}
                aria-pressed={navOpen}
                onClick={() => setNavOpen((o) => !o)}
                data-maker-tool="scenes"
                className={`${MAKER_TOOL_BUTTON} hidden lg:inline-flex`}
              >
                <PanelLeft aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                <span className={MAKER_TOOL_WORD}>Scenes</span>
              </button>
            ) : null}
            <span className="hidden md:inline-flex">
              <ToolMenu
                label="View"
                tool="view"
                icon={
                  device === 'phone' ? (
                    <Smartphone aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                  ) : (
                    <Monitor aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                  )
                }
              >
                {(close) => (
                  <>
                    <MenuItem on={device === 'desktop'} onClick={() => { setDevice('desktop'); close(); }}>
                      Desktop
                    </MenuItem>
                    <MenuItem on={device === 'phone'} onClick={() => { setDevice('phone'); close(); }}>
                      Phone
                    </MenuItem>
                  </>
                )}
              </ToolMenu>
            </span>
            <ToolMenu label="More" tool="more" align="end" icon={<MoreHorizontal aria-hidden className="h-5 w-5" strokeWidth={1.75} />}>
              {(close) => (
                <>
                  <MenuItem onClick={() => { close(); setMoreOpen(true); }}>Your Event Hub address</MenuItem>
                  <MenuItem onClick={() => { close(); setMoreOpen(true); }}>Who can view</MenuItem>
                  {hasWork && stageRoles.length > 0 ? (
                    <>
                      <MenuHeading>See it as…</MenuHeading>
                      <MenuItem on={viewAsRole === null} onClick={() => { setViewAsRole(null); close(); }}>
                        You · editing
                      </MenuItem>
                      {stageRoles.map((r) => (
                        <MenuItem
                          key={r.role}
                          on={viewAsRole === r.role}
                          disabled={!r.href}
                          note={r.href ? undefined : 'No preview for this one yet.'}
                          onClick={() => { setViewAsRole(r.role); close(); }}
                        >
                          {r.name}
                        </MenuItem>
                      ))}
                    </>
                  ) : null}
                  {/* 👁 Internal accounts only — see `view-as-free.tsx`. */}
                  {viewAsFree ? <ViewAsFreeRow on={viewAsFree.on} close={close} /> : null}
                  {applySlot ? (
                    <MenuItem onClick={() => { close(); window.dispatchEvent(new Event(MAKER_OPEN_RESET_EVENT)); }}>
                      Reset this stage…
                    </MenuItem>
                  ) : null}
                  {/* ＋ Add a scene on a phone — the toolbar has no room for it
                      there, so it is a row here (the same registration). */}
                  {addScene?.kind === 'ready' ? (
                    <MenuItem className="md:hidden" onClick={() => { close(); addScene.open(); }}>
                      <span data-maker-add-scene="">Add a scene</span>
                    </MenuItem>
                  ) : addScene?.kind === 'refused' ? (
                    <MenuItem disabled note={addScene.note} className="md:hidden">
                      <span data-maker-add-scene="refused" className="inline-flex items-center gap-1.5">
                        Add a scene
                        {addScene.locked ? (
                          <PaidMark state="locked" label={paidMarkLabel('locked', 'Event Hub Pro')} size="xs" />
                        ) : null}
                      </span>
                    </MenuItem>
                  ) : null}
                  <MenuItem disabled note={MAKER_SNAP_NOTE}>
                    Snap grid
                  </MenuItem>
                  <MenuItem onClick={() => { close(); setTour('again'); }}>About the Maker</MenuItem>
                </>
              )}
            </ToolMenu>
          </div>

          {/* 💾 RESTORE · UNDO · APPLY — upper right of the top nav, on every
              screen (owner 2026-09-25: *"upper right of the top nav"*),
              unchanged. On a phone the bar's row has no room left for them, so
              they take their own right-aligned line under it — still the top
              of the Maker, still the right edge. ONE mount now, not two. */}
          {applySlot ? (
            <div className="ml-auto flex basis-full items-center justify-end gap-1.5 md:basis-auto" data-maker-apply-slot="">
              {applySlot}
            </div>
          ) : null}
        </header>

        {/* 👁 While the switch is on it is SAID, on every width, until stopped. */}
        {viewAsFree?.on ? <ViewAsFreeStrip /> : null}

        {/* ══ 2 · 3 · 4 · THE WORK AREA ══ */}
        <div className="relative min-h-0 flex-1">
          {children}
          {/* 🖼 DETAILS IS A PAGE (owner 2026-09-25: *"we do not want a pop up for
              details, logo, hero, reveal and love story"*): what the details
              feed is the body, the fields sit where a stage's controls sit. It
              covers the work area — the editor keeps its state underneath — as
              a page in the body, never a dialog. */}
          {hasWork && selection?.kind === 'tool' && selection.key === 'details' ? (
            <div className="absolute inset-0 z-30 flex bg-cream" data-maker-details-layer="">
              <MakerPage
                pageKey="details"
                page={
                  details?.page ?? (
                    /* A read that failed is SAID, never an empty page. */
                    <p role="alert" className="m-auto max-w-sm px-4 text-center text-sm text-terracotta-700">
                      Your details could not be loaded just now. Nothing was changed — please reopen this in a moment.
                    </p>
                  )
                }
                controls={details?.controls ?? null}
              />
            </div>
          ) : null}
        </div>

        {/* ══ ⋯ · THE SHEET ══ Kept mounted (hidden when shut) so the work area
            can portal the address rows into it. */}
        <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)}>
          <div id={MAKER_MORE_ROWS_ID} className="flex flex-col gap-2" />
          {more}
        </MoreSheet>

        {tour ? (
          <MakerTour
            storeShell={storeShell}
            priceLabel={priceLabel}
            record={tour === 'first'}
            completeAction={completeTourAction}
            onClose={() => setTour(null)}
            onStart={() => {
              setTour(null);
              if (hasWork) select({ kind: 'main' });
            }}
          />
        ) : null}
      </div>
    </MakerContext.Provider>
  );
}

/**
 * The bar itself — the four stages, a divider, then Details; exported so a test can render
 * it and count what a couple sees.
 */
export function MakerBar({
  stage,
  liveStage,
  selection,
  hasWork,
  theHost = 'the host',
  onPress,
}: {
  stage: LifecyclePhase;
  liveStage: LifecyclePhase | null;
  selection: MakerSelection;
  hasWork: boolean;
  /** Who Details is for, in the event type's words — "the couple", "the host". */
  theHost?: string;
  onPress: (item: MakerBarItem) => void;
}) {
  const groups: MakerBarItem[][] = [];
  for (const item of MAKER_BAR) {
    const last = groups[groups.length - 1];
    if (last && last[0]!.group === item.group) last.push(item);
    else groups.push([item]);
  }

  /*
    🪤 OWNER, ON THE LIVE MAKER (2026-09-25): "cannot see logo anymore even if i
    scroll". The bar was `justify-content: center` on a scroll container — when
    the items are wider than the bar, centring pushes the overflow off BOTH
    edges and the left half can never be scrolled to (Logo was clipped, "Prints
    & Tick…" cut). Centring now comes from `margin-inline: auto` on the first and
    last groups (`ms-auto` / `me-auto`): with room to spare they centre the bar;
    without it they collapse to 0 and every item is reachable by scrolling.
    `the-maker-bar-is-the-final-bar.test.ts` holds the rule.
  */
  const navRef = useRef<HTMLElement>(null);
  const [fade, setFade] = useState<{ l: boolean; r: boolean }>({ l: false, r: false });
  const measure = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setFade({ l: el.scrollLeft > 2, r: el.scrollLeft < max - 2 });
  }, []);
  /* The ACTIVE item is scrolled into view when the Maker opens, whenever it
     changes, and when the window resizes (measured: at 768 and 1024 a resize
     left the active pill past the edge) — on a phone the stage the couple is
     on may sit past the edge. */
  const showActive = useCallback(() => {
    const el = navRef.current;
    const on = el?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (el && on) {
      const left = on.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
      if (left < el.scrollLeft || left + on.offsetWidth > el.scrollLeft + el.clientWidth) {
        el.scrollTo({ left: Math.max(0, left - el.clientWidth / 2 + on.offsetWidth / 2) });
      }
    }
    measure();
  }, [measure]);
  useEffect(() => {
    window.addEventListener('resize', showActive);
    return () => window.removeEventListener('resize', showActive);
  }, [showActive]);
  useEffect(() => {
    showActive();
  }, [stage, selection, showActive]);
  /*
    🧭 WHEN THE ROW CANNOT FIT, IT BECOMES ONE PICKER (owner 2026-09-27, on the
    stage row clipped to "…vitation" / "Save the…" at laptop widths: *"we can
    also convert this to a drop down/tap to show options for smaller
    screens?"* — and then, on the two pickers that shipped: *"combine them in 1
    dropdown"*). Decided by MEASURED overflow, never a breakpoint: the full row
    is drawn, its natural width is read, and only when it is wider than the
    room the bar has does it collapse to "● Invitation ▾" (or "Details ▾" while
    it is open), listing the four stages and Details. The room is watched
    (ResizeObserver) and the row comes back the moment it fits. The picker runs
    the SAME `onPress` the buttons do.
  */
  const [compact, setCompact] = useState(false);
  /* …and when even the picker cannot fit beside the other controls (a
     1024px laptop leaves the bar ~150px), the bar takes its own full row inside
     the toolbar rather than truncate "Invitation". It comes back beside them
     once the window is wider than where it wrapped. */
  const [wrapped, setWrapped] = useState(false);
  const fullWidth = useRef(0);
  const wrapAt = useRef(0);
  useEffect(() => {
    const el = navRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const check = () => {
      if (!compact) {
        fullWidth.current = el.scrollWidth;
        if (barShouldCollapse(el.scrollWidth, el.clientWidth)) setCompact(true);
      } else if (!wrapped) {
        if (barShouldCollapse(el.scrollWidth, el.clientWidth)) {
          wrapAt.current = window.innerWidth;
          setWrapped(true);
        } else if (!barShouldCollapse(fullWidth.current, el.clientWidth)) {
          setCompact(false);
        }
      }
    };
    const onResize = () => {
      if (wrapped && window.innerWidth > wrapAt.current + 24) setWrapped(false);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    window.addEventListener('resize', onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [compact, wrapped]);

  const mask =
    !compact && (fade.l || fade.r)
      ? `linear-gradient(to right, ${fade.l ? 'transparent' : '#000'} 0, #000 20px, #000 calc(100% - 20px), ${fade.r ? 'transparent' : '#000'} 100%)`
      : undefined;

  const place = makerPlacePick({
    stage,
    liveStage,
    openTool: selection?.kind === 'tool' ? selection.key : null,
    hasWork,
    theHost,
  });

  if (compact) {
    return (
      <nav
        ref={navRef}
        aria-label="Event Hub Maker"
        data-maker-bar=""
        data-maker-bar-compact={wrapped ? 'wrapped' : ''}
        className={`-mx-2 flex min-w-0 items-center justify-center gap-1.5 overflow-hidden px-2 md:mx-auto md:flex-1 ${
          wrapped ? 'md:order-last md:basis-full' : ''
        }`}
      >
        {/* ▾ ONE PICKER, NOT TWO (owner 2026-09-27, on "● Invitation ▾" +
            "Logo ▾": *"combine them in 1 dropdown"*). The button names where
            the couple IS — Details, else the stage — and the list is one flat
            list: the four stages, then Details (`makerPlacePick`, maker-bar.ts;
            DECISION_LOG "OPTION B …"). */}
        <PickMenu
          label="Stage or page"
          dataAttr="data-maker-place-pick"
          className="shrink-0"
          value={place.value}
          options={place.options}
          onPick={(key) => {
            const item = makerPlaceItem(key, hasWork);
            if (item) onPress(item);
          }}
        />
      </nav>
    );
  }

  return (
    <nav
      ref={navRef}
      aria-label="Event Hub Maker"
      data-maker-bar=""
      onScroll={measure}
      style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
      className="-mx-2 flex min-w-0 items-center gap-0.5 overflow-x-auto scroll-px-4 px-2 [scrollbar-width:none] md:mx-auto md:flex-1"
    >
      {groups.map((group, gi) => (
        <span
          key={group[0]!.group}
          className={`flex shrink-0 items-center gap-0.5 ${gi === 0 ? 'ms-auto' : ''} ${gi === groups.length - 1 ? 'me-auto' : ''}`}
        >
          {gi > 0 ? <i aria-hidden data-maker-divider="" className="mx-1.5 block h-5 w-px bg-ink/15" /> : null}
          {group.map((item) => {
            if (item.kind === 'tool' && !hasWork) {
              return (
                <ComingNext
                  key={item.key}
                  label={item.label}
                  itemKey={item.key}
                  note={`Only ${theHost} can open this part of the Event Hub Maker.`}
                  align={gi === 0 ? 'start' : 'end'}
                  chip
                >
                  {item.label}
                </ComingNext>
              );
            }
            // ONE highlight: an open tool takes it; otherwise the stage has it.
            const on =
              item.kind === 'stage'
                ? stage === item.key && selection?.kind !== 'tool'
                : selection?.kind === 'tool' && selection.key === item.key;
            return (
              <button
                key={item.key}
                type="button"
                data-maker-bar-item={item.key}
                aria-pressed={on}
                onClick={() => onPress(item)}
                className={`sn-press inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13.5px] font-semibold transition-colors duration-sn-control ease-sn md:px-3.5 ${
                  on ? 'bg-ink text-cream' : 'text-ink/70 hover:bg-ink/5 hover:text-ink'
                }`}
              >
                {item.kind === 'stage' && liveStage === item.key ? (
                  <span aria-label="live today" title="Live today" className="h-1.5 w-1.5 rounded-full bg-terracotta" />
                ) : null}
                {item.label}
              </button>
            );
          })}
        </span>
      ))}
    </nav>
  );
}

/**
 * Collapse the bar only when its natural width does not fit the room it has
 * (a 1px tolerance for sub-pixel rounding). Exported for the test.
 */
export function barShouldCollapse(naturalWidth: number, room: number): boolean {
  return naturalWidth > room + 1;
}

/**
 * A control whose build is the next one: pressing it says so, in one line, in
 * the same glass bubble the house `(i)` uses (`.sn-tip`). Never a dead button.
 */
/**
 * ＋ ADD A SCENE in the toolbar, from the work area's registration
 * (`MakerAddScene`): ready → a tool button that opens its sheet; refused → the
 * house bubble saying why (`ComingNext`), wearing the padlock and linking to
 * the unlock when the reason is Event Hub Pro; null → nothing. It can post
 * nothing itself — the write is the sheet's tile form.
 */
function AddSceneTool({ addScene }: { addScene: MakerAddScene | null }) {
  if (!addScene) return null;
  if (addScene.kind === 'ready') {
    return (
      <button
        type="button"
        data-maker-tool="add"
        data-maker-add-scene=""
        aria-label="Add a scene"
        title="Add a scene"
        onClick={addScene.open}
        className={MAKER_TOOL_BUTTON}
      >
        <Plus aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        <span className={MAKER_TOOL_WORD}>Add</span>
      </button>
    );
  }
  return (
    <ComingNext
      label={addScene.locked ? `Add a scene — ${paidMarkLabel('locked', 'Event Hub Pro')}` : 'Add a scene'}
      note={addScene.note}
      align="start"
      tool="Add"
      dataAttr="refused"
      mark={
        addScene.locked ? (
          <PaidMark state="locked" label={paidMarkLabel('locked', 'Event Hub Pro')} size="xs" />
        ) : null
      }
      link={addScene.locked ? { href: addScene.unlockHref, label: 'See Event Hub Pro' } : null}
    >
      <Plus aria-hidden className="h-5 w-5" strokeWidth={1.75} />
    </ComingNext>
  );
}

export function ComingNext({
  label,
  note,
  align = 'center',
  chip = false,
  small = false,
  itemKey,
  tool,
  mark = null,
  link = null,
  dataAttr,
  children,
}: {
  /** The bar item this chip is (`data-maker-bar-item`). */
  itemKey?: string;
  /** A labelled toolbar button — the word under the icon ("Add"). */
  tool?: string;
  label: string;
  note: string;
  align?: 'center' | 'start' | 'end';
  chip?: boolean;
  small?: boolean;
  /** A mark worn over the icon's corner — the padlock (`PaidMark`) when the note is a Pro refusal. */
  mark?: ReactNode;
  /** A link after the note — the unlock, when the note is a Pro refusal. */
  link?: { href: string; label: string } | null;
  /** The value of `data-maker-add-scene` on the button (the ＋'s tests). */
  dataAttr?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ top: number; left: number; width: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  /* Placed against the VIEWPORT, not the button's box: the bar scrolls
     sideways on a phone, and an `overflow-x: auto` row clips anything that
     hangs below it — the bubble would open invisibly, a dead button again. */
  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(288, window.innerWidth - 32);
    const anchor = align === 'start' ? r.left : align === 'end' ? r.right - width : r.left + r.width / 2 - width / 2;
    setAt({ top: r.bottom + 8, left: Math.max(16, Math.min(anchor, window.innerWidth - width - 16)), width });
  };
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex shrink-0">
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        aria-label={chip ? undefined : label}
        title={chip ? undefined : label}
        data-maker-bar-item={chip ? (itemKey ?? 'prints') : undefined}
        onClick={() => {
          place();
          setOpen((o) => !o);
        }}
        data-maker-tool={tool ? tool.toLowerCase() : undefined}
        data-maker-add-scene={dataAttr}
        className={
          tool
            ? `${MAKER_TOOL_BUTTON} relative`
            : chip
            ? 'sn-press inline-flex min-h-10 items-center gap-1 whitespace-nowrap rounded-full px-3 text-[13.5px] font-semibold text-ink/70 transition-colors duration-sn-control ease-sn hover:bg-ink/5 hover:text-ink md:px-3.5'
            : small
              ? 'sn-press inline-flex h-9 items-center justify-center rounded-full px-2 text-ink/60 transition-colors duration-sn-control ease-sn hover:text-ink'
              : 'sn-press inline-flex h-11 w-11 items-center justify-center rounded-full text-ink/70 transition-colors duration-sn-control ease-sn hover:bg-ink/5 hover:text-ink'
        }
      >
        {children}
        {tool ? <span className={MAKER_TOOL_WORD}>{tool}</span> : null}
        {chip ? <span aria-hidden className="text-[10px] text-ink/45">ⓘ</span> : null}
        {mark ? <span className="absolute right-1 top-1 inline-flex rounded-full bg-cream">{mark}</span> : null}
      </button>
      <span
        role="status"
        hidden={!open || !at}
        style={at ? { position: 'fixed', top: at.top, left: at.left, width: at.width } : undefined}
        className="z-50"
      >
        <span className="sn-tip-body sn-glass-bare block">
          {note}
          {link ? (
            <>
              {' '}
              <Link href={link.href} className="font-semibold text-ink underline underline-offset-2">
                {link.label}
              </Link>
            </>
          ) : null}
        </span>
      </span>
    </span>
  );
}

/**
 * ▾ A LABELLED TOOLBAR MENU — View ▾ and More ▾ (the approved prototype's top
 * bar). A button with its word under the icon; the list opens under it, stays
 * on screen (placed against the viewport, like `ComingNext`), and closes on a
 * pick, a click outside and Escape. `children` is handed `close`.
 */
function ToolMenu({
  label,
  tool,
  icon,
  align = 'start',
  children,
}: {
  label: string;
  tool: string;
  icon: ReactNode;
  align?: 'start' | 'end';
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex shrink-0">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        data-maker-tool={tool}
        onClick={() => {
          const r = btnRef.current?.getBoundingClientRect();
          if (r) {
            const width = Math.min(260, window.innerWidth - 16);
            const left = align === 'end' ? r.right - width : r.left;
            setAt({ top: r.bottom + 6, left: Math.max(8, Math.min(left, window.innerWidth - width - 8)) });
          }
          setOpen((o) => !o);
        }}
        className={MAKER_TOOL_BUTTON}
      >
        {icon}
        <span className={MAKER_TOOL_WORD}>{label}</span>
      </button>
      {open && at ? (
        <span
          role="menu"
          aria-label={label}
          data-maker-tool-menu={tool}
          style={{ position: 'fixed', top: at.top, left: at.left, width: Math.min(260, typeof window === 'undefined' ? 260 : window.innerWidth - 16) }}
          className="z-50 flex max-h-[70dvh] flex-col overflow-y-auto rounded-xl bg-white p-1 ring-1 ring-ink/10 shadow-[0_24px_48px_-20px_rgba(30,26,18,.45)]"
        >
          {children(close)}
        </span>
      ) : null}
    </span>
  );
}

function MenuItem({
  on,
  disabled = false,
  note,
  onClick,
  className = '',
  children,
}: {
  /** A radio item that is the current choice (a tick). */
  on?: boolean;
  disabled?: boolean;
  /** Why it is off, or what it will be — said on the item, never a dead row. */
  note?: string;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role={on === undefined ? 'menuitem' : 'menuitemradio'}
      aria-checked={on === undefined ? undefined : on}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className={`sn-press flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-[14px] text-ink transition-colors duration-sn-control ease-sn hover:bg-ink/5 lg:min-h-9 ${
        disabled ? 'cursor-default text-ink/45 hover:bg-transparent' : ''
      } ${on ? 'font-semibold' : ''} ${className}`}
    >
      <span className="min-w-0 flex-1">
        {children}
        {note ? <small className="block text-[11px] font-normal text-ink/50">{note}</small> : null}
      </span>
      {on ? <Check aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2.4} /> : null}
    </button>
  );
}

/** Set (or add) one hidden field on a form, before React reads it. */
function setHiddenField(form: HTMLFormElement, name: string, value: string) {
  const existing = form.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (existing) {
    existing.value = value;
    return;
  }
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = name;
  input.value = value;
  form.appendChild(input);
}

/** 👁 The "View as a free couple" row — its own component so the router hook
 *  it needs mounts only for an internal viewer, inside the open menu. */
function ViewAsFreeRow({ on, close }: { on: boolean; close: () => void }) {
  const setViewAsFree = useViewAsFreeToggle();
  return (
    <MenuItem on={on} onClick={() => { close(); setViewAsFree(!on); }}>
      <span data-maker-view-as-free-row="">{VIEW_AS_FREE_LABEL}</span>
    </MenuItem>
  );
}

function MenuHeading({ children }: { children: ReactNode }) {
  return <span className="px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink/45">{children}</span>;
}

function MoreSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  /* It says aria-modal, so it manages focus: in, trapped, restored, Esc
     closes (the house `useModalA11y`, `modal-a11y-adoption.test.ts`). */
  const sheetRef = useRef<HTMLElement>(null);
  useModalA11y({ open, onClose, containerRef: sheetRef });
  return (
    <div hidden={!open} className="absolute inset-0 z-40">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-ink/25 backdrop-blur-[2px]"
      />
      <aside
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Your Event Hub"
        className="sn-glass-bare absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-cream p-4 md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[min(560px,92vw)] md:rounded-none md:p-6"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="font-serif text-xl text-ink">Your Event Hub</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="sn-press inline-flex h-11 w-11 items-center justify-center rounded-full text-ink/70 hover:bg-ink/5 hover:text-ink"
          >
            <X aria-hidden className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}

/**
 * 🧭 A selection of a page that moved into Details (DECISION_LOG 2026-09-28
 * "OPTION B — EVERYTHING MADE ONCE LIVES IN DETAILS") is Details, open on that
 * page's item — so every door that still says `{ kind: 'tool', key: 'hero' }`
 * (a scene's "Open the hero", an old address, the tab's memory) lands there.
 * A page whose item has not landed yet (`movedPageItem` → null) opens as before.
 */
function movedSelection(next: MakerSelection): { selection: MakerSelection; item: DetailsItemKey | null } {
  const item = next?.kind === 'tool' ? movedPageItem(next.key) : null;
  return item ? { selection: { kind: 'tool', key: 'details' }, item } : { selection: next, item: null };
}
