'use client';

import { formatCount } from '@/lib/format-number';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { detailsItemLayout, detailsLtSection, groupOfItemSafe, type DetailsItemKey, type DetailsItemModel } from '@/lib/maker-details-items';
import {
  GUIDE_PARAM,
  backScreen,
  firstOpenScreen,
  guideParamOf,
  nextScreen,
  roundName,
  skipScreen,
  startScreen,
  stepOf,
  stepOfItem,
  type GuidedRound,
  type GuidedScreen,
  type GuidedStepKey,
} from '@/lib/details-guided-flow';
import { setupProgress } from '@/lib/stage-setup';
import type { DetailsGuide } from './details-guide';
/* The flow's top line and its door are drawn before any step; a step's own
   heading, foot and the Ready screens load with the Details pieces (\`details-lazy.tsx\`). */
import { GuideTop, WhatsLeftDoor, hasUnsavedEdits } from './details-guide-top';
import type { PrintField } from '@/lib/print-layout';
import { DetailsTapContext, PRINT_FIELD_INPUT } from './details-tap';
import { DetailsPieceContext, DetailsSelectContext, type DetailsPieces } from './details-go';
import { useSameFieldDoors } from './same-field';
import { MAKER_TOUCH_EVENT, leaveAsks, newStepTouch, noteStepTouch, touchOrigin, type StepTouch } from '@/lib/guided-step-touch';
import { BeforeWeStartScreen, GuideFoot, GuideHead, GuideLinkScreen, GuideReady, StagePicker, StageStepPreview, StepBackground } from './details-lazy';
import { GUIDED_FLOW_TITLE, guidedStepBody } from '@/lib/guided-step-layout';
import { MAKER_LT_TOOL } from '@/lib/maker-phone-room';
import { MakerHalfSheet } from './maker-sheet';
import { useMaker, useMakerTool } from './maker-context';
import { IntoLowerThird, LOWER_THIRD_TILE, LOWER_THIRD_TILE_ON, LOWER_THIRD_TILE_PART, LOWER_THIRD_TILE_PLAIN } from './maker-lower-third';
import { SheetSections } from './sheet-sections';

/** `DetailsItemModel` (`lib/maker-details-items.ts`) plus its small picture. */
export type DetailsNavItem = DetailsItemModel & {
  /** A small picture or glyph — never a live render (the list is not a gallery). */
  icon: ReactNode;
  /** What the right part IS, when it is not "the editor" — the seat plan's right part is its guests. */
  panelLabel?: string;
};

export type DetailsNavGroup = {
  key: string;
  label: string;
  items: DetailsNavItem[];
  /** 🗂 ONE row in the list ("Your event"); picking it shows every item's editor, one under the other (owner 2026-10-06). */
  form?: true;
  /** Present (the guided flow and old addresses open them) but never a row of the list. */
  hidden?: true;
};

/**
 * 🗂 THE LIST AS IT IS DRAWN (owner 2026-10-06, "EVENT DETAILS IS REBUILT"): a
 * hidden group draws no rows; a form group draws ONE row — named by the group,
 * keyed by the item showing (else its first), so a press keeps the field in view.
 * Pure, so a test holds it.
 */
export function detailsListGroups(groups: readonly DetailsNavGroup[], selected: DetailsItemKey): DetailsNavGroup[] {
  return groups
    .filter((g) => !g.hidden && g.items.length > 0)
    .map((g) => {
      if (!g.form) return g;
      const on = g.items.find((i) => i.key === selected) ?? g.items[0]!;
      const row: DetailsNavItem = {
        key: on.key,
        group: g.items[0]!.group,
        label: g.label,
        sub: g.items.map((i) => i.label).join(' · '),
        icon: g.items[0]!.icon,
        ...(g.items.every((i) => i.done !== undefined) ? { done: g.items.every((i) => i.done) } : {}),
      };
      return { ...g, items: [row] };
    });
}

/** The form group an item belongs to, or null. */
export function formGroupOf(groups: readonly DetailsNavGroup[], key: DetailsItemKey): DetailsNavGroup | null {
  return groups.find((g) => g.form && g.items.some((i) => i.key === key)) ?? null;
}

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
 *
 * 📱 ON A PHONE THE PAGE IS THE SCREEN (owner, live iPhone test 2026-10-02:
 * *"this is too clumped … dim the negative space so they know it is a pop up and
 * pressing on the dimmed part will go back to the main screen"*; the approved
 * phone layout, frames G/I of `prototypes/maker_in_four_2026-09-30_fable.html`).
 * Under `lg` the body fills everything between the Maker's two bars, and:
 *   · 🧰 since 2026-10-05 (the owner's lower third) the items are the Maker's
 *     lower-third NAVIGATOR's tiles and the picked item's editor is a TOOL of
 *     the lower third (`MAKER_LT_TOOL`, `useMakerTool`) — never a sheet over
 *     the page. Its one header row is ONE dropdown — the other items here and
 *     the item's own sections;
 *   · the guided flow's progress ("Finish · 9 of 20") is ONE button in the
 *     sheet's header — never a chip floating over the page — and opens "Which
 *     stage do you want ready?"; in the flow it is the step sheet's own ▾ line.
 * One sheet at a time; nothing is dimmed while none is open. The desktop is
 * unchanged: navigator left, body, editor right, the flow's line and foot.
 *
 * 🗂 SETUP BY STAGE (PR-2, owner 2026-10-04 — `lib/stage-setup.ts`): the flow
 * opens on "Which stage do you want ready?" (`StagePicker`), then that stage's
 * Before we start (`BeforeWeStartScreen`, the first time), then its steps — and
 * a step on a phone is the HALF SHEET over the live page (`MakerHalfSheet`, the
 * shape every Maker sheet mounts into): ONE slim header — the step's ▾ (All
 * items inside it) · Peek · × (owner, live iPhone test 2026-10-05) — the SAME
 * editor the item always draws (on the item's one section where the step is
 * one — RSVP's "Reply by"), Back · Skip · Next at its foot; each step opens at
 * half, and Peek and the slim bar work as everywhere. The picker, Before we start and Ready are screens of the
 * flow like Ready always was — the items step aside, hidden, never unmounted.
 * Opening any of them writes nothing.
 */
/** A step's own ground — its items' editors and bodies; never the sheet's head or foot. */
function stepScopesOf(root: Element | null, items: readonly string[]): Element[] {
  if (!root) return [];
  return items.flatMap((k) =>
    [root.querySelector(`[data-details-editor="${k}"]`), root.querySelector(`[data-details-body-item="${k}"]`)].filter(
      (el): el is Element => el !== null,
    ),
  );
}

export function DetailsWorkspace({
  groups,
  bodies,
  editors,
  initial,
  persistent = null,
  pieces = {},
  guide = null,
  coverUrl = null,
  bodyAlias = {},
  formHeads = {},
}: {
  /**
   * 🗂 A form's group headings (the new Maker's Studio, prototype `.gh`): the item a
   * group of the one scrolling form starts at → its small-capital heading and the
   * small line on its right ("Your event · saves as you type"). Drawn above that
   * item's field, inside the form only.
   */
  formHeads?: Partial<Record<DetailsItemKey, { title: string; line?: string }>>;
  /**
   * 🖼 Items that SHARE another item's picture (owner 2026-10-06: Background ·
   * Colours · Font · Music each show the couple's own page — ONE frame, the
   * whole Look's, never four). Key → the item whose body it shows.
   */
  bodyAlias?: Partial<Record<DetailsItemKey, DetailsItemKey>>;
  /** 🖼 The couple's cover photo (drafted over live, signed) — what the cover step shows behind its sheet. */
  coverUrl?: string | null;
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
  /* 🗂 A door that names an item this event does not draw (a birthday's Love
     Story) lands on the first item of that item's group that it does. */
  const asked = (() => {
    const k = maker?.detailsItem;
    if (!k) return null;
    if (items.some((i) => i.key === k)) return k;
    const g = groups.find((x) => x.key === groupOfItemSafe(k));
    return g && !g.hidden ? (g.items[0]?.key ?? null) : null;
  })();
  const [own, setOwn] = useState<DetailsItemKey>(first);
  const selected = asked ?? own;
  const [visited, setVisited] = useState<ReadonlySet<DetailsItemKey>>(() => new Set([first]));
  const tellMaker = maker?.setDetailsItem;
  /* 🪜 In the flow the step's fields show at once — the editor opens on a phone. */
  /* 📱 The editor sheet: opened by a door (`MakerState.detailsDoor`), a tap on the
     page, the Edit chip, or a step picked — never on its own (the page shows clean). */
  const door = maker?.detailsDoor ?? 0;
  /* In the lower third (a phone) a mount never opens the tool: Theme · Details ·
     Prints land on their navigator, and only a door pressed WHILE mounted opens it. */
  const [sheetOpen, setSheetOpen] = useState(() => door > 0 && !maker?.lowerThird);
  const lastDoor = useRef(door);
  useEffect(() => {
    if (door === lastDoor.current) return;
    lastDoor.current = door;
    setSheetOpen(true);
  }, [door]);
  /* The piece picked under each item (the three columns meet here). */
  const [pieceMap, setPieceMap] = useState<Partial<Record<DetailsItemKey, string | null>>>({});
  /* 📱 The sections' names, as each item's list says them — the sheet's dropdown reads "What you ask ▾". */
  const [pieceLabels, setPieceLabels] = useState<Partial<Record<DetailsItemKey, Record<string, string>>>>({});
  const pieceCtx = useMemo<DetailsPieces>(
    () => ({
      piece: (item) => pieceMap[item] ?? null,
      setPiece: (item, piece, opts) => {
        setPieceMap((m) => (m[item] === piece ? m : { ...m, [item]: piece }));
        if (piece && opts?.openEditor) setSheetOpen(true);
      },
      openEditor: () => setSheetOpen(true),
      noteLabels: (item, labels) =>
        setPieceLabels((m) => (JSON.stringify(m[item]) === JSON.stringify(labels) ? m : { ...m, [item]: labels })),
    }),
    [pieceMap],
  );
  /* 🎨 LOOK IS ITS PANEL (owner 2026-10-02, `lib/maker-look-sections.ts`): opening
     Look opens its panel — never a closed handle reading "Theme" alone. In the
     Maker's lower third (a phone, 2026-10-05) Theme lands on its NAVIGATOR like
     every pick, and the Theme tile opens the panel. */
  useEffect(() => {
    if (selected === 'theme' && !window.matchMedia('(max-width: 1023.98px)').matches) setSheetOpen(true);
  }, [selected]);
  /* 🚶 THE MARCH'S LOWER THIRD IS ITS "NOT WALKING" TRAY (owner, live iPhone
     2026-10-06: *"we want a scroll-less screen there. Just show screen for those
     not added or will not walk the isle"*): opening the Wedding March opens its
     tray where the navigator was — the one exception to "a mount lands on the
     navigator", because the tray is half of the march, not a separate editor. */
  const marchHere = selected === 'march';
  useEffect(() => {
    if (marchHere) setSheetOpen(true);
  }, [marchHere]);
  /* 🧭 STUDIO › LOOK (the new Maker, prototype `.lt .look`): Look opens straight on its controls —
     ONE full-width bar, Background · Colours · Fonts · Music (`StudioLookBar`), over the page — never
     a row of tall tiles to pick from first (side-by-side M29, owner 2026-10-07). */
  const studioLook = maker?.stagesStudio === true && detailsLtSection(selected) === 'look';
  useEffect(() => {
    if (studioLook) setSheetOpen(true);
  }, [studioLook]);
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

  /* ══ 🪜 THE GUIDED FLOW — BY STAGE (PR-2) ══ */
  const plan = guide && guide.plan.steps.length > 0 ? guide.plan : null;
  const entry = plan && guide?.open ? guide.entry : null;
  const [mode, setMode] = useState<'guided' | 'all'>(plan && guide?.open ? 'guided' : 'all');
  /** A screen of the flow that is not a step — the stage picker, a Before we start, a Ready screen. */
  const [pane, setPane] = useState<Exclude<GuidedScreen, { kind: 'step' }> | null>(entry && entry.kind !== 'step' ? entry : null);
  /** The stage being walked — a step two stages share is walked as part of this one. */
  const [walk, setWalk] = useState<GuidedRound | null>(entry && entry.kind !== 'stages' ? entry.round : null);
  /** The step picked — an item can carry several (RSVP's three settings), so the item alone cannot say. */
  const [stepKey, setStepKey] = useState<GuidedStepKey | null>(entry?.kind === 'step' ? entry.step : null);
  /** Next (or any move) found unsaved typing here: where it was going. */
  const [unsavedTo, setUnsavedTo] = useState<GuidedScreen | null>(null);
  /* 🎨 LOOK OPENS THE LOOK TOOLS (owner 2026-10-05: a press of Look landed on
     the guided flow's stage list). Each opening of Look is counted by the Maker
     (`lookVisit`) and ANSWERED ONCE (`takeLookVisit` — a later mount of this
     page, through Details or a jump, never replays it): this visit leaves the
     flow's screens for the Look item. Not remembered: the next door into the
     flow still opens it. */
  const lookVisit = maker?.lookVisit ?? 0;
  const takeLookVisit = maker?.takeLookVisit;
  useEffect(() => {
    if (!lookVisit || !takeLookVisit?.(lookVisit)) return;
    setMode('all');
    setPane(null);
    setUnsavedTo(null);
  }, [lookVisit, takeLookVisit]);
  /* 🗓 A DOOR THAT NAMES ONE ITEM OPENS THAT ITEM (owner 2026-10-06, a tapped
     schedule moment landed on "Which stage do you want ready?"): this page mounts
     fresh for it, on the flow's screen the server chose for a plain landing — so
     the visit (`openDetailsItem`, answered once) leaves the flow for the item. */
  const itemVisit = maker?.itemVisit ?? 0;
  const takeItemVisit = maker?.takeItemVisit;
  useEffect(() => {
    if (!itemVisit || !takeItemVisit?.(itemVisit)) return;
    setMode('all');
    setPane(null);
    setUnsavedTo(null);
  }, [itemVisit, takeItemVisit]);
  const pickedStep = plan && stepKey ? stepOf(plan, stepKey) : null;
  const pieceHere = pieceMap[selected] ?? null;
  const stepHere = plan
    ? pickedStep && pickedStep.items.includes(selected) && (!pickedStep.piece || pieceHere === null || pieceHere === pickedStep.piece)
      ? pickedStep
      : stepOfItem(plan, selected, walk, pieceHere)
    : null;
  const onPane = mode === 'guided' && plan !== null && pane !== null;
  const guidedOn = mode === 'guided' && plan !== null && (onPane || stepHere !== null);
  const walking: GuidedRound | null = stepHere ? (walk && stepHere.stages.includes(walk) ? walk : stepHere.stages[0]!) : null;
  const at: GuidedScreen | null = !guidedOn ? null : onPane ? pane : { kind: 'step', step: stepHere!.key, round: walking! };
  const guideAddr = at ? guideParamOf(at) : null;
  /* 🖼 ONE STEP LAYOUT (owner 2026-10-05, `lib/guided-step-layout.ts`): behind
     every step's sheet, on a phone, what the STAGE produces — its page, at the
     part the step fills — unless the step's subject exists only in its own tool. */
  const stepBody = at?.kind === 'step' && stepHere ? guidedStepBody(stepHere.key, at.round) : null;
  const stagePreviewed = stepBody !== null && stepBody.kind !== 'own';
  /* 🏷 ONE TITLE PER STAGE on the Maker's bar while the flow is on screen —
     the stage being walked; the flow's own name on the stage picker. */
  const setGuideTitle = maker?.setGuideTitle;
  const guideTitle = !at || !plan ? null : at.kind === 'stages' ? GUIDED_FLOW_TITLE : roundName(plan, at.round);
  useEffect(() => {
    setGuideTitle?.(guideTitle);
  }, [setGuideTitle, guideTitle]);
  useEffect(() => () => setGuideTitle?.(null), [setGuideTitle]);
  /* 🧰 THE GUIDE OWNS THE LOWER THIRD (owner 2026-10-05, live at 375: the stage
     picker on the page AND Theme's navigator below it — two things at once).
     While the flow shows a screen of its own (the picker, Before we start, a
     Ready screen) the lower third draws nothing of an item's: only the menu. */
  const setGuideBare = maker?.setGuideBare;
  const guideBare = at !== null && at.kind !== 'step';
  useEffect(() => {
    setGuideBare?.(guideBare);
  }, [setGuideBare, guideBare]);
  useEffect(() => () => setGuideBare?.(false), [setGuideBare]);
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
  /* A door elsewhere in the Maker that opens another item leaves the flow's other screens. */
  const lastAsked = useRef(asked);
  useEffect(() => {
    if (asked && asked !== lastAsked.current && asked !== own) setPane(null);
    lastAsked.current = asked;
  }, [asked, own]);

  /* 📋 "Before we start" shows the first time a stage is picked (approved frame 0:
     "once"), then a pick goes straight to the steps — remembered on this phone
     only (a convenience, never data: lost, it simply shows once more). */
  const beforeKey = (r: GuidedRound) => (maker?.eventId ? `sn-before-seen:${maker.eventId}:${r}` : null);
  const beforeSeen = (r: GuidedRound): boolean => {
    const k = beforeKey(r);
    try {
      return k !== null && window.localStorage.getItem(k) === '1';
    } catch {
      return false;
    }
  };

  const goTo = (to: GuidedScreen) => {
    setUnsavedTo(null);
    if (!plan) return;
    if (to.kind !== 'step') {
      setPane(to);
      if (to.kind !== 'stages') setWalk(to.round);
      return;
    }
    const step = stepOf(plan, to.step);
    if (!step) return;
    setPane(null);
    setWalk(to.round);
    setStepKey(step.key);
    const item = step.items.includes(selected) ? selected : (step.left[0] ?? step.items[0]!);
    select(item);
    /* 🧩 A step that is one section of its item (RSVP's "Reply by") opens on that section. */
    const piece = step.piece;
    if (piece) setPieceMap((m) => (m[item] === piece ? m : { ...m, [item]: piece }));
    setSheetOpen(true);
  };
  /* ✍ What the couple changed on THIS step (`lib/guided-step-touch.ts`): a
     keystroke or pick in a field (remembered by name, so a remount is the same
     field), a press on a control that is a choice (the one dropdown's options
     included — `touchOrigin`), or a picker's own announcement — only inside the
     step's own item, never its head or foot. */
  const touchRef = useRef<StepTouch>(newStepTouch());
  const touchedStep = at?.kind === 'step' ? `${at.round}:${at.step}` : null;
  const stepItems = stepHere ? stepHere.items.join(' ') : '';
  useEffect(() => {
    touchRef.current = newStepTouch();
    if (!touchedStep) return;
    const items = stepItems.split(' ').filter(Boolean);
    const note = (e: Event) => {
      // A pick in the one dropdown's list (portalled to <body>) is its button's.
      const t = touchOrigin(e.target, document);
      if (!(t instanceof Node)) return;
      // A control that writes live (the March order, Reply by) is saved as it changes — never a change to ask about.
      noteStepTouch(touchRef.current, e, t, stepScopesOf(rootRef.current, items).find((sc) => sc.contains(t)) ?? null);
    };
    const kinds = ['input', 'change', 'click', MAKER_TOUCH_EVENT];
    for (const k of kinds) document.addEventListener(k, note, true);
    return () => {
      for (const k of kinds) document.removeEventListener(k, note, true);
    };
  }, [touchedStep, stepItems]);
  const [askKind, setAskKind] = useState<'unsaved' | 'skip'>('unsaved');
  /** Every move away from a step first asks: is there a change here that is not saved — or, on Skip, any change at all? */
  const move = (to: GuidedScreen | null, via: 'skip' | 'next' | 'back' | 'pick' = 'pick') => {
    if (!to) return;
    if (at?.kind === 'step' && stepHere) {
      const asks = leaveAsks({ via, unsaved: hasUnsavedEdits(stepScopesOf(rootRef.current, stepHere.items), touchRef.current.fields), touched: touchRef.current.any });
      if (asks) {
        // The question is asked at the step's own foot, in its sheet.
        setAskKind(asks);
        setUnsavedTo(to);
        return;
      }
    }
    goTo(to);
  };
  /** A stage picked: its Before we start the first time, else its first step still to do. */
  const pickStage = (r: GuidedRound) => {
    if (!plan) return;
    goTo(startScreen(plan, r, beforeSeen(r)));
  };
  /** "I'm ready" · "Start anyway": past Before we start, to the stage's first step still to do. */
  const startStage = (r: GuidedRound) => {
    if (!plan) return;
    const k = beforeKey(r);
    try {
      if (k) window.localStorage.setItem(k, '1');
    } catch {
      /* it shows once more next time — nothing else depends on it */
    }
    goTo(firstOpenScreen(plan, r));
  };
  /** Every door into the flow opens "Which stage do you want ready?". */
  const openGuide = () => {
    if (!plan) return;
    setMode('guided');
    remember('guided');
    goTo({ kind: 'stages' });
  };
  const allItems = () => {
    setMode('all');
    setPane(null);
    setUnsavedTo(null);
    remember('all');
  };
  const whatsLeftLine = (() => {
    if (!plan) return '';
    const w = setupProgress(plan);
    return w.next ? `Finish · ${formatCount(w.done)} of ${formatCount(w.total)}` : 'All set';
  })();
  /* The navigator, narrowed in the flow to the step's own items (and their pieces). */
  const navGroups: DetailsNavGroup[] =
    guidedOn && stepHere
      ? [{ key: 'step', label: stepHere.title, items: items.filter((i) => stepHere.items.includes(i.key)) }]
      : detailsListGroups(groups, selected);
  /* 🗂 "Your event" is ONE form (owner 2026-10-06): in the list, its items' editors show one under the other. */
  const formGroup = guidedOn ? null : formGroupOf(groups, selected);
  const formKeys: ReadonlySet<DetailsItemKey> = new Set(formGroup?.items.map((i) => i.key) ?? []);
  const showsEditor = (k: DetailsItemKey) => k === selected || formKeys.has(k);
  const shownLabel = formGroup?.label ?? current.label;
  const bodyOf = (k: DetailsItemKey): DetailsItemKey => bodyAlias[k] ?? k;
  const bodyShown = (k: DetailsItemKey) => bodyOf(selected) === k;
  /* The shared picture is named by the item showing ("Colours"), never its owner's ("Look"). */
  const bodyLabel = (i: DetailsNavItem) => (i.key === selected ? i.label : current.label);
  const showNav = !guidedOn || (!onPane && (navGroups[0]!.items.length > 1 || Boolean(pieces[selected])));
  /* 📱 In the flow the editor is the step's HALF SHEET (`MakerHalfSheet`); in All items, the sheet over the dimmed page. */
  const stepSheet = mode === 'guided' && plan !== null;

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
      /* 🔑 `null`, NEVER `window.history.state` (owner 2026-10-06: Auto arrange
         landed on "Which stage do you want ready?"). Next's own entry carries
         `__NA`, and Next IGNORES a replaceState that carries it — so the router
         kept the landing address (`/launch`, no item) while the bar showed this
         one: every save re-rendered the page AT THE LANDING (the address bar
         snapped back to it) and the next reload or remount opened the flow's
         stage list. With `null` Next hears the address (it copies its own
         state in) and a save, a refresh or a reload stays on this item. */
      window.history.replaceState(null, '', url);
    } catch {
      /* the address is a convenience; the page works without it */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `maker` changes on every Maker render; only the item matters
  }, [selected, tellMaker, guideAddr]);
  const layout = detailsItemLayout(selected);

  /* 🧰 THE LOWER THIRD (phone, owner 2026-10-05): this page's items are its
     NAVIGATOR's tiles — Look's under Theme, the prints under Settings › Prints,
     the rest under Details — and the picked item's editor is its TOOL. */
  const allItemsSheet = sheetOpen && !(mode === 'guided' && plan !== null) && layout !== 'whole';
  useMakerTool(allItemsSheet, {
    key: `details:${selected}`,
    name: shownLabel,
    close: () => setSheetOpen(false),
  });
  const setLtWhere = maker?.setLtWhere;
  useEffect(() => {
    setLtWhere?.(shownLabel);
  }, [setLtWhere, shownLabel]);
  useEffect(() => () => setLtWhere?.(null), [setLtWhere]);
  /* The navigator lists the items of the picked item's part of the list (Look's,
     Story & plans', Your event's one form, the prints) — a jump to another item
     (a Look tile → the address) moves the lower third's pick with it. */
  const ltNav = maker?.ltNav ?? null;
  const ltSection = (k: DetailsItemKey) => detailsLtSection(k);
  const here = ltSection(selected);
  const ltTiles = ltNav && !studioLook ? (
    <IntoLowerThird to={ltNav}>
          {detailsListGroups(groups, selected)
            .flatMap((g) => g.items)
            .filter((i) => ltSection(i.key) === here)
            .map((i) => {
              const on = i.key === selected || (formKeys.has(i.key) && formKeys.has(selected));
              return (
              <button
                key={i.key}
                type="button"
                data-lt-tile={`details:${i.key}`}
                data-lt-group="details"
                aria-pressed={on}
                onClick={() => {
                  select(i.key);
                  setSheetOpen(true);
                }}
                className={`${LOWER_THIRD_TILE} ${LOWER_THIRD_TILE_PLAIN} ${on ? LOWER_THIRD_TILE_ON : ''}`}
              >
                <span className="relative flex min-h-0 flex-1 items-center justify-center text-ink/75">
                  <span className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-cream ring-1 ring-ink/10">{i.icon}</span>
                  {i.done ? (
                    <span aria-label="Done" className="absolute right-2 top-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-success-700 text-white">
                      <Check aria-hidden className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                  ) : null}
                </span>
                <span className="block w-full truncate border-t border-ink/10 px-1 py-1.5 text-center text-[11.5px] font-semibold text-ink">{i.label}</span>
              </button>
              );
            })}
    </IntoLowerThird>
  ) : null;

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

  /* 🗂 A door that names one field of the Your event form (an old `?item=date`, a
     fact tapped on a stage) brings THAT field into view — by scrolling the
     editor column only, never `scrollIntoView` (it would scroll the Maker too). */
  const formAt = formGroup ? selected : null;
  useEffect(() => {
    if (!formAt || !sheetOpenOrDesk()) return;
    const id = window.requestAnimationFrame(() => {
      const box = editorRef.current;
      const el = box?.querySelector<HTMLElement>(`[data-details-editor="${formAt}"]`);
      if (!box || !el) return;
      box.scrollTop += el.getBoundingClientRect().top - box.getBoundingClientRect().top - 8;
    });
    return () => window.cancelAnimationFrame(id);
  }, [formAt, sheetOpen]);

  /** Every item's editor — all mounted, the picked one shown (`hidden` never unmounts: a hidden field still posts). */
  const editorsBody = (whole: boolean) => (
    <div
      ref={editorRef}
      hidden={whole}
      className={`min-h-0 flex-1 overscroll-contain ${
        /* 🚶 The march's tray never scrolls: it fills the room and fits its names to it. */
        marchHere ? 'flex flex-col overflow-hidden px-2 pb-2 pt-1 lg:px-3 lg:pt-3' : 'overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2'
      } ${whole ? 'hidden' : stepSheet || sheetOpen ? '' : 'hidden lg:block'}`}
    >
      {items.map((i) => (
        <div
          key={i.key}
          hidden={!showsEditor(i.key)}
          data-details-editor={i.key}
          data-details-form-field={formKeys.has(i.key) ? '' : undefined}
          className={!showsEditor(i.key) ? 'hidden' : i.key === 'march' ? 'flex min-h-0 flex-1 flex-col' : `flex flex-col gap-3${formKeys.has(i.key) && i.key !== formGroup?.items[0]?.key ? ' border-t border-ink/10 pt-4' : ''}`}
        >
          {formKeys.has(i.key) && formHeads[i.key] ? (
            <p data-details-form-group={i.key} className="flex items-baseline gap-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/55">
              {formHeads[i.key]!.title}
              {formHeads[i.key]!.line ? <small className="ml-auto text-[11px] font-medium normal-case tracking-normal text-ink/50">{formHeads[i.key]!.line}</small> : null}
            </p>
          ) : null}
          {/* 🗂 In the Your event form each field is named — the list's row is the form's. */}
          {formKeys.has(i.key) ? <h3 className="text-[15px] font-semibold text-ink" data-details-form-heading={i.key}>{i.label}</h3> : null}
          {/* A server-made editor arrives as a lazy client reference — keyed, so it is
              never an unkeyed child beside the cover step's background (React's key check;
              the dev badge's "1 Issue" on every Maker screen, 2026-10-05). */}
          <Fragment key="editor">{editors[i.key] ?? null}</Fragment>
          {/* 🖼 The cover step's background (B6) — Look › Background's own row, in place. */}
          {i.key === 'hero' && at?.kind === 'step' && stepHere?.key === 'hero' ? <StepBackground /> : null}
        </div>
      ))}
      <Fragment key="persistent">{persistent}</Fragment>
    </div>
  );

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
        /* `group/ws`: a tool drawn inside (the Logo studio) dresses itself for the flow — `group-data-[details-mode=guided]/ws:`. */
        className="group/ws flex h-full min-h-0 w-full flex-1 flex-col"
      >
      {plan && at ? <GuideTop plan={plan} at={at} onPick={(to) => move(to)} onAllItems={allItems} tour={guide?.tour ?? null} /> : null}
      <div
        data-details-row=""
        /* On the flow's other screens (the stage picker, Before we start, a
           Ready screen) the items step aside — hidden, never unmounted, so every
           editor's fields still post. */
        hidden={onPane}
        className={`${onPane ? 'hidden' : 'flex'} min-h-0 w-full flex-1 flex-col lg:flex-row`}
      >
        {/* ══ BODY — the picked item's picture (or, for a page that moved in, the page) ══ */}
        <section
          aria-label={`${current.label} — preview`}
          data-details-body=""
          className={`relative order-1 flex min-h-0 flex-1 flex-col overscroll-contain bg-[radial-gradient(120%_90%_at_50%_0%,rgba(203,167,102,.10),transparent_60%)] lg:order-2 ${
            layout === 'flow' ? 'overflow-y-auto px-4 py-5 sm:px-6' : 'overflow-hidden'
          } ${stagePreviewed ? 'max-lg:overflow-hidden max-lg:p-0' : ''}`}
        >
          {/* 🖼 Behind a step's sheet on a phone: the stage's own page (or the cover).
              The items' own pictures step aside — hidden, never unmounted. The
              frame ends where the sheet begins, so the part shown is never under it. */}
          {stagePreviewed && stepBody ? (
            /* The page ends where the lower third begins — the step's tool is IN it, never over the page. */
            <div className="flex min-h-0 flex-1 flex-col lg:hidden" data-guided-step-preview={stepBody.kind}>
              <StageStepPreview body={stepBody} coverUrl={coverUrl} />
            </div>
          ) : null}
          {/* 📱 The editor opens from the lower third's tiles — no chip floats over the page. */}
          <div
            className={`${layout === 'flow' ? 'mx-auto flex w-full max-w-4xl flex-col gap-4' : 'flex min-h-0 flex-1 flex-col'} ${stagePreviewed ? 'max-lg:hidden' : ''}`}
          >
            {items.filter((i) => !bodyAlias[i.key]).map((i) =>
              [...visited].some((v) => bodyOf(v) === i.key) || bodyShown(i.key) ? (
                <div
                  key={i.key}
                  hidden={!bodyShown(i.key)}
                  data-details-body-item={i.key}
                  /* 🔑 `hidden` AND no display class when hidden: Tailwind's `flex` beats
                     the attribute's display:none, and every item would show at once. */
                  className={
                    !bodyShown(i.key) ? 'hidden' : detailsItemLayout(i.key) === 'flow' ? 'flex flex-col gap-4' : 'flex min-h-0 flex-1 flex-col'
                  }
                >
                  {guidedOn && stepHere && bodyShown(i.key) ? (
                    /* 🪜 In the flow: the step's round, its name, where it shows — plain words.
                       📱 On a phone these live only in the guide's sheet. */
                    <div data-details-guide-head-wrap="" className="hidden lg:contents">
                      <GuideHead step={stepHere} roundTitle={roundName(plan!, walking!)} itemLabel={bodyLabel(i)} compact={detailsItemLayout(i.key) !== 'flow'} />
                    </div>
                  ) : detailsItemLayout(i.key) === 'flow' ? (
                    <header className="flex flex-col gap-0.5">
                      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
                        {groups.find((g) => g.items.some((x) => x.key === i.key))?.label}
                      </p>
                      <h2 className="font-serif text-2xl text-ink">{bodyLabel(i)}</h2>
                      {i.usedOn?.length ? (
                        <p className="text-xs text-ink/60" data-details-used-on={i.key}>
                          Used on {i.usedOn.join(' · ')}
                        </p>
                      ) : null}
                    </header>
                  ) : (
                    /* A page that moved in keeps its room: one line, not a masthead. */
                    <header className="flex shrink-0 flex-wrap items-baseline gap-x-2 px-4 pb-1 pt-2.5 sm:px-6">
                      <h2 className="font-serif text-lg text-ink">{bodyLabel(i)}</h2>
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
                  {/* 🚶 THE GUIDED FLOW GOES ON FROM THE END OF THE MARCH (phone): its lower
                      third is the tray, so Back · Skip for now · Next sit after the last walk —
                      scrolled to, never over the names. The desk keeps its foot below. */}
                  {i.key === 'march' && plan && at?.kind === 'step' && i.key === selected ? (
                    <div data-march-guide-foot="" className="mt-2 lg:hidden">
                      <GuideFoot
                        onBack={backScreen(plan, at) ? () => move(backScreen(plan, at), 'back') : null}
                        onSkip={skipScreen(plan, at) ? () => move(skipScreen(plan, at), 'skip') : null}
                        onNext={nextScreen(plan, at) ? () => move(nextScreen(plan, at), 'next') : null}
                        warning={unsavedTo !== null ? askKind : null}
                        onKeepEditing={() => setUnsavedTo(null)}
                        onGoAnyway={() => unsavedTo && goTo(unsavedTo)}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null,
            )}
          </div>
        </section>

        {/* ══ LEFT — the navigator (a sideways strip on a phone) ══ */}
        {showNav ? (
        <nav
          aria-label="Details — what to edit"
          data-phone-chrome="strip"
          /* 📱 Not on a phone: its items and an item's sections are the editor sheet's ONE dropdown there. */
          className="order-2 shrink-0 border-t border-ink/10 bg-cream/80 max-lg:hidden lg:order-1 lg:w-[236px] lg:border-r lg:border-t-0"
        >
          <ol
            ref={navRef}
            className="flex gap-1.5 overflow-x-auto px-3 py-2 [scrollbar-width:none] max-lg:py-1.5 lg:h-full lg:flex-col lg:gap-0.5 lg:overflow-y-auto lg:overflow-x-hidden lg:py-4"
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
                          /* ⚡ An item's picture is already warm: the Maker preloads every
                             tool once it is idle (`maker-tools.tsx`) — one mechanism, no
                             per-row hover fetch. */
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
                            <span className="line-clamp-1 text-[11.5px] font-medium leading-tight lg:truncate lg:text-[13.5px]">{i.label}</span>
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
        {stepSheet ? (
          /* 🪜 IN THE FLOW: the step's HALF SHEET over the live page (PR-2) — the
             step ▾ and its line, the item's own editor, Back · Skip · Next. On a
             desk it is the column beside the page, exactly as before. */
          <MakerHalfSheet
            label="What’s left"
            title={stepHere?.title ?? current.panelLabel ?? current.label}
            target={stepHere?.key ?? selected}
            section={walking ? roundName(plan!, walking) : null}
            onClose={() => move({ kind: 'stages' })}
            /* 📱 ONE slim header (owner, live iPhone test 2026-10-05): the step ▾ —
               "Save the Date · 3 of 6 ▾", All items inside it — · Peek · ×. No
               second line, no stage eyebrow, no repeated title. */
            /* 🚶 Never over the march's tray (owner: no "Invitation · 9 of 12" there). */
            head={at?.kind === 'step' && stepHere && !marchHere ? <GuideTop plan={plan!} at={at} onPick={(to) => move(to)} onAllItems={allItems} inSheet /> : null}
            /* Each step opens at half — a sheet dragged up comes back down on Next. */
            restOn={stepHere?.key ?? null}
            /* 🧰 Only a STEP's sheet is drawn in the lower third (the picker, Before
               we start and a Ready screen draw none — see below), so only a step
               folds it: never a column naming a tool that is not on screen. */
            tool={at?.kind === 'step'}
            /* A desk keeps its column; with no step open (the picker, Before we start,
               a Ready screen) the sheet is not drawn on a phone either — its editors
               stay mounted under it. */
            desktopClassName={`lg:static lg:z-auto lg:order-3 lg:h-auto lg:max-h-none lg:w-[360px] lg:shrink-0 lg:rounded-none lg:border-l lg:border-ink/10 lg:bg-cream lg:shadow-none ${
              layout === 'whole' ? 'lg:hidden' : ''
            } ${at?.kind === 'step' ? '' : 'max-lg:hidden'}`}
          >
            {/* ONE layout for every step (`lib/guided-step-layout.ts`): the header row
                above, then the step's field, then its foot — no rows between. */}
            {/* 🧩 A step on a whole item that has sections (the Schedule's moments, the
                parents and hosts, the march's lines): ONE dropdown of them, the
                first line of the field — the same `SheetSections` All items wears. */}
            {at?.kind === 'step' && stepHere && !stepHere.piece && (pieces[selected] || stepHere.items.length > 1) ? (
              <div className="flex shrink-0 px-4 pt-1 lg:hidden" data-details-step-sections="">
                <SheetSections
                  items={navGroups.flatMap((g) => g.items)}
                  selected={selected}
                  onPick={select}
                  pieces={pieces[selected] ?? null}
                  /* Named in the STEP's words ("Cover photo"), never the item's ("Hero"). */
                  current={pieceLabels[selected]?.[pieceMap[selected] ?? ''] ?? stepHere.title}
                />
              </div>
            ) : null}
            {/* Every step's field is IN its sheet — the Logo's answer included (owner 2026-10-05). */}
            {editorsBody(false)}
            {/* 🚶 Not under the march: its Back · Skip · Next are at the END of the march (below). */}
            {at?.kind === 'step' && !marchHere ? (
              <div data-details-guide-foot-sheet="" className="contents lg:hidden">
                <GuideFoot
                  onBack={backScreen(plan!, at) ? () => move(backScreen(plan!, at), 'back') : null}
                  onSkip={skipScreen(plan!, at) ? () => move(skipScreen(plan!, at), 'skip') : null}
                  onNext={nextScreen(plan!, at) ? () => move(nextScreen(plan!, at), 'next') : null}
                  warning={unsavedTo !== null ? askKind : null}
                  onKeepEditing={() => setUnsavedTo(null)}
                  onGoAnyway={() => unsavedTo && goTo(unsavedTo)}
                />
              </div>
            ) : null}
          </MakerHalfSheet>
        ) : (
        <aside
          aria-label={`${shownLabel} — edit`}
          data-details-editor-panel=""
          data-phone-chrome="panel"
          data-open={sheetOpen ? '' : undefined}
          /* A page that carries its own tools (the Logo studio, the Mood Board)
             has no second editor beside it — the column is hidden, never
             unmounted, so every other item's fields still post. */
          hidden={layout === 'whole'}
          className={`order-3 ${layout === 'whole' ? 'hidden' : 'flex'} min-h-0 shrink-0 flex-col border-ink/10 bg-cream lg:static lg:max-h-none lg:w-[360px] lg:border-l ${
            /* 📱 A TOOL of the lower third (owner 2026-10-05): over it, beside the
               column that names it — never over the page. */
            sheetOpen ? MAKER_LT_TOOL : 'max-lg:hidden'
          }`}
        >
          {/* 📱 ONE header row: the setup's progress and the item's sections — its name is the column's. */}
          <div
            className={`${marchHere ? 'hidden' : 'flex'} shrink-0 items-center gap-2 px-3 pb-1 pt-2 lg:hidden`}
            data-details-sheet-head=""
          >
            {/* 🧭 The setup's progress lives HERE, in the sheet's header — never a chip floating
                over the page (it covered the page's own header line, 2026-10-04 at 375 px).
                In the flow it is the step sheet's own ▾ line (`GuideTop`). */}
            {plan ? (
              <button
                type="button"
                data-details-guide-progress=""
                onClick={openGuide}
                className="sn-press inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-terracotta-700/10 px-3 font-mono text-[11.5px] tracking-[0.04em] text-terracotta-800"
              >
                {whatsLeftLine}
              </button>
            ) : null}
            <SheetSections
              items={navGroups.flatMap((g) => g.items)}
              selected={selected}
              onPick={select}
              pieces={pieces[selected] ?? null}
              /* A hidden item (no row of its own) and the Your event form name themselves. */
              current={pieceLabels[selected]?.[pieceMap[selected] ?? ''] ?? shownLabel}
            />
          </div>
          <p className="hidden px-4 pt-4 font-serif text-lg text-ink lg:block">{formGroup ? formGroup.label : (current.panelLabel ?? current.label)}</p>
          {editorsBody(false)}
        </aside>
        )}
        {ltTiles}
      </div>
      {/* 🗂 The flow's other screens — the stage picker, a stage's Before we start, its Ready screen. */}
      {plan && at?.kind === 'stages' ? <StagePicker plan={plan} onPick={pickStage} initial={walk} /> : null}
      {plan && at?.kind === 'before' ? (
        <BeforeWeStartScreen plan={plan} round={at.round} onStart={() => startStage(at.round)} onBack={() => goTo({ kind: 'stages' })} />
      ) : null}
      {plan && at?.kind === 'link' ? (
        <GuideLinkScreen
          plan={plan}
          link={at.link}
          href={guide?.actions.guestsHref ?? null}
          foot={
            <GuideFoot
              onBack={backScreen(plan, at) ? () => move(backScreen(plan, at), 'back') : null}
              onSkip={skipScreen(plan, at) ? () => move(skipScreen(plan, at), 'skip') : null}
              onNext={nextScreen(plan, at) ? () => move(nextScreen(plan, at), 'next') : null}
              warning={null}
              onKeepEditing={() => setUnsavedTo(null)}
              onGoAnyway={() => unsavedTo && goTo(unsavedTo)}
            />
          }
        />
      ) : null}
      {plan && at?.kind === 'ready' && guide ? (
        <GuideReady plan={plan} round={at.round} actions={guide.actions} onGo={(to) => move(to)} />
      ) : null}
      {plan && at?.kind === 'step' ? (
        /* 📱 On a phone the foot lives in the step's half sheet (above); this one is the desktop's. */
        <div data-details-guide-foot-wrap="" data-phone-chrome="strip" className="hidden lg:contents">
        <GuideFoot
          onBack={backScreen(plan, at) ? () => move(backScreen(plan, at), 'back') : null}
          onSkip={skipScreen(plan, at) ? () => move(skipScreen(plan, at), 'skip') : null}
          onNext={nextScreen(plan, at) ? () => move(nextScreen(plan, at), 'next') : null}
          warning={unsavedTo !== null ? askKind : null}
          onKeepEditing={() => setUnsavedTo(null)}
          onGoAnyway={() => unsavedTo && goTo(unsavedTo)}
        />
        </div>
      ) : null}
      </div>
      </DetailsPieceContext.Provider>
      </DetailsSelectContext.Provider>
    </DetailsTapContext.Provider>
  );
}

/** The editor column is on screen: a desk always draws it; a phone only while its tool is open (the scroll waits for it). */
function sheetOpenOrDesk(): boolean {
  return typeof window !== 'undefined' && (!window.matchMedia('(max-width: 1023.98px)').matches || document.querySelector('[data-details-editor-panel][data-open]') !== null);
}
