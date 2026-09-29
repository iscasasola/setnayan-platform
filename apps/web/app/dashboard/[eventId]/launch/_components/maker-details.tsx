import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  Armchair,
  Bookmark,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Download,
  FileText,
  Gift,
  Gem,
  Grid3x3,
  Heart,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  Mail,
  MailCheck,
  MessageSquareText,
  MailOpen,
  PanelTop,
  Palette,
  QrCode,
  Quote,
  Reply,
  ScrollText,
  Ticket,
  UtensilsCrossed,
  Users,
} from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import type { MenuMoment, PrintSetKey, StoredPrintDetails } from '@/lib/print-pieces';
import { PRINT_PIECES, PRINT_SET_KEYS } from '@/lib/print-pieces';
import { HubSavesImmediately } from '../../website/_components/hub-draft-field';
import { PabuyaMessageEditor } from '../../pabuya/_components/pabuya-message-editor';
import { OpeningLineField } from './opening-line-field';
import { SoftPost } from './soft-post';
import { SlugField } from '../../invitation/_components/slug-field';
import { siteOrigin } from '@/lib/site-origin';
import { publicEventPath } from '@/lib/public-event-url';
import { PaidMark } from '@/app/_components/paid-mark';
import { makerProMark, paidMarkLabel } from '@/lib/paid-mark';
import type { StoredQrStyle } from '@/lib/qr-look';
import { MiniTour } from '@/app/_components/mini-tour';
import { QrLookControls } from './qr-look-controls';
import { MakerThemeGallery, MakerThemeMenu, ThemePickProvider } from './maker-theme-picker';
import type { ThemeTile } from '@/lib/maker-theme-tiles';
import type { UpdateQrStyleResult } from '../qr-look-actions';
import {
  LOOK_ITEM_KEYS,
  RSVP_PIECES,
  STORY_ITEM_KEYS,
  WORDS_ITEM_KEYS,
  detailsItemHref,
  detailsNavigatorKeys,
  detailsSwitchesFor,
  wordsAndPlansItem,
  type DetailsItemContext,
  type DetailsItemKey,
  type DetailsItemModel,
  type EventItemKey,
  type LookItemKey,
  type StoryItemKey,
  type WordsItemKey,
} from '@/lib/maker-details-items';
import { SpecialMessageField } from './special-message-field';
import { LoveStoryPieceFocus, ScheduleSlots } from './details-tool-pieces';
import { LOVE_STORY_CHAPTERS, LOVE_STORY_CHAPTER_LABEL } from '@/lib/love-story-moments';
import { StoryPanel } from '../../website/editor/_components/authoring-panels';
import type { LoveStoryBlob } from '../../website/our-story/_components/story-fields';
import { updateOurStory } from '../../website/our-story/actions';

import { DetailsLookBody, DetailsLookEditor, DetailsLookPieces } from './details-look-pages';
import { MoodBoardPieces } from '../../studio/mood-board/_components/mood-board-parts';
import { ItemPieces } from './details-piece';
import { DetailsGoTo } from './details-go';
import { yourEventParts, type YourEventInput } from './details-your-event-parts';
import { themeStillSrc } from '@/lib/theme-sample-stills';
import { PUBLIC_STAGE_LABELS } from '@/lib/public-site-stage-labels';
import { SeatPlanSlot } from '../../seating/_components/seat-plan-slots';
import { DetailsWorkspace, type DetailsNavGroup } from './details-workspace';
import type { DetailsGuide } from './details-guide';
import { buildGuidedPlan, firstOpenScreen, stepOfItem, wordsAndPlansInputFrom, type GuidedRound } from '@/lib/details-guided-flow';
import { parentsOffered } from '@/lib/details-your-event';
import { previewCarriesPlace } from '@/lib/maker-preview-way-back';
import { ParentCards } from './parent-cards';
import {
  PrintPieceBody,
  PrintPieceEditor,
  PrintSetBody,
  PrintSetDownloads,
  SeatPlan3dNote,
  freePrintParts,
  type PrintsInput,
} from './maker-prints';

/**
 * DETAILS — the Event Hub Maker's one fill-in area (owner 2026-09-28,
 * DECISION_LOG "DETAILS IS THE ONE FILL-IN AREA…"), drawn as the Maker's own
 * three columns (DECISION_LOG "THE DETAILS PAGE WEARS THE MAKER'S THREE
 * COLUMNS") from the approved prototype
 * `Setnayan/prototypes/details_themes_page_2026-09-28.html`:
 *
 *   Theme                 — the first choice: the sample gallery (`maker-theme-picker.tsx`)
 *   Your Event Hub        — the address and its QR
 *   Invitation set        — every piece (Prints & Tickets FOLDED IN, owner:
 *                           *"1 fold prints and tickets into details"*)
 *   For the day           — the free prints
 *   Download              — the whole set
 *
 * Each item: its picture in the body, its editor on the right
 * (`details-workspace.tsx`). `DETAILS_ITEM_GROUPS` takes each part's items as rows.
 *
 * ✍ WORDS · STORY & PLANS (Details part 2b):
 *   Words          — Special message · Thank-you · Opening line · Kindly reply:
 *                    the SAME editors part 1 mounted under the print switches,
 *                    now also each an item of its own (one field, two doors —
 *                    `same-field.ts` keeps both doors one value);
 *   Story & plans  — Love Story (the scrapbook page as the picture, its words —
 *                    the Story row's `StoryPanel` — as the editor) · Schedule
 *                    (the shipped Schedule page, whole: it is its own editor) ·
 *                    RSVP (the guest's RSVP as the picture, the shipped
 *                    `MakerRsvpSettings` as the editor). Moved whole, never
 *                    re-drawn; their old addresses land on their items.
 *   🎉 Which items an event type gets is asked of its words
 *   (`detailsItemApplies`, `EventWords`) — a birthday has no Love Story.
 *   🗝 `detailsFactEditors` builds the editors a fact tapped on a stage opens
 *   too — ONE set, handed to Details and to the stage, never a copy.
 *
 * 🔑 NOTHING IS RE-ENTERED. Each switch names a source that already has a home
 * and reads it from there; a text-carrying switch shows the SAME field under
 * it, saving through its own shipped path (owner: *"NO 'GO EDIT IT OVER THERE'
 * LINKS — EDIT IT WHERE YOU ARE"*):
 *   · the thank-you message → `PabuyaMessageEditor` (`events.pabuya_message`,
 *     the E-Gifts page's own column), live;
 *   · the special message → its drafted form (`updateSpecialMessage`), the same
 *     column the Maker's words editor drafts;
 *   · parents → each parent's own guest card (`GuestCardBody`, which posts every
 *     column), live;
 *   · the opening line and "Kindly reply" — print-only (`events.print_details`),
 *     typed here, and tappable on the card itself.
 *
 * 📮 THE PRINT WORDS ARE ONE FORM, IN MANY ITEMS. `/api/hub-print/words` writes
 * the whole `print_details` from one post, so its switches and lines — spread
 * over the Invitation, The Finer Details, the pass, the QR and the seat plan —
 * are joined to ONE `<form>` by `form=` (`WORDS_FORM`), and every item's editor
 * stays mounted (hidden when not showing), so a Save anywhere posts them all.
 *
 * Saves: the address, the print words, the thank-you and a parent's card
 * write live and say "Saves immediately"; the theme, the QR's look (since
 * #6113) and the special message are drafted
 * (`every-maker-form-drafts-or-says-so.test.ts`).
 */

/** The one print-words form every item's switches post through. */
const WORDS_FORM = 'details-print-words';

export type MakerDetailsProps = {
  eventId: string;
  slug: string | null;
  /** `updateEventSlug` bound to this event (the one writer, `findSlugConflict` behind it). */
  slugAction: (formData: FormData) => Promise<void>;
  /** The QR's look choices (lib/qr-look.server.ts qrLookChoicesFromRow). */
  qr: { ownsPro: boolean; style: StoredQrStyle; inks: string[]; storeShell: boolean };
  /** `updateQrStyle` bound to this event. */
  qrStyleAction: (patch: StoredQrStyle) => Promise<UpdateQrStyleResult>;
  /** 🎨 The theme (null = not offered). */
  theme: {
    themes: ThemeTile[];
    current: string;
    ownsPro: boolean;
    storeShell: boolean;
    suggested: string | null;
    sampleVersion: string | null;
    blurbs: Record<string, string>;
    /** Each theme's saved poster, resolved (`INVITE_THEMES[id].media.poster`). */
    posters: Record<string, string | null>;
    /** Mount the first-visit tours (off on the Maker's own first visit). */
    tour: boolean;
    /** The couple has chosen a theme (saved or drafted) — the item's "done". */
    chosen: boolean;
  };
  /** The couple's own prints, in the theme being edited. */
  prints: PrintsInput;
  menu: { saved: MenuMoment[]; caterer: MenuMoment[]; suggestions: string[]; flash: 'saved' | 'error' | null };
  stored: StoredPrintDetails;
  hosts: Array<{ moderatorId: string; label: string; contact: string | null }>;
  /** The parents on the invitation, each with their own guest card. */
  parents: Array<{ guestId: string | null; name: string; card: ReactNode }>;
  pabuyaMessage: string | null;
  specialMessage: string | null;
  hasPalette: boolean;
  hasGifts: boolean;
  /** ✍ `detailsFactEditors(…)` — the SAME nodes the stage's inspector shows for a tapped fact. */
  facts: Partial<Record<DetailsItemKey, ReactNode>>;
  /** 💌 Love Story, moved whole: the scrapbook page (its picture). Null = not this type. `moments` null = unread. */
  loveStory?: { book: ReactNode; moments: number | null } | null;
  /** 🗓 The shipped Schedule page (the rail is the picture; its own inspector is
   *  drawn into the right column). `moments` null = unread; `pieces` = its
   *  top-level moments then Announce (`schedulePieces`). */
  schedule?: { page: ReactNode; moments: number | null; pieces: ReadonlyArray<{ key: string; label: string; sub?: string }> } | null;
  /** 🗳 RSVP, moved whole: the guest's RSVP (its picture) and its settings (its editor). */
  rsvp?: { page: ReactNode; settings: ReactNode } | null;
  flash: 'saved' | 'error' | null;
  /** Changes on every server render, so a new QR look shows at once. */
  stamp: string;
  initialItem: DetailsItemKey;
  /**
   * 🎨 THE LOOK AFTER THEME (Details part 3) — Mood Board · Logo · Hero ·
   * Reveal, the shipped pages moved in whole. `moodBoard` is the Mood Board
   * studio, built by the launch page; Logo, Hero and Reveal are the work
   * area's own (`details-look-pages.tsx`). What "done" and "used on" say is
   * read from data that already exists. Null = not offered (the lab).
   */
  look?: {
    /** The Mood Board's middle (its picked part) and right (that part's controls). */
    moodBoard: ReactNode;
    moodBoardControls: ReactNode;
    logoDone: boolean;
    heroDone: boolean;
    /** Undefined: the reveal always plays something (the theme's own opening) — "done" means nothing for it. */
    revealDone?: boolean;
    /** The stages the reveal plays on, in their own words. */
    revealOn: string[];
    /** The stages the hero leads, in their own words. */
    heroOn: string[];
  } | null;
  /** The celebration's type — which items and switches it gets (`detailsNavigatorKeys`, `detailsSwitchesFor`). */
  eventContext: DetailsItemContext;
  /** 🗓 Details part 2a — "Your event" (Names · Date · Venues · Parents & hosts · the march); null = not offered. */
  yourEvent?: YourEventInput | null;
  /**
   * 🪑 Details part 4 — the Seat plan: the shipped seating page, drawn in the
   * Maker (`seating/page.tsx` with `maker=1`) — its plan is the middle, and
   * the editor draws its place's elements and its guests into the two slots
   * this page puts in the navigator and the right column. The counts are the
   * launch page's reads; null = could not be read (never "0"). Null = not
   * offered (a type with no seat plan, the lab).
   */
  seatPlan?: { page: ReactNode; tables: number | null; seated: number | null; open: boolean | null } | null;
  /**
   * 🪜 Details part 5 — the guided "What's left" (`lib/details-guided-flow.ts`).
   * Its steps and their ✓ / ○ are built HERE from the navigator's own rows, so
   * a step's "done" is its item's done — never a second opinion. Null = no flow
   * (the lab without `?guide`).
   */
  guide?: {
    /** Open on the flow (an unfinished event with nothing else named, or `?guide=`). */
    open: boolean;
    /** `?guide=ready-N` — that round's Ready screen. */
    ready: GuidedRound | null;
    /** The address named an item (`?item=`) — open on its step, or in All items. */
    itemNamed: boolean;
    /** The address named the flow itself (`?guide=`). */
    guideNamed: boolean;
    /** The flow's first-visit tour (a `MiniTour`), or null. */
    tour?: ReactNode;
  } | null;
};

const PIECE_ICON: Record<PrintSetKey, ReactNode> = {
  invitation: <Mail aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
  entourage: <Users aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
  details: <ScrollText aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
  menu: <UtensilsCrossed aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
  pass: <Ticket aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
  poster: <ImageIcon aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
  card: <Bookmark aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
};
const FREE_ICON: Record<string, ReactNode> = {
  'guest-registry': <ClipboardList aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
  'qr-codes': <Grid3x3 aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
  'seat-plan': <LayoutGrid aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
  'seating-pack': <FileText aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
  caterer: <CalendarDays aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
  'event-qr': <QrCode aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
};

const WORDS_ICON: Record<WordsItemKey, ReactNode> = {
  'special-message': <MessageSquareText aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
  'thank-you': <Gift aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
  'opening-line': <Quote aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
  'kindly-reply': <Reply aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
};
const STORY_ICON: Record<StoryItemKey, ReactNode> = {
  'love-story': <Heart aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
  schedule: <CalendarClock aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
  rsvp: <MailCheck aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
};

/**
 * ✍ THE EDITORS A FACT OPENS — in Details, AND when the couple taps that fact
 * on a stage (DECISION_LOG "DETAILS IS THE ONE FILL-IN AREA; STAGES ARE LOOK
 * AND MOTION; TAP IS A SHORTCUT": *"tapping a fact on a stage opens the SAME
 * Details field on the right, never a copy"*). Built ONCE by the launch page and
 * handed to both `MakerDetails` (`facts`) and the Maker shell (`factEditors`),
 * so the stage's inspector draws the very nodes the Details item draws.
 *
 * Only self-contained editors are here — each posts its own save. The opening
 * line and "Kindly reply" post through the print words form, which exists only
 * in Details (they are print-only: no stage shows them).
 */
export function detailsFactEditors(input: {
  eventId: string;
  specialMessage: string | null;
  specialMessageAction: (formData: FormData) => Promise<void>;
  pabuyaMessage: string | null;
  /** The Love Story's words (drafted over live) and whether a sixth moment may be added; null = no Love Story here. */
  loveStory: { story: LoveStoryBlob; ownsPro: boolean } | null;
}): Partial<Record<DetailsItemKey, ReactNode>> {
  const { eventId } = input;
  return {
    /* ── Special message → events.special_message, drafted like the Maker's other words ── */
    'special-message': (
      <SpecialMessageField
        action={input.specialMessageAction}
        initial={input.specialMessage}
        back={detailsItemHref(eventId, 'special-message')}
      />
    ),
    /* ── The thank-you message: ONE source, `events.pabuya_message` — the E-Gifts page reads the same column ── */
    'thank-you': (
      <div data-details-thank-you="" className="flex flex-col gap-1">
        <HubSavesImmediately />
        <PabuyaMessageEditor eventId={eventId} initialMessage={input.pabuyaMessage} />
      </div>
    ),
    /* ── The Love Story's words — the Story row's own panel (its chapters, their
       moments and their questions), `updateOurStory`, drafted. ── */
    ...(input.loveStory
      ? {
          'love-story': (
            <StoryPanel
              action={updateOurStory.bind(null, eventId)}
              eventId={eventId}
              story={input.loveStory.story}
              ownsPro={input.loveStory.ownsPro}
            />
          ),
        }
      : {}),
  };
}

export function MakerDetails(props: MakerDetailsProps) {
  const { eventId, slug, slugAction, qr, qrStyleAction, theme, prints, menu, stored, hosts, parents } = props;
  const { pabuyaMessage, specialMessage, hasPalette, hasGifts, flash, stamp, initialItem, eventContext } = props;
  const { facts, loveStory = null, schedule = null, rsvp = null } = props;
  const seatPlan = props.seatPlan ?? null;
  const switches = detailsSwitchesFor(eventContext);
  const look = props.look ?? null;
  const PRINT_WORDS_ENDPOINT = '/api/hub-print/words';
  const inc = stored.include;
  const replyChoice = stored.rsvp?.kind === 'host' ? `host:${stored.rsvp.moderatorId}` : stored.rsvp?.kind === 'manual' ? 'manual' : '';
  const base = `/dashboard/${eventId}`;
  const address = slug ? `${siteOrigin().replace(/^https?:\/\//, '')}${publicEventPath(slug)}` : null;
  // `draft=1`: the QR look the couple is trying (host-only, never cached — #6113);
  // `v=` the render stamp, so a changed look shows at once.
  const qrSrc = slug ? `/api/website/qr/${encodeURIComponent(slug)}?draft=1&v=${encodeURIComponent(stamp)}` : null;
  const qrMark = makerProMark({ owns: qr.ownsPro, storeShell: qr.storeShell });
  const free = freePrintParts(eventId, slug);
  const save = <SaveWords />;
  /* 🗓 Your event (part 2a) — its rows, bodies and editors (`details-your-event-parts.tsx`). */
  const ye = props.yourEvent ? yourEventParts({ eventId, input: props.yourEvent, prints, parents, hosts }) : null;

  /* ══ THE NAVIGATOR — groups are data (`DETAILS_ITEM_GROUPS`) ══ */
  const still = themeStillSrc(theme.current);
  /* Each item's model (`DetailsItemModel`): done and used-on are derived from
     data that already exists — part 1 fills them for its own items. */
  const menuDone = menu.saved.some((m) => m.dishes.length > 0) || menu.caterer.some((m) => m.dishes.length > 0);
  const labelOf = (k: DetailsItemKey): Omit<DetailsItemModel, 'key' | 'group'> & { icon: ReactNode; panelLabel?: string } => {
    const yeRow = ye?.rows[k as EventItemKey];
    if (yeRow) return yeRow;
    if (k === 'seating') return seatPlanRow(seatPlan);
    if (look && (LOOK_ITEM_KEYS as readonly string[]).includes(k)) return lookLabel(k as LookItemKey, look, hasPalette);
    if (k === 'theme') {
      return {
        label: 'Theme',
        sub: 'Samples · Maria & Jose',
        done: theme.chosen,
        usedOn: ['every stage', 'every print'],
        icon: still ? (
          // eslint-disable-next-line @next/next/no-img-element -- the committed still of the couple's theme on the sample
          <img src={still} alt="" className="h-full w-full object-cover object-top" />
        ) : (
          <Palette aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        ),
      };
    }
    if (k === 'address') {
      return { label: 'Event Hub address', sub: address ?? 'Not set yet', done: Boolean(slug), usedOn: ['every print', 'every pass'], icon: <Link2 aria-hidden className="h-4 w-4" strokeWidth={1.75} /> };
    }
    if (k === 'qr') return { label: 'QR code', done: Boolean(slug), usedOn: ['every print', 'every pass'], icon: <QrCode aria-hidden className="h-4 w-4" strokeWidth={1.75} /> };
    if (k === 'download') return { label: 'Download the set', sub: 'PDF · every pass', icon: <Download aria-hidden className="h-4 w-4" strokeWidth={1.75} /> };
    if ((WORDS_ITEM_KEYS as readonly string[]).includes(k) || (STORY_ITEM_KEYS as readonly string[]).includes(k)) {
      const w = k as WordsItemKey | StoryItemKey;
      return {
        /* ONE builder of this input (`wordsAndPlansInputFrom`) — the launch
           page and Home read "done" through the very same one. */
        ...wordsAndPlansItem(
          w,
          wordsAndPlansInputFrom({
            specialMessage,
            pabuyaMessage,
            stored,
            loveStoryMoments: loveStory ? loveStory.moments : 0,
            scheduleMoments: schedule?.moments ?? null,
          }),
        ),
        icon: (WORDS_ICON as Record<string, ReactNode>)[w] ?? (STORY_ICON as Record<string, ReactNode>)[w],
      };
    }
    if ((PRINT_SET_KEYS as readonly string[]).includes(k)) {
      const p = k as PrintSetKey;
      // A piece is "done" once it would print — the Menu only with a dish (it is never printed blank).
      return { label: PRINT_PIECES[p].label, sub: PRINT_PIECES[p].size, done: p === 'menu' ? menuDone : undefined, icon: PIECE_ICON[p] };
    }
    const fp = free.find((f) => f.key === k);
    return { label: fp?.label ?? k, icon: FREE_ICON[k] ?? <FileText aria-hidden className="h-4 w-4" strokeWidth={1.75} /> };
  };
  /* Story & plans: each page is drawn only where it was read; which items this
     event type gets is `detailsNavigatorKeys`' (a birthday has no Love Story). */
  const storyPresent: StoryItemKey[] = [
    ...(loveStory ? (['love-story'] as const) : []),
    ...(schedule ? (['schedule'] as const) : []),
    ...(rsvp ? (['rsvp'] as const) : []),
  ];
  const present = new Set<DetailsItemKey>(['theme', ...(look ? LOOK_ITEM_KEYS : []), ...(ye?.keys ?? []), ...(seatPlan ? (['seating'] as const) : []), 'address', 'qr', 'download', ...WORDS_ITEM_KEYS, ...storyPresent, ...PRINT_SET_KEYS, ...free.map((f) => f.key)]);
  const groups: DetailsNavGroup[] = detailsNavigatorKeys(eventContext, present).map((g) => ({
    key: g.group,
    label: g.label,
    items: g.keys.map((k) => ({ key: k, group: g.group, ...labelOf(k) })),
  }));

  /* ══ 🪜 WHAT'S LEFT — the guided flow over these very rows ══ */
  const plan = props.guide
    ? buildGuidedPlan(
        groups.flatMap((g) => g.items),
        { solemn: eventContext.solemn, parentsOffered: props.yourEvent ? parentsOffered(props.yourEvent.kind) : switches.parents },
      )
    : null;
  const opening = props.guide && plan && props.guide.open && !props.guide.itemNamed && !props.guide.ready ? firstOpenScreen(plan) : null;
  const openingStep = opening?.kind === 'step' ? plan!.steps.find((s) => s.key === opening.step) : undefined;
  /* The flow opens on its first step still left — on the item of it still not done. */
  const startItem: DetailsItemKey = openingStep ? (openingStep.left[0] ?? openingStep.items[0]!) : initialItem;
  const guide: DetailsGuide | null =
    props.guide && plan
      ? {
          plan,
          open: props.guide.open && (!props.guide.itemNamed || stepOfItem(plan, initialItem) !== null),
          ready: props.guide.ready ?? (opening?.kind === 'ready' ? opening.round : null),
          addressed: props.guide.itemNamed || props.guide.guideNamed,
          actions: {
            // The Save the Date as guests meet it, the draft — its way back lands on Details.
            previewHref: slug ? previewCarriesPlace(`/${slug}?phase=save_the_date&preview=draft`, { kind: 'tool', key: 'details' }) : null,
            shareUrl: slug ? `${siteOrigin()}${publicEventPath(slug)}` : null,
            // The Guest list's own invite flow (its "Share the link" tab).
            sendHref: `${base}/guests?gview=share`,
          },
          tour: props.guide.tour ?? null,
        }
      : null;

  /* ══ BODIES — each item's picture ══ */
  const bodies: Partial<Record<DetailsItemKey, ReactNode>> = {
    theme: (
      <>
        <MakerThemeGallery
          themes={theme.themes}
          ownsPro={theme.ownsPro}
          storeShell={theme.storeShell}
          suggested={theme.suggested}
          sampleVersion={theme.sampleVersion}
          posters={theme.posters}
        />
        {theme.tour ? <MiniTour tourKey="customer_theme_picker_v1" storeShell={theme.storeShell} /> : null}
      </>
    ),
    address: (
      <section
        data-details-page-address=""
        className="flex flex-col items-center gap-3 rounded-md bg-white/80 p-4 text-center shadow-[0_1px_2px_rgba(40,34,24,.06)] sm:flex-row sm:text-left"
      >
        {qrSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- our own QR route, a PNG
          <img src={qrSrc} alt="QR code for your Event Hub address" width={176} height={176} className="h-40 w-40 shrink-0 bg-white p-1 sm:h-44 sm:w-44" />
        ) : null}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Your Event Hub address</p>
          {address ? (
            <p className="mt-1 break-all font-serif text-xl text-ink" data-details-page-url="">
              {address}
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink/70">No address yet — choose one in the editor.</p>
          )}
          <p className="mt-2 text-[12.5px] text-ink/60">Every printed piece and every guest pass carries this address and its QR.</p>
        </div>
      </section>
    ),
    /* ── Your QR (owner 2026-09-27): large, with Shape · Pattern · Colour right
       under it — each ONE dropdown, ◆ PRO until owned (never a padlock).
       DRAFTED since 2026-09-29 (owner: "yes to all 3", #6113): tried by every
       couple, drawn here from the draft (`?draft=1`), put live by Apply — only
       with Pro. ── */
    qr: (
      <section data-details-qr="" className="flex flex-col items-center gap-4">
        {qrSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- our own QR route, a PNG; `v` is the render stamp so a new look shows at once
          <img src={qrSrc} alt="Your Event Hub QR code" width={240} height={240} className="h-56 w-56 bg-white p-2 shadow-[0_1px_2px_rgba(40,34,24,.08)]" />
        ) : (
          <p className="text-sm text-ink/70">Set your Event Hub address first — the QR opens it.</p>
        )}
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          Your QR code
          {qrMark ? <PaidMark state={qrMark} label={paidMarkLabel(qrMark, 'Event Hub Pro')} text="Event Hub Pro" size="xs" /> : null}
        </p>
        <div className="w-full max-w-md">
          <QrLookControls eventId={eventId} ownsPro={qr.ownsPro} storeShell={qr.storeShell} style={qr.style} inks={qr.inks} action={qrStyleAction} />
        </div>
        {/* Waits for the theme's tour, so two never stack on one first visit. */}
        {theme.tour ? <MiniTour tourKey="customer_pro_qr_v1" storeShell={qr.storeShell} after="customer_theme_picker_v1" /> : null}
      </section>
    ),
    download: <PrintSetBody input={prints} />,
    /* ── Words: how each one reads. The print-only two show the card they
       print on — tap the words on it to edit them on the right. ── */
    'special-message': <WordsCard text={specialMessage} note="How it reads on your Event Hub." />,
    'thank-you': <WordsCard text={pabuyaMessage} note="Your guests read this on your E-Gifts page." />,
    'opening-line': <PrintPieceBody input={prints} piece="invitation" priority={initialItem === 'opening-line'} menu={menu} tappable />,
    'kindly-reply': <PrintPieceBody input={prints} piece="details" priority={initialItem === 'kindly-reply'} menu={menu} tappable />,
    /* ── Story & plans: each page as it shipped. Keyed: React's dev check
       otherwise flags a page handed through Details as a child without a key. ── */
    ...(loveStory
      ? {
          'love-story': (
            <div key="love-story" data-details-love-story-book="" data-maker-love-story-book="">
              <LoveStoryPieceFocus />
              {loveStory.book}
            </div>
          ),
        }
      : {}),
    /* The Schedule's picture is its rail (the shipped page); the picked
       moment's fields are the right column's (`ScheduleSlots`). The guest's RSVP
       is a live page that fills the body ('fill'), its settings on the right. */
    ...(schedule ? { schedule: <div key="schedule" data-details-schedule-page="">{schedule.page}</div> } : {}),
    ...(rsvp ? { rsvp: <div key="rsvp" data-details-rsvp-page="" className="flex min-h-0 flex-1 flex-col">{rsvp.page}</div> } : {}),
  };
  for (const k of PRINT_SET_KEYS) {
    bodies[k] = (
      <>
        <PrintPieceBody input={prints} piece={k} priority={k === initialItem} menu={menu} tappable={k === 'invitation' || k === 'details'} />
        {k === 'invitation' || k === 'details' ? (
          <p className="text-center text-xs text-ink/55">Tap your words on the card to edit them.</p>
        ) : null}
      </>
    );
  }
  // The Menu's first-visit tour (it lived on Prints & Tickets): what it is and where its dishes come from.
  bodies.menu = (
    <>
      {bodies.menu}
      {theme.tour ? <MiniTour tourKey="customer_print_menu_v1" storeShell={theme.storeShell} /> : null}
    </>
  );
  for (const f of free) bodies[f.key] = f.body;
  if (ye) Object.assign(bodies, ye.bodies);
  /* 🪑 The seat plan — the shipped editor fills the middle part ('fill'). */
  if (seatPlan) {
    bodies.seating = (
      <div key="seating" data-details-seat-plan-page="" className="flex min-h-0 flex-1 flex-col">
        {seatPlan.page}
      </div>
    );
  }
  /* 🎨 THE LOOK — each shipped page moved in whole, in the split it shipped
     with (`detailsItemLayout`): the Mood Board and the Logo studio carry their
     own tools; the Hero and the Reveal are a live page with their controls on
     the right. */
  if (look) {
    bodies['mood-board'] = (
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 sm:px-6" data-details-mood-board="">
        {look.moodBoard}
      </div>
    );
    bodies.logo = <DetailsLookBody item="logo" />;
    bodies.hero = <DetailsLookBody item="hero" />;
    bodies.reveal = <DetailsLookBody item="reveal" />;
  }

  /* ══ EDITORS — each item's controls; every one stays mounted ══ */
  const qrAlways = (
    <div data-include="qr-always" className="flex min-h-11 items-center justify-between gap-3 border-b border-ink/5 py-2">
      <span className="text-sm text-ink">Event Hub QR code</span>
      <span className="text-xs font-medium text-ink/60">Always printed</span>
    </div>
  );
  /* ✍ The two print-only words — each ONE field in two doors (its Words item
     and its print's switch), posting through the print words form. */
  const openingLine = <OpeningLineField initial={stored.openingLine} form={WORDS_FORM} titled={false} />;
  const kindlyReply = <KindlyReplyField hosts={hosts} choice={replyChoice} manual={stored.rsvp?.kind === 'manual' ? stored.rsvp.text : ''} />;
  const printsOn = (piece: PrintSetKey) => (
    <p className="text-xs text-ink/60">
      Prints on {PRINT_PIECES[piece].label} while its switch is on.
    </p>
  );
  const editors: Partial<Record<DetailsItemKey, ReactNode>> = {
    theme: <MakerThemeMenu themes={theme.themes} ownsPro={theme.ownsPro} storeShell={theme.storeShell} blurbs={theme.blurbs} />,
    /* ── Your Event Hub address — the one place it is edited (owner: "Add the
       slug to details"). The shipped SlugField: 3–32 characters, live
       availability, old links forward. ── */
    address: (
      <section data-details-address="" className="flex flex-col gap-2">
        <SlugField eventId={eventId} initialSlug={slug ?? ''} saveAction={slugAction} />
        <HubSavesImmediately className="mt-1" />
      </section>
    ),
    qr: (
      <div className="flex flex-col gap-1">
        <p className="text-xs text-ink/60">
          {qr.ownsPro
            ? 'Your logo sits in the centre of every guest QR. Its shape, pattern and colour are under the code.'
            : 'Every guest QR carries the Setnayan mark in the centre. Try your logo, shape, pattern and colour here — they go live when you Apply with Event Hub Pro.'}
        </p>
        {qrAlways}
        <Toggle
          form={WORDS_FORM}
          name="inc_nfc"
          label="Add an NFC sticker spot"
          on={inc.nfc}
          tip="Use 25 mm round NFC stickers (NTAG213/215). Write your Event Hub link to them first. The spot prints beside the QR — on the calling card it takes the corner; where a format has no room for both, the QR stays and the spot is left off."
        />
        {save}
      </div>
    ),
    invitation: (
      <PrintPieceEditor input={prints} piece="invitation">
        {switches.parents ? (
          <Toggle
            form={WORDS_FORM}
            name="inc_parents"
            label="Parents on the invitation"
            on={inc.parents}
            tip="Guests whose role on your guest list is a parent's. Parents are optional — with none, the card leaves that part out."
          >
            <ParentCards eventId={eventId} parents={parents} />
          </Toggle>
        ) : null}
        <Toggle form={WORDS_FORM} name="inc_opening_line" label="Opening line" on={inc.openingLine}>
          {openingLine}
        </Toggle>
        {qrAlways}
        {save}
      </PrintPieceEditor>
    ),
    details: (
      <PrintPieceEditor input={prints} piece="details">
        <Toggle
          form={WORDS_FORM}
          name="inc_gift_details"
          label="E-Gifts — gift details"
          on={inc.giftDetails && hasGifts}
          disabled={!hasGifts}
          note={hasGifts ? null : (
            <Link href={`${base}/pabuya`} className="underline underline-offset-2">
              Set up E-Gifts
            </Link>
          )}
          tip="Account numbers print masked (•••• 1234)."
        />
        <Toggle form={WORDS_FORM} name="inc_thank_you" label="E-Gifts — thank-you message" on={inc.thankYou}>
          {/* The Words › Thank-you editor — one field, two doors. */}
          {facts['thank-you']}
        </Toggle>
        <Toggle form={WORDS_FORM} name="inc_love_story" label="Love Story" on={inc.loveStory !== 'none'} tip="A short excerpt of your story on the Finer Details card." />
        <Toggle form={WORDS_FORM} name="inc_schedule" label="Schedule — the program" on={inc.schedule} tip="Only the moments your guests can see." />
        <Toggle
          form={WORDS_FORM}
          name="inc_mood_board"
          label="Mood Board — our colours"
          on={inc.moodBoard && hasPalette}
          disabled={!hasPalette}
          note={hasPalette ? null : (
            /* The Mood Board is an item of Details now — opened here, not linked out to. */
            <DetailsGoTo item="mood-board">Build your Mood Board first</DetailsGoTo>
          )}
        />
        <Toggle form={WORDS_FORM} name="inc_special_message" label="Special message" on={inc.specialMessage}>
          {/* The Words › Special message editor — one field, two doors. */}
          {facts['special-message']}
        </Toggle>
        <Toggle form={WORDS_FORM} name="inc_rsvp" label="Kindly reply" on={inc.rsvp} tip="A host or your coordinator, read from their account — or type it in.">
          {kindlyReply}
        </Toggle>
        {qrAlways}
        {save}
      </PrintPieceEditor>
    ),
    pass: (
      <PrintPieceEditor input={prints} piece="pass">
        <Toggle form={WORDS_FORM} name="inc_guest_names" label="Guest list — names on passes" on={inc.guestNames} />
        {qrAlways}
        {save}
      </PrintPieceEditor>
    ),
    entourage: <PrintPieceEditor input={prints} piece="entourage" />,
    menu: <PrintPieceEditor input={prints} piece="menu" menu={menu} />,
    poster: <PrintPieceEditor input={prints} piece="poster" />,
    card: <PrintPieceEditor input={prints} piece="card" />,
    download: <PrintSetDownloads input={prints} />,
    /* ── Words ── */
    'special-message': facts['special-message'],
    'thank-you': facts['thank-you'],
    'opening-line': (
      <div className="flex flex-col gap-2" data-details-words="opening-line">
        {openingLine}
        {printsOn('invitation')}
        {save}
      </div>
    ),
    'kindly-reply': (
      <div className="flex flex-col gap-2" data-details-words="kindly-reply">
        <p className="text-sm text-ink/80">Who guests reply to</p>
        {kindlyReply}
        {printsOn('details')}
        {save}
      </div>
    ),
    /* ── Story & plans — each tool's picked piece's controls ── */
    ...(loveStory
      ? {
          'love-story': facts['love-story'] ?? (
            /* An unread story is SAID — never a words form that would save it empty. */
            <p role="alert" className="text-sm text-terracotta-700">
              Your story’s words could not be read just now. Nothing was changed — please reopen this in a moment.
            </p>
          ),
        }
      : {}),
    ...(schedule ? { schedule: <ScheduleSlots /> } : {}),
    ...(rsvp ? { rsvp: rsvp.settings } : {}),
    ...(look
      ? {
          'mood-board': look.moodBoardControls,
          hero: <DetailsLookEditor item="hero" />,
          reveal: <DetailsLookEditor item="reveal" />,
        }
      : {}),
  };
  for (const f of free) {
    editors[f.key] =
      f.key === 'seat-plan' ? (
        <div className="flex flex-col gap-3">
          {f.editor}
          <Toggle form={WORDS_FORM} name="inc_seat_plan" label="Offer a seat plan with the set" on={inc.seatPlan !== 'none'} tip="Prints your seating chart from the Seat plan you already made.">
            <Segmented form={WORDS_FORM} name="seat_plan_kind" value={inc.seatPlan === 'none' ? 'list' : inc.seatPlan} options={[['3d', '3D'], ['2d', '2D'], ['list', 'List']]} />
          </Toggle>
          {inc.seatPlan === '3d' ? <SeatPlan3dNote eventId={eventId} /> : null}
          {save}
        </div>
      ) : (
        f.editor
      );
  }
  if (ye) Object.assign(editors, ye.editors);
  /* 🪑 The seat plan's right part is its guests — the editor draws them here. */
  if (seatPlan) editors.seating = <SeatPlanSlot name="guests" className="flex flex-col" />;

  return (
    <ThemePickProvider eventId={eventId} current={theme.current}>
      <DetailsWorkspace
        groups={groups}
        bodies={bodies}
        editors={editors}
        initial={startItem}
        guide={guide}
        /* 🧩 Each moved tool's pieces, in the navigator (DECISION_LOG "A TOOL
           MOVED INTO THE MAKER IS REBUILT INTO THE THREE PARTS"). */
        pieces={{
          ...(look
            ? {
                'mood-board': <MoodBoardPieces makeItReal={!theme.storeShell} />,
                hero: <DetailsLookPieces item="hero" />,
                reveal: <DetailsLookPieces item="reveal" />,
              }
            : {}),
          /* Part 2b: Love Story's chapters, the Schedule's moments, RSVP's settings. */
          ...(loveStory
            ? { 'love-story': <ItemPieces item="love-story" pieces={LOVE_STORY_CHAPTERS.map((c) => ({ key: c, label: LOVE_STORY_CHAPTER_LABEL[c] }))} /> }
            : {}),
          ...(schedule?.pieces.length ? { schedule: <ItemPieces item="schedule" pieces={schedule.pieces} /> } : {}),
          ...(rsvp ? { rsvp: <ItemPieces item="rsvp" pieces={RSVP_PIECES} /> } : {}),
          /* Part 2a: the Wedding March's sections and lines, the parents and hosts. */
          ...(ye?.pieces ?? {}),
          /* Part 4: the place's elements — the seating editor draws its rows here. */
          ...(seatPlan
            ? { seating: <SeatPlanSlot name="place" className="contents lg:flex lg:flex-col lg:gap-0.5" /> }
            : {}),
        }}
        persistent={
          <>
            {flash === 'saved' ? (
              <p role="status" className="rounded-md border border-success-300/60 bg-success-50 px-4 py-2 text-sm text-success-800">
                Saved.
              </p>
            ) : flash === 'error' ? (
              <p role="alert" className="rounded-md border border-danger-300/60 bg-danger-50 px-4 py-2 text-sm text-danger-800">
                That did not save. Nothing changed — please try again.
              </p>
            ) : null}
            {/* The print words form: its switches and lines sit in the items
                above (`form=`); this is the one post they all go through. */}
            <form id={WORDS_FORM} action={PRINT_WORDS_ENDPOINT} method="post" data-details-include="" className="mt-2">
              {/* Said BESIDE every Save that posts this form (`SaveWords`), not
                  under every editor: under a drafted one (the special message,
                  the Love Story) it read as a contradiction. */}
              <HubSavesImmediately className="sr-only" />
              <input type="hidden" name="event_id" value={eventId} />
              {/* The include marker: a posted form ALWAYS carries it, so an
                  all-off form still saves "off" instead of looking like no answer. */}
              <input type="hidden" name="include_form" value="1" />
              {/* 🧷 Saves in place — never a whole-page reload (owner 2026-09-28). */}
              <SoftPost />
            </form>
          </>
        }
      />
    </ThemePickProvider>
  );
}

/**
 * A Look item as the navigator draws it — plain words that fit every kind of
 * event (DECISION_LOG 2026-09-29 "THE PLAN ADAPTS TO EVERY EVENT TYPE"): no
 * item here names a wedding, a couple or a bride. "Used on" names the stages
 * in their one vocabulary (`PUBLIC_STAGE_LABELS`, handed in) and the prints.
 */
function lookLabel(
  k: LookItemKey,
  look: NonNullable<MakerDetailsProps['look']>,
  hasPalette: boolean,
): Omit<DetailsItemModel, 'key' | 'group'> & { icon: ReactNode } {
  switch (k) {
    case 'mood-board':
      return {
        label: 'Mood Board',
        sub: 'Your colours',
        done: hasPalette,
        usedOn: ['The Finer Details', 'QR code colours', 'Your suppliers'],
        icon: <Palette aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
      };
    case 'logo':
      return {
        label: 'Logo',
        done: look.logoDone,
        usedOn: ['Hero', 'QR code'],
        icon: <Gem aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
      };
    case 'hero':
      return {
        label: 'Hero',
        done: look.heroDone,
        usedOn: look.heroOn,
        icon: <PanelTop aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
      };
    case 'reveal':
      return {
        label: 'Reveal',
        done: look.revealDone,
        usedOn: look.revealOn,
        icon: <MailOpen aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
      };
  }
}

/** Save for the print words form — every item that has switches shows one. */
function SaveWords() {
  return (
    <div className="flex items-center gap-3 pt-1">
      <button type="submit" form={WORDS_FORM} className="button-primary text-sm">
        Save
      </button>
      <span className="text-xs text-ink/55">The card redraws.</span>
      <HubSavesImmediately />
    </div>
  );
}

/**
 * One include item: its name on the left, an ⓘ when it needs one, a single-knob
 * switch on the right (owner: "toggles are better"). Its field shows under it
 * only while it is ON — CSS alone (`group-has`), so it works before hydration.
 * `form` joins it to the print words form wherever it is drawn.
 */
function Toggle({
  form,
  name,
  label,
  on,
  tip,
  disabled = false,
  note = null,
  children,
}: {
  form: string;
  name: string;
  label: string;
  on: boolean;
  tip?: string;
  disabled?: boolean;
  note?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="group/inc flex flex-col gap-2 border-b border-ink/5 py-2.5 last:border-0" data-include={name}>
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-sm text-ink">
          {/* InfoTip prints its own label beside the ⓘ — one name, never two. */}
          {tip ? (
            <InfoTip label={label} align="start">
              {tip}
            </InfoTip>
          ) : (
            label
          )}
        </span>
        <input form={form} type="checkbox" role="switch" name={name} defaultChecked={on} disabled={disabled} className="peer sr-only" />
        <span
          aria-hidden
          className="relative h-6 w-11 shrink-0 rounded-full bg-ink/20 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-terracotta-700 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-mulberry peer-disabled:opacity-40"
        />
      </label>
      {note ? <p className="text-xs text-ink/60">{note}</p> : null}
      {children ? (
        <div className="hidden flex-col gap-2 pl-1 group-has-[[role=switch]:checked]/inc:flex">{children}</div>
      ) : null}
    </div>
  );
}

/** A small segmented choice (radio buttons that look like one control). */
function Segmented({ form, name, value, options }: { form: string; name: string; value: string; options: Array<[string, string]> }) {
  return (
    <div role="radiogroup" className="inline-flex w-fit rounded-full bg-ink/5 p-0.5">
      {options.map(([v, label]) => (
        <label key={v} className="cursor-pointer">
          <input form={form} type="radio" name={name} value={v} defaultChecked={value === v} className="peer sr-only" />
          <span className="inline-flex min-h-9 items-center rounded-full px-3 text-[13px] font-medium text-ink/65 peer-checked:bg-white peer-checked:text-ink peer-checked:shadow-sm">
            {label}
          </span>
        </label>
      ))}
    </div>
  );
}

/**
 * "Kindly reply" — who guests reply to: a host or the coordinator, read from
 * their own account at print time, or the couple's own typed line. One field in
 * two doors (Words › Kindly reply and The Finer Details' switch), so each part
 * carries `data-same-field`.
 */
function KindlyReplyField({
  hosts,
  choice,
  manual,
}: {
  hosts: Array<{ moderatorId: string; label: string; contact: string | null }>;
  choice: string;
  manual: string;
}) {
  return (
    <>
      <select
        form={WORDS_FORM}
        name="rsvp_choice"
        data-same-field="rsvp_choice"
        defaultValue={choice}
        aria-label="Who guests reply to"
        className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink"
      >
        <option value="">Choose…</option>
        {hosts.map((h) => (
          <option key={h.moderatorId} value={`host:${h.moderatorId}`}>
            {h.label}
            {h.contact ? ` — ${h.contact}` : ' — no number on their account'}
          </option>
        ))}
        <option value="manual">Type it in…</option>
      </select>
      <input
        form={WORDS_FORM}
        name="rsvp_manual"
        data-same-field="rsvp_manual"
        defaultValue={manual}
        maxLength={160}
        aria-label="Reply line, typed in"
        placeholder="If you chose “Type it in”: e.g. Reply by Nov 18 · Claire, 0917 …"
        className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink"
      />
    </>
  );
}

/** A Words item's picture: the words as guests read them, or an honest empty line. */
function WordsCard({ text, note }: { text: string | null; note: string }) {
  const words = text?.trim() ?? '';
  return (
    <section data-details-words-card="" className="flex flex-col items-center gap-3 rounded-md bg-white/80 px-5 py-8 text-center shadow-[0_1px_2px_rgba(40,34,24,.06)]">
      {words ? (
        <p className="max-w-prose whitespace-pre-line font-serif text-xl leading-relaxed text-ink">{words}</p>
      ) : (
        <p className="text-sm text-ink/60">Not written yet — type it on the right.</p>
      )}
      <p className="text-xs text-ink/55">{note}</p>
    </section>
  );
}

/**
 * 🪑 The Seat plan as the navigator draws it — how many tables, how many are
 * seated, and whether guests see it (its "done": the door is open). Plain
 * words for every kind of event; a count that could not be read is SAID.
 */
function seatPlanRow(
  seatPlan: { tables: number | null; seated: number | null; open: boolean | null } | null,
): Omit<DetailsItemModel, 'key' | 'group'> & { icon: ReactNode; panelLabel: string } {
  const t = seatPlan?.tables ?? null;
  const n = seatPlan?.seated ?? null;
  const sub =
    t === null || n === null
      ? 'Could not be read just now'
      : t === 0
        ? 'No tables yet'
        : `${t} ${t === 1 ? 'table' : 'tables'} · ${n} seated${seatPlan?.open ? ' · guests see it' : ''}`;
  return {
    label: 'Seat plan',
    sub,
    done: seatPlan?.open ?? undefined,
    usedOn: [PUBLIC_STAGE_LABELS.event, 'Table signs', 'Passes', 'Find your seat'],
    icon: <Armchair aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
    panelLabel: 'Guests',
  };
}
