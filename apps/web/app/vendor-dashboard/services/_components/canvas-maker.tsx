'use client';

import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { createPortal } from 'react-dom';
import {
  Award,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Images,
  Info,
  Link2,
  List,
  ListChecks,
  MessageSquare,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Tag,
  Trash2,
  Truck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import Link from 'next/link';

import { Field } from '@/app/_components/forms/field';
import { SubmitButton } from '@/app/_components/submit-button';
import { FileUpload } from '@/app/_components/file-upload';
import { Fold } from '@/app/_components/fold';
import { InfoTip } from '@/app/_components/info-tip';
import { SWITCH_BUTTON, SWITCH_TRACK, SwitchTrack } from '@/app/_components/switch-track';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { ActionButton } from '@/components/action-button';
import { SupplierThumbRow } from '@/app/vendor-dashboard/_components/supplier-thumb-row';
import { SupplierSubmit } from '@/app/vendor-dashboard/_components/supplier-submit';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { allowedEventOptions, droppedEventTypes } from '@/lib/coverage-allowed-events';
import { packageAuthoringEnabled } from '@/lib/package-authoring-flag';
import {
  EMPTY_CANVAS_SNAPSHOT,
  canvasSnapshotKey,
  readCanvasFormSnapshot,
  type CanvasFormSnapshot,
} from '@/lib/canvas-form-snapshot';
import { readSnapshot, type Snapshot } from '@/lib/service-card-snapshot';
import { audienceGroups, type AudienceOption } from '@/lib/canvas-audience-groups';
import type { CanvasInitial } from '@/lib/canvas-initial';
import { clipPillLabel } from '@/lib/clip-duration-label';
import { coverageServesKey } from '@/lib/coverage-serves-key';
import { PROPOSE_CATEGORY_HREF } from '@/lib/service-picker-anchor';
import { rankTradeMatches, type TradeMatch } from '@/lib/kind-search-trades';
import { isTradeSearchMiss, collectiblePhraseFor } from '@/lib/collected-trade-phrase';
import {
  KEEP_VERSION,
  keepAgeLabel,
  keepStorageKey,
  readKeep,
  serializeKeep,
  type CanvasKeep,
} from '@/lib/canvas-draft-keep';
import {
  SUPPLIER_TYPE_WORD,
  coverageAskLine,
  makerDefaultsFor,
  makerStatus,
  supplierTypeForKind,
  type SupplierType,
} from '@/lib/service-card-maker';
import type { ScheduleItemDraft } from '@/lib/vendor-service-payment-schedules';
import type { VendorServiceTimeSlot } from '@/lib/vendor-time-slots';
import { formatSlotTime } from '@/lib/vendor-time-slots';

export type { AudienceOption };

import { PricingBasisEditor, IncludedFlags, PRICING_BASIS_OPTIONS, type Basis } from './pricing-basis-editor';
import {
  InclusionsEditor,
  DiscountsEditor,
  PriceBracketsEditor,
} from './service-list-editors';
import { ShowcaseMediaFields } from './showcase-media-fields';
import { CustomizationStep } from './customization-step';
import { AddonsEditor, type AddonDraft } from './addons-editor';
import { PaymentScheduleEditor } from './payment-schedule-editor';
import { ServiceCardFace } from './service-card-face';
import { commitVendorService, deleteVendorService } from '../actions';
import { canPublishService, inclusionsAreSet } from '@/lib/service-publish-gate';
import { priceWaitsFor, priceWaitsLine } from '@/lib/price-waits';
import { BOOKED_PRICE_STAYS_SUPPLIER, saysBookedPriceStays } from '@/lib/booked-price-words';
import {
  addCoverageForCard,
  updateCoverageServesInPlace,
  type CoverageServesResult,
} from '../coverage-actions';
import { formatCount } from '@/lib/format-number';
import { OverlayBackdrop } from '@/app/_components/overlay-backdrop';
import { markReturnAsNext, returnMovesOn } from '@/lib/return-moves-on';
import { revealFold } from '@/lib/reveal-sweep';
import { GiftPickRow } from '@/app/_components/gift-pick';
import { GIFT_SETNAYAN, coupleCardPackLine, giftPickOf, type GiftPick } from '@/lib/gift-pick';
import type { FreeByKind, ShopGiftPack } from '@/lib/shop-gifts';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { cardCheckInputKey, EMPTY_CARD_CHECK_INPUT, readCardCheckInput, type CardCheckInput } from '@/lib/service-card-checks';
import {
  CardChecksSummary,
  ClaimWordNotes,
  PhotoCheckNotes,
  ServiceMismatchNote,
  useCardChecks,
  type MakerCheckRules,
  type PhotoCheckAsk,
} from './card-checks';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE SERVICE CARD MAKER — the simpler supplier dashboard, step 3 (2026-10-14)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Translates `prototypes/supplier_easy_dashboard_2026-10-14_fable.html`, moments "2 · Putting up a service" and
 * "2 · The service card · every field" (owner ✅ APPROVE 2026-10-14):
 *
 *   · the shipped card face (`ServiceCardFace`) ON TOP, painting itself from the live form;
 *   · ONE status line under it — "Hidden until: a cover photo · a price · what's included" — asked of the publish
 *     gate, never of a list of its own (`makerStatus` → `unmetPublishRequirements`);
 *   · the FIRST QUESTIONS only: What you offer · Name (written for you) · Photos (one cover is enough) · Price
 *     ("from") · What's included (one line is enough) · Schedule (its own / shares one);
 *   · EVERY other field (the 92 of the 2026-10-08 truth table) under "More settings", in folds that open with the
 *     defaults for this supplier type (`makerDefaultsFor`) — and nothing pre-filled that governs money;
 *   · ONE Create (owner 2026-10-08 Q3): live when the three are in, else saved "not shown yet" — and an existing
 *     card is the SAME screen with Save (Q2: its name editable).
 *
 * ── WHAT IS KEPT FROM THE CANVAS (Rule 0) ───────────────────────────────────
 * The one `<form action={commitVendorService}>` with the shipped field names; the shipped editors, mounted whole;
 * the kind list with the shop's own words first, every live trade searchable and a refused kind disabled with its
 * reason; the half-finished card kept on the device and OFFERED back; the name written for them; the couple-seeded
 * card whose price waits; the audience as a sibling form that saves in place.
 *
 * 🔴 WHY THE FIELDS LEFT THE SHEETS. Since 2026-09-07 (a1e6887ceb) every sheet portalled to `<body>` to escape a
 * transformed ancestor — and the photo, price, gift, what's-included, discount, crew and lead-time inputs lived in
 * those sheets. A portalled input is OUTSIDE the `<form>` in the DOM, so `new FormData(form)` never saw it: the
 * card never painted a price, Publish never opened, and a draft saved kind + name + coverage only. Measured in the
 * lab 2026-10-14 (controller-2026-10-12/supplier-easy-3/shots/before-portal-proof.png). Every field now lives in an
 * in-page fold (`Fold` keeps a shut fold's fields mounted), and a sheet carries only choices that write a hidden
 * input the form owns (the kind) or a form of its own (who it's for · delete).
 *
 * 🏷 A CARD IN A NEW CATEGORY ASKS ONCE (owner 2026-10-14). On Create, when the kind is not in the shop's coverage,
 * one question — "Add <kind> to what you do? Couples will find you there." Yes → `addCoverageForCard` (its own call;
 * the card's save never writes coverage), within the plan's family cap; over the cap the plan option is shown and the
 * card still saves. Not now → the card saves; its row says "not in what you do".
 */

type OtherCategory = { value: string; label: string };
/**
 * The kinds of service a shop can make a card for, in the SAME groups and with the SAME live taxonomy labels as My
 * Shop's picker — one list, drawn twice.
 */
export type CategoryChoice = OtherCategory & {
  /**
   * 'covered' — a family this shop already works in · 'open' — a new family its plan still has room for · 'locked'
   * — the save would refuse it. Decided by the same functions the save enforces (`lib/vendor-category-parents.ts`).
   */
  standing: 'covered' | 'open' | 'locked';
  /** Why it is refused, in the vendor's own words. Only on 'locked'. */
  why?: string;
  /** The branch a search-found TRADE sits under — small type beside the name (C1 2026-08-28). */
  hint?: string;
};
export type CategoryGroup = { key: string; label: string; options: CategoryChoice[] };
export type CoverageAudience = { eventTypes: string[]; faiths: string[] };

/** One schedule the card may book on (an active `vendor_schedule_pools` row). */
export type MakerSchedule = { id: string; name: string; perDay: number | null };

/** An existing card, opened in the maker (the edit sheet). */
export type MakerEditing = {
  serviceId: string;
  isActive: boolean;
  /** The cover the card shows now — the face draws it while the key is unchanged. */
  coverUrl: string | null;
  coverKey: string | null;
  dailyCapacity: string;
  branchId: string;
  schedule: ScheduleItemDraft[];
  addons: AddonDraft[];
  slots: VendorServiceTimeSlot[];
  /** The schedule the card books on now. */
  poolId: string | null;
  /** The retired free-text promise, shown read-only when the card still carries one. */
  legacyPromise: string | null;
};

type SheetKey = 'kind' | 'audience' | 'ask' | 'delete';

const line = 'var(--m-line)';
const paper = 'var(--m-paper)';
/**
 * 🔑 THE CARD FORM'S ID. Every card field is a DOM descendant of this <form> (in-page folds, never a sheet — a sheet
 * portals to <body>, see CanvasSheet); the thumb row's Create names it with `form=`. One maker per page.
 */
export const CARD_FORM_ID = 'card-maker-form';
/** The "More settings" fold's id — the first-open reveal finds it by this. */
const MORE_ANCHOR = 'maker-more-settings';
/**
 * 📐 THE ONE RHYTHM (makers prototype 7 Nov 2026 § 3): a label · its 48 px box · a quiet hint; a topic after the first
 * opens with a divider, never a box around the group. Frames only on what you press (the boxes).
 */
const LAB = 'mb-1.5 flex items-center gap-2 text-[14px] font-medium text-ink';
const SMALL = 'text-[12px] font-normal text-ink/50';
const BOX = 'h-12 w-full rounded-xl border border-ink/15 bg-raised px-4 text-[15px] text-ink outline-none focus:border-sn-accent'; // no-card-ok: the class of a text <input> (a field you type in, not a box)
const HINT = 'mt-1.5 text-[12px] leading-snug text-ink/55';
const TOPIC = 'border-t border-ink/10 pt-5';

// ════════════════════════════════════════════════════════════════════════════
// The maker
// ════════════════════════════════════════════════════════════════════════════

export function CanvasMaker({
  categoryValue,
  categoryLabel,
  otherCategories,
  coverages = [],
  vendorProfileId,
  claimToken = null,
  eventTypeOptions = [],
  faithOptions = [],
  coverageAudience = {},
  coverageAllowed = {},
  initial = null,
  categoryOptions = [],
  firstCardEver = false,
  coverageNames = [],
  shopName = '',
  tradeOptions = [],
  supplierType = 'other',
  folderOfKind = {},
  coverageAsk = {},
  schedules = [],
  scheduleOfKind = {},
  branches = [],
  detailsSlot = null,
  detailsKind = null,
  recordSlot = null,
  editing = null,
  bookedNow,
  deleteGate = null,
  errorLine = null,
  returnTo,
  unread = [],
  discountSeed = null,
  giftPacks = null,
  giftFree = null,
  cancelHref,
  bookingsPerDate = null,
  checkRules = null,
  photoCheck,
}: {
  categoryValue: string;
  categoryLabel: string;
  otherCategories: OtherCategory[];
  coverages?: { id: number; label: string }[];
  vendorProfileId: string;
  /** PR-C claim passthrough — identical contract to <ServiceWizard>. */
  claimToken?: string | null;
  /** Live `event_type_vocab`, for the audience sheet. Empty = section hidden. */
  eventTypeOptions?: AudienceOption[];
  /** FAITH_REGISTRY, for the audience sheet. */
  faithOptions?: AudienceOption[];
  /** coverage id → its CURRENT event_types / faiths, so the chips open truthful. */
  coverageAudience?: Record<number, CoverageAudience>;
  /** coverage id → the leaf's allowed event types (null = unrestricted) — the SAME set the server enforces. */
  coverageAllowed?: Record<number, string[] | null>;
  /**
   * "Start from one of your cards" (and an existing card's values on the edit sheet) — what the vendor AUTHORED,
   * read server-side (lib/vendor-card-copy.ts). `null` is a blank maker.
   */
  initial?: CanvasInitial | null;
  /**
   * The kind is a field on the card (owner 2026-08-28). `/services/new` hands in the whole list; a route that fixed
   * the kind passes none and the row shows the kind without a sheet.
   */
  categoryOptions?: CategoryGroup[];
  /** Has this shop never made a card? (Kept for the callers; the simpler maker asks nothing extra of a first card.) */
  firstCardEver?: boolean;
  /** What this shop calls the things it covers, in ITS OWN words. */
  coverageNames?: string[];
  /** Used only to write a first card name they can change. */
  shopName?: string;
  /** Every live trade, for the search band (C1 2026-08-28) — searched only once a supplier types. */
  tradeOptions?: TradeMatch[];
  /** The shop's type — "Common for a caterer" heads the kind sheet. */
  supplierType?: SupplierType;
  /** A coverage leaf's tier-1 family, for the defaults by supplier type. */
  folderOfKind?: Record<string, string>;
  /** 🏷 kinds that would add a leaf to "what you do" → the leaf's label (server-decided). */
  coverageAsk?: Record<string, { leaf: string; label: string }>;
  /** The shop's schedules (active pools) the Schedule row may share. */
  schedules?: MakerSchedule[];
  /** category → the pool its cards book on today (the category pool), when one exists. */
  scheduleOfKind?: Record<string, string>;
  /** Branches (Enterprise). A lapsed one is listed `usable: false` so a card filed under it keeps naming it. */
  branches?: { id: string; label: string; usable?: boolean }[];
  /** The kind's chip details, server-rendered (`RefinementsEditor bare`) — inside this form, posting with it. */
  detailsSlot?: ReactNode;
  /** The kind `detailsSlot` was drawn for — shown only while the card is that kind. */
  detailsKind?: string | null;
  /** The card's collected record, server-rendered (`CardRecordSection`), on the edit sheet. */
  recordSlot?: ReactNode;
  /** An existing card → the edit sheet: Save, the Live switch, delete and copy. */
  editing?: MakerEditing | null;
  /**
   * 🔒 How many bookings this card has (`readCardBookedCount`) — `null` = could not be read, `undefined` = not measured
   * (a new card, a lab). A booked or unread card says on its price row that a booking holds its agreed price
   * (`BOOKED_PRICE_STAYS_SUPPLIER`, DECISION_LOG 2026-11-10 "WHAT YOU BOOK IS YOUR PRICE").
   */
  bookedNow?: number | null;
  /**
   * 🔒 THE DELETE SHEET'S TWO FACES (owner 10 Nov on PR #7464): `refusal` set → this card has an open booking (each named
   * on its own line, `openBookingsRefusal`) and the sheet offers no Delete; else `lines` is the warning said BEFORE
   * anything is deleted (`deleteWarningLines`). Absent (labs, the new-card maker) → the old one-line sheet.
   */
  deleteGate?: { refusal: string | null; lines: readonly string[] } | null;
  /** A refusal carried back on the address (`?error=`), said on the card. */
  errorLine?: string | null;
  /** This screen's own address — the save returns here with a refusal. */
  returnTo?: string;
  /**
   * Parts of an existing card that could not be read. The save REPLACES these lists, so saving over an unread one
   * would erase it — Save waits, and the card says what could not be read (never "none").
   */
  unread?: string[];
  /** Arrived from the off-season nudge: Discounts opens with one off-peak line drafted (the supplier sets the amount). */
  discountSeed?: { expiry?: string; conditions?: string } | null;
  /** The giftable packs on the live catalogue, for the Gift dropdown — null = unread (only No gift · Setnayan gift). */
  giftPacks?: ShopGiftPack[] | null;
  /** What this shop can still offer of each gift kind — null = unread (packs listed as unreadable, never as empty). */
  giftFree?: FreeByKind | null;
  /** Where Cancel goes. Default: Shop for a saved card, Services for a new one. */
  cancelHref?: string;
  /**
   * A card's bookings per date, inside the plan (owner 2026-11-06 — Solo 1 · Pro 3 · Ultra 5, plus any bought "+1
   * booking per date"). `cap` bounds the field; `help` says the cap and the Ultra add-on. Null / null fields = no plan
   * cap (Free · Verified, not ruled yet).
   */
  bookingsPerDate?: { cap: number | null; help: string | null } | null;
  /**
   * 🃏 THE CARD CHECKS — FIX BEFORE CREATE (owner 2026-10-26): the claim words this shop may not use and the live
   * trades with their reviewed aliases (`loadMakerContext` → `lib/service-card-checks.server.ts`). Each problem shows on
   * its row and Create / Save waits; the save asks again. `null` = the page read nothing (the save still checks).
   */
  checkRules?: MakerCheckRules | null;
  /** The photo ask — omit it (the app's server action). Only `/dev/card-maker-lab` hands in a fixture one. */
  photoCheck?: PhotoCheckAsk;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const isEdit = editing !== null;
  // The simpler maker asks a first card nothing extra (the old intro sheet retired with the guided pass).
  void firstCardEver;

  const [sheet, setSheet] = useState<SheetKey | null>(null);
  const [kindQuery, setKindQuery] = useState('');
  /**
   * 🔑 THE POSTED CATEGORY IS STATE, NOT THE PROP. It is one hidden input under its shipped name either way, so
   * `commitVendorService` cannot tell which screen chose it.
   */
  const allChoices = useMemo(
    () => categoryOptions.flatMap((g) => g.options),
    [categoryOptions],
  );
  const coveredChoices = useMemo(
    () => allChoices.filter((o) => o.standing === 'covered'),
    [allChoices],
  );
  /** The one sentence explaining every refused kind — once, not once per row. */
  const lockedWhy = useMemo(
    () => allChoices.find((o) => o.standing === 'locked' && o.why)?.why ?? null,
    [allChoices],
  );
  /**
   * The kinds ALWAYS on this screen — the "Common for …" band, drawn whatever is typed. A ranked trade with the same
   * key must not render twice. (Since 2026-11-04 the folds below hold every live trade, so they are not in this set —
   * that would empty the search band; instead a fold hides whatever the band is already showing: `rankedKeys`.)
   */
  const existingKindValues = useMemo(
    () => new Set(coveredChoices.map((o) => o.value)),
    [coveredChoices],
  );
  /** "Matches what you typed" — the live trades, ranked by the shared ranker; [] below the minimum query. */
  const rankedTrades = useMemo(
    () => rankTradeMatches(tradeOptions, kindQuery, existingKindValues),
    [tradeOptions, kindQuery, existingKindValues],
  );
  /** What the search band shows now — a fold below does not list it a second time. */
  const rankedKeys = useMemo(() => new Set(rankedTrades.map(({ key }) => key)), [rankedTrades]);
  /** C3 2026-08-28 — every live trade key the search band can return (what a resolved miss may teach). */
  const liveTradeKeySet = useMemo(() => new Set(tradeOptions.map((t) => t.key)), [tradeOptions]);
  /** Did ANY legacy kind's own label match the query? The SAME filter the list below draws with. */
  const anyLegacyLabelMatches = useMemo(() => {
    const q = kindQuery.trim().toLowerCase();
    return categoryOptions.some((g) =>
      g.options.some((o) => o.standing !== 'covered' && o.label.toLowerCase().includes(q)),
    );
  }, [categoryOptions, kindQuery]);
  /** THE ONE PLACE THAT DECIDES A MISS — imported, never re-derived. */
  const kindSearchMissed = useMemo(
    () =>
      isTradeSearchMiss({
        query: kindQuery,
        rankedTradeCount: rankedTrades.length,
        anyLegacyLabelMatches,
      }),
    [kindQuery, rankedTrades, anyLegacyLabelMatches],
  );
  /** The latest query that missed, held across a cleared box, dropped by a later query that found something. */
  const [lastMissedQuery, setLastMissedQuery] = useState<string | null>(null);
  useEffect(() => {
    const q = kindQuery.trim();
    if (kindSearchMissed) {
      setLastMissedQuery(q);
    } else if (q.length > 0) {
      setLastMissedQuery(null);
    }
  }, [kindQuery, kindSearchMissed]);
  /** Set only when the pending miss resolved into a live trade — posted as `collected_kind_phrase`. */
  const [collectPhrase, setCollectPhrase] = useState<string | null>(null);
  /** ⚡ A ONE-TRADE SHOP IS ASKED NOTHING — its one kind is pre-picked, and the row says where it came from. */
  const [category, setCategory] = useState(
    categoryValue || (coveredChoices.length === 1 ? (coveredChoices[0]?.value ?? '') : ''),
  );
  const categoryRef = useRef('');
  /** Once they touch the name, nothing writes it again. */
  const titleTouched = useRef(false);
  const [kindFromShop, setKindFromShop] = useState(
    !categoryValue && coveredChoices.length === 1,
  );
  const canChooseKind = categoryOptions.length > 0 && !isEdit;
  useEffect(() => {
    categoryRef.current = category;
  }, [category]);

  /** THE ONE PLACE A KIND IS PICKED (C3 2026-08-28) — every row in the kind sheet routes through here. */
  const pickCategory = useCallback(
    (key: string) => {
      setCategory(key);
      setKindFromShop(false);
      setCollectPhrase(
        collectiblePhraseFor({ missedQuery: lastMissedQuery, pickedKey: key, liveTradeKeys: liveTradeKeySet }),
      );
      setLastMissedQuery(null);
    },
    [lastMissedQuery, liveTradeKeySet],
  );

  const keepKey = keepStorageKey(vendorProfileId);
  const [offeredKeep, setOfferedKeep] = useState<CanvasKeep | null>(null);
  const [keepDecided, setKeepDecided] = useState(false);

  /**
   * ═══ THE HALF-FINISHED CARD IS KEPT (owner 2026-08-28: *"add it"*) ════════
   * What was typed is held in this browser (never in our database) and OFFERED BACK on return — never restored
   * silently. An existing card and a copy are exempt: they asked for THAT card.
   */
  const clearKeep = useCallback(() => {
    try {
      window.localStorage.removeItem(keepKey);
    } catch {
      /* storage can refuse outright; nothing here is worth an error for */
    }
  }, [keepKey]);

  useEffect(() => {
    if (initial !== null || isEdit) return;
    try {
      const found = readKeep(window.localStorage.getItem(keepKey), Date.now());
      if (found) setOfferedKeep(found);
    } catch {
      /* unreadable storage simply means nothing was kept */
    }
  }, [keepKey, initial, isEdit]);

  /** Hold what is on the form, a moment after typing stops. File pickers are skipped; their hidden keys are not. */
  useEffect(() => {
    const form = formRef.current;
    if (!form || isEdit) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const hold = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const fields: [string, string][] = [];
        for (const el of Array.from(form.elements)) {
          const node = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
          if (!node.name) continue;
          const type = (node as HTMLInputElement).type;
          if (type === 'file' || type === 'submit' || type === 'button') continue;
          if ((type === 'checkbox' || type === 'radio') && !(node as HTMLInputElement).checked)
            continue;
          fields.push([node.name, node.value]);
        }
        const raw = serializeKeep({
          v: KEEP_VERSION,
          at: Date.now(),
          category: categoryRef.current,
          fields,
        });
        if (!raw) return;
        try {
          window.localStorage.setItem(keepKey, raw);
        } catch {
          /* full or blocked storage must never break the maker */
        }
      }, 800);
    };
    form.addEventListener('input', hold);
    form.addEventListener('change', hold);
    form.addEventListener('submit', clearKeep);
    return () => {
      if (timer) clearTimeout(timer);
      form.removeEventListener('input', hold);
      form.removeEventListener('change', hold);
      form.removeEventListener('submit', clearKeep);
    };
  }, [keepKey, clearKeep, isEdit]);

  /**
   * Put a kept card back. React-owned fields (name, kind, coverage) go through state; everything inside the shipped
   * editors is uncontrolled, so its value goes on the node and an `input` event lets the face repaint.
   */
  const restoreKeep = useCallback((keep: CanvasKeep) => {
    const form = formRef.current;
    if (keep.category) {
      setCategory(keep.category);
      setKindFromShop(false);
    }
    for (const [name, value] of keep.fields) {
      if (name === 'title') setTitle(value);
      else if (name === 'coverage_id') setCoverageId(value);
      else if (name === 'category') continue;
      else if (form) {
        const node = form.elements.namedItem(name);
        const target = (
          node instanceof RadioNodeList ? node.item(0) : node
        ) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
        if (!target || !('value' in target)) continue;
        if (target instanceof HTMLInputElement && (target.type === 'checkbox' || target.type === 'radio')) {
          target.checked = true;
        } else {
          target.value = value;
        }
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    setKeepDecided(true);
  }, []);

  const activeCategoryLabel =
    categoryOptions
      .flatMap((g) => g.options)
      .find((o) => o.value === category)?.label ??
    (category === categoryValue ? categoryLabel : category);

  /** ✍ THE NAME IS WRITTEN FOR THEM — only on a maker they have not typed into, never over an existing name. */
  useEffect(() => {
    if (titleTouched.current) return;
    if (initial !== null || isEdit) return;
    if (!category || !activeCategoryLabel) return;
    setTitle(shopName ? `${activeCategoryLabel} by ${shopName}`.slice(0, 80) : activeCategoryLabel);
  }, [category, activeCategoryLabel, shopName, initial, isEdit]);

  /** "Comes with" bundles the shop's OTHER cards — never the kind this card is. */
  const otherCategoriesShown = useMemo(
    () => otherCategories.filter((c) => c.value !== category),
    [otherCategories, category],
  );
  const [title, setTitle] = useState(initial?.title ?? '');
  /**
   * 🎁 THE CARD'S ONE GIFT — No gift · Setnayan gift · one of the shop's own packs (owner 7 Nov 2026: the shipped
   * Setnayan-gift switch becomes one Gift dropdown that also offers the shop's gifts). The Setnayan gift is still the
   * supplier's yes/no (owner 2026-09-09) and still posts `on` / `off` every time — an unchecked box would be
   * indistinguishable from "never asked".
   *
   * ⚖ NOT PRE-FILLED. A new card starts with No gift: the shipped gift is added to the supplier's lock bill (≤ 40% of
   * the booking fee), and a pack leaves the shop's own stock — neither is chosen for them.
   */
  const [giftPick, setGiftPick] = useState<GiftPick>(() =>
    giftPickOf({ includes_setnayan_gift: initial?.includesSetnayanGift ?? false, gift_pack_code: initial?.giftPackCode ?? null }),
  );
  const [snap, setSnap] = useState<CanvasFormSnapshot>(EMPTY_CANVAS_SNAPSHOT);
  const [face, setFace] = useState<Snapshot | null>(null);
  /** 🃏 What the card checks read off the form — the same live read, its own key. */
  const [checkInput, setCheckInput] = useState<CardCheckInput>(EMPTY_CARD_CHECK_INPUT);
  const [clipSeconds, setClipSeconds] = useState<number | null>(null);
  const onClipDurationSeconds = useCallback((s: number | null) => setClipSeconds(s), []);

  // Which coverage this card sits in — one hidden input on the card form, picked in "Who it is for".
  const [coverageId, setCoverageId] = useState<string>(initial?.coverageId ?? '');
  const selectedCoverage = coverageId ? Number(coverageId) : null;

  const [events, setEvents] = useState<string[]>([]);
  const [faiths, setFaiths] = useState<string[]>([]);
  // Re-seed the audience when the card moves to another coverage — never coverage A's audience under coverage B.
  const seededFor = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    if (seededFor.current === selectedCoverage) return;
    seededFor.current = selectedCoverage;
    const next =
      selectedCoverage != null
        ? (coverageAudience[selectedCoverage] ?? { eventTypes: [], faiths: [] })
        : { eventTypes: [], faiths: [] };
    setEvents(next.eventTypes);
    setFaiths(next.faiths);
  }, [selectedCoverage, coverageAudience]);

  const selectedAllowed =
    selectedCoverage != null ? (coverageAllowed[selectedCoverage] ?? null) : null;
  const audienceOptions = useMemo(
    () => allowedEventOptions(eventTypeOptions, selectedAllowed),
    [eventTypeOptions, selectedAllowed],
  );
  const droppedKeys = useMemo(
    () =>
      selectedCoverage != null
        ? droppedEventTypes(
            (coverageAudience[selectedCoverage] ?? { eventTypes: [] }).eventTypes,
            selectedAllowed,
          )
        : [],
    [selectedCoverage, coverageAudience, selectedAllowed],
  );
  const eventTypeLabel = useMemo(() => {
    const m = new Map(eventTypeOptions.map((e) => [e.key, e.label]));
    return (k: string) => m.get(k) ?? k;
  }, [eventTypeOptions]);

  /**
   * SAVING "WHO IT’S FOR" MUST NOT COST THE VENDOR THE CARD. It lands on `vendor_coverages` — a sibling form posting
   * `updateCoverageServesInPlace`, which reports here instead of navigating away.
   */
  const [audienceState, saveAudience] = useActionState<CoverageServesResult, FormData>(
    updateCoverageServesInPlace,
    { ok: false, message: null, savedKey: null },
  );
  const audienceSaved =
    audienceState.savedKey !== null &&
    audienceState.savedKey === coverageServesKey(coverageId, events, faiths);

  // ★ Customization ships behind the SAME flag as the wizard. It is CREATE-ONLY in the save (one run mints one
  // package), so the edit sheet never mounts it — a second mount would mint a second package.
  const customizationEnabled = packageAuthoringEnabled();

  /**
   * THE LIVE READ — the face must move while the vendor types. `click` is read a tick later (controlled hidden
   * inputs commit after the handler); a poll covers the editors that write hidden inputs with no DOM event; an
   * unchanged tick costs one FormData read and no render.
   */
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    let lastKey = '';
    let lastFace = '';
    let lastChecks = '';
    let deferred: ReturnType<typeof setTimeout> | null = null;
    const read = () => {
      try {
        const fd = new FormData(form);
        const next = readCanvasFormSnapshot(fd);
        const key = canvasSnapshotKey(next);
        if (key !== lastKey) {
          lastKey = key;
          setSnap(next);
        }
        const f = readSnapshot(fd);
        const fk = JSON.stringify(f);
        if (fk !== lastFace) {
          lastFace = fk;
          setFace(f);
        }
        const c = readCardCheckInput(fd);
        const ck = cardCheckInputKey(c);
        if (ck !== lastChecks) {
          lastChecks = ck;
          setCheckInput(c);
        }
      } catch {
        /* a mid-render read must never break the form */
      }
    };
    const readAfterCommit = () => {
      if (deferred) clearTimeout(deferred);
      deferred = setTimeout(read, 0);
    };
    read();
    // 🪤 EVERY live read waits a tick (supplier batch walk, 2026-10-15 — W1). This listener sits on the <form>, which
    // the event reaches BEFORE React's root listener: a synchronous setSnap/setFace there re-rendered the controlled
    // Name (`value={title}`) back to its old value before its onChange ran, so React saw no change and every keystroke
    // in Name was lost (both engines). Reading after the commit lets React take the keystroke first.
    form.addEventListener('input', readAfterCommit);
    form.addEventListener('change', readAfterCommit);
    form.addEventListener('click', readAfterCommit);
    const tick = setInterval(read, 400);
    return () => {
      form.removeEventListener('input', readAfterCommit);
      form.removeEventListener('change', readAfterCommit);
      form.removeEventListener('click', readAfterCommit);
      if (deferred) clearTimeout(deferred);
      clearInterval(tick);
    };
  }, []);

  const audienceLabel = useMemo(() => {
    const byKey = new Map(eventTypeOptions.map((e) => [e.key, e.label]));
    const evs = events.map((k) => byKey.get(k) ?? k);
    const faithByKey = new Map(faithOptions.map((f) => [f.key, f.label]));
    const fa =
      faiths.length === 0 ? 'any faith' : faiths.map((k) => faithByKey.get(k) ?? k).join(', ');
    if (evs.length === 0) return 'Pick the events this card is found under';
    return `${evs.slice(0, 3).join(' · ')}${evs.length > 3 ? ` +${evs.length - 3}` : ''} · ${fa}`;
  }, [events, faiths, eventTypeOptions, faithOptions]);

  /**
   * 🔒 ON A COUPLE-SEEDED CARD THE PRICE BOX WAITS (owner 2026-10-07 / ruled 2026-10-10): a supplier who joined
   * through a couple's link fills in their photo and what's included BEFORE they set the price. The recorded price
   * still posts and still shows; only the box that edits it waits.
   */
  const priceFacts = { hasCover: snap.hasCover, hasInclusions: inclusionsAreSet(snap.inclusionLabels) };
  const priceWaits = priceWaitsFor({ fromCoupleLink: Boolean(claimToken), ...priceFacts });

  // ── The supplier type this card is for, and the defaults it opens with ────
  const kindType: SupplierType = category
    ? supplierTypeForKind(category, folderOfKind[category] ?? null)
    : supplierType;
  const defaults = makerDefaultsFor(kindType, category);
  const [basis, setBasis] = useState<Basis>(
    initial?.pricing.pricing_basis ?? makerDefaultsFor(
      categoryValue ? supplierTypeForKind(categoryValue, folderOfKind[categoryValue] ?? null) : supplierType,
      categoryValue,
    ).pricingBasis,
  );
  // A new card follows its kind's default basis until they pick one themselves.
  const basisTouched = useRef(initial !== null || isEdit);
  useEffect(() => {
    if (basisTouched.current || !category) return;
    setBasis(defaults.pricingBasis);
  }, [category, defaults.pricingBasis]);

  // ── The status line and the one Create ───────────────────────────────────
  const facts = { hasPrice: snap.hasPrice, hasCover: snap.hasCover, hasInclusions: inclusionsAreSet(snap.inclusionLabels) };
  const [liveOn, setLiveOn] = useState(editing?.isActive ?? false);
  const gateOpen = canPublishService(facts);
  const status = makerStatus(
    { ...facts, hasKind: category.length > 0 },
    { editing: isEdit, live: isEdit ? liveOn : undefined },
  );
  /** Create: live when the gate is met, else saved "not shown yet" (Q3). Save: what the Live switch says. */
  const publishValue = isEdit ? (liveOn ? 'true' : 'false') : gateOpen ? 'true' : 'false';
  // A card that is NOT live cannot be switched on while the gate is unmet — the switch waits, the line says why.
  const liveSwitchWaits = isEdit && !editing?.isActive && !gateOpen && !liveOn;

  // ── Schedule row ─────────────────────────────────────────────────────────
  const kindPool = category ? (scheduleOfKind[category] ?? null) : null;
  const scheduleNow = isEdit ? (editing?.poolId ?? kindPool ?? 'own') : (kindPool ?? 'own');
  const [scheduleChoice, setScheduleChoice] = useState<string>(scheduleNow);
  useEffect(() => {
    if (!isEdit) setScheduleChoice(kindPool ?? 'own');
  }, [kindPool, isEdit]);
  const scheduleOptions = [
    { key: 'own', label: 'Its own schedule' },
    ...schedules.map((s) => ({ key: s.id, label: `${s.name} schedule` })),
  ];
  const sharedSchedule = schedules.find((s) => s.id === scheduleChoice) ?? null;
  const scheduleLine = sharedSchedule
    ? `Shares ${sharedSchedule.name}${sharedSchedule.perDay ? ` · ${formatCount(sharedSchedule.perDay)} a day` : ''}`
    : 'Its own';

  // ── 🏷 the one question ───────────────────────────────────────────────────
  const ask = !isEdit && category ? (coverageAsk[category] ?? null) : null;
  const [askAnswered, setAskAnswered] = useState<string | null>(null); // the kind it was answered for
  const [askResult, setAskResult] = useState<
    | null
    | { tone: 'ok'; text: string }
    | { tone: 'plan'; text: string }
    | { tone: 'bad'; text: string }
  >(null);
  const [asking, startAsking] = useTransition();
  const [submitNext, setSubmitNext] = useState(false);
  useEffect(() => {
    if (!submitNext) return;
    setSubmitNext(false);
    formRef.current?.requestSubmit();
  }, [submitNext]);
  const answerAsk = (answer: 'yes' | 'no') => {
    if (!ask) return;
    if (answer === 'no') {
      setAskAnswered(category);
      setSheet(null);
      setSubmitNext(true);
      return;
    }
    startAsking(async () => {
      const res = await addCoverageForCard(category);
      if (res.status === 'added' || res.status === 'already') {
        if (res.status === 'added' && res.coverageId != null) setCoverageId(String(res.coverageId));
        setAskAnswered(category);
        setAskResult({ tone: 'ok', text: `Added · couples will find you under ${ask.label}` });
        setSheet(null);
        setSubmitNext(true);
      } else if (res.status === 'over_cap') {
        setAskAnswered(category);
        setAskResult({ tone: 'plan', text: `${res.why} Your card still saves — a bigger plan lists you under ${ask.label} too.` });
      } else {
        setAskAnswered(category);
        setAskResult({ tone: 'bad', text: `${res.message} Your card still saves.` });
      }
    });
  };

  const [pending, setPending] = useState(false);
  // A card that is LIVE keeps its price (the gate's own rule for a live card) — Save waits while it is blank.
  const liveNeedsPrice = isEdit && liveOn && editing?.isActive === true && !snap.hasPrice;
  /**
   * 🃏 FIX BEFORE CREATE (owner 2026-10-26) — claim words · the card matches its service · one photo = one service
   * card. Each open problem is drawn on its row; Create (Save on an edit) waits until none is left. ./card-checks.tsx
   */
  const checks = useCardChecks({
    rules: checkRules,
    input: checkInput,
    category,
    categoryLabel: activeCategoryLabel,
    serviceId: editing?.serviceId ?? null,
    ask: photoCheck,
  });
  const moveTrade = checks.mismatch ? (tradeOptions.find((t) => t.key === checks.mismatch?.says.key) ?? null) : null;
  // A blocked photo under "More photos" opens that fold, so the photo it names is on screen.
  const showcaseBlocked = checks.photos.some((p) => p.where === 'showcase' && (p.verdict === 'another_shop' || p.verdict === 'this_shop'));
  const saveBlocked = unread.length > 0 || liveNeedsPrice || checks.open > 0;
  /**
   * 🎞 THE FIRST OPEN OF "MORE SETTINGS" SHOWS WHAT IS INSIDE (owner 2026-11-04: "when i opened more settings. we want
   * to scroll so the see all animating then return back to the first one which is price") — down to the last row, then
   * back with "Price · more" right under the head. Once per visit; a touch stops it; none under reduce motion.
   * lib/reveal-sweep.ts
   */
  const [moreOpen, setMoreOpen] = useState(discountSeed !== null);
  const moreRevealed = useRef(discountSeed !== null);
  const stopReveal = useRef<(() => void) | null>(null);
  const onMoreOpenChange = useCallback((next: boolean) => {
    setMoreOpen(next);
    if (!next) {
      stopReveal.current?.();
      return;
    }
    if (moreRevealed.current) return;
    moreRevealed.current = true;
    const fold = document.getElementById(MORE_ANCHOR);
    if (!fold) return;
    const lastRow = () => {
      const rows = fold.querySelectorAll<HTMLElement>('[data-maker-more] > [data-fold]');
      return rows[rows.length - 1] ?? null;
    };
    // 140 px: the thumb row (Preview · Create) that floats over the bottom of the screen.
    stopReveal.current = revealFold(fold, lastRow, { bottomInset: 140 });
  }, []);
  useEffect(() => () => stopReveal.current?.(), []);
  // Every one-line field's Return key reads "next" on a phone (set at the form, so the shared editors get it too).
  useEffect(() => {
    markReturnAsNext(formRef.current);
  });
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (saveBlocked) {
      e.preventDefault();
      return;
    }
    if (!category) {
      e.preventDefault();
      setSheet('kind');
      return;
    }
    // ✅ WHAT'S INCLUDED NEEDS AT LEAST ONE LINE (makers prototype 7 Nov 2026 § 3): Save says so under the field instead
    // of saving a card that can never be shown. Read from the form itself — the live snapshot can trail by a tick.
    if (!inclusionsAreSet(readCanvasFormSnapshot(new FormData(e.currentTarget)).inclusionLabels)) {
      e.preventDefault();
      setIncMissing(true);
      e.currentTarget.querySelector('[data-maker-row="included"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    if (ask && askAnswered !== category) {
      e.preventDefault();
      setAskResult(null);
      setSheet('ask');
    }
  };

  const typeWord = SUPPLIER_TYPE_WORD[supplierType];
  const fillWord = SUPPLIER_TYPE_WORD[kindType];

  // ── The one page of fields (makers prototype 7 Nov 2026 § 3) ──────────────
  const [aboutOpen, setAboutOpen] = useState(false);
  const [specOpen, setSpecOpen] = useState(false);
  const [priceMoreOpen, setPriceMoreOpen] = useState(false);
  // Copied options open, so they are checked before saving (the copied-from note asks for exactly that).
  const [optionsOpen, setOptionsOpen] = useState(initial?.customization.status === 'copied');
  const [incMissing, setIncMissing] = useState(false);
  const [showcaseOpen, setShowcaseOpen] = useState(
    Boolean(initial?.showcaseVideoR2Key) || (initial?.showcasePhotoR2Keys.length ?? 0) > 0,
  );
  useEffect(() => {
    if (showcaseBlocked) setShowcaseOpen(true);
  }, [showcaseBlocked]);
  /** The basis dropdown, its hint under it — the shipped words (`PRICING_BASIS_OPTIONS`), the maker's labels. */
  const basisOptions = PRICING_BASIS_OPTIONS.map((o) => ({
    key: o.key,
    label: o.key === 'fixed' ? 'One price' : o.key === 'per_pax' ? (category === 'crew_meals' ? 'Per meal' : 'Per guest') : o.label,
    hint: o.hint,
  }));
  const cancelTo = cancelHref ?? (isEdit ? '/vendor-dashboard/shop' : '/vendor-dashboard/services');
  /** What the couple reads for a shop pack on this card — never a count (lib/gift-pick.ts). */
  const packLine = giftPick && giftPick !== GIFT_SETNAYAN ? coupleCardPackLine(giftPick, shopName) : null;
  const faceName = title.trim() || activeCategoryLabel || 'Your service';
  const cardFace = face ? (
    <ServiceCardFace
      snap={{ ...face, name: faceName }}
      leafPathLabel={activeCategoryLabel ? `${activeCategoryLabel}${shopName ? ` · ${shopName}` : ''}` : 'Pick what you offer'}
      coverUrl={editing && snap.hasCover && editing.coverKey && currentCoverKey(formRef.current) === editing.coverKey ? editing.coverUrl : null}
      packLine={packLine}
    />
  ) : (
    <div aria-hidden className="h-[138px] rounded-2xl border" style={{ borderColor: line }} />
  );

  return (
    <div className="sn-canvas space-y-4 pb-28" data-card-maker={isEdit ? 'edit' : 'new'}>
      {unread.length > 0 ? (
        <p
          role="alert"
          data-maker-unread=""
          className="flex items-center gap-2 rounded-2xl px-3.5 py-2 text-[14px] leading-snug"
          style={{ background: 'color-mix(in srgb, rgb(var(--color-danger)) 10%, transparent)', color: 'rgb(var(--color-danger))' }}
        >
          <span className="min-w-0 flex-1">Couldn’t load {unread.join(' · ')} — Save waits so nothing is lost.</span>
          <a href={returnTo ?? ''} className="sn-press inline-flex min-h-11 flex-none items-center px-1.5 font-bold underline underline-offset-2">Retry</a>
        </p>
      ) : null}
      {errorLine ? (
        <p
          role="alert"
          data-maker-error=""
          className="whitespace-pre-line rounded-2xl px-3.5 py-3 text-[14px] leading-snug"
          style={{ background: 'color-mix(in srgb, rgb(var(--color-danger)) 10%, transparent)', color: 'rgb(var(--color-danger))' }}
        >
          {errorLine}
        </p>
      ) : null}

      {/* ── YOU LEFT A CARD HERE — offered, never restored behind their back. ── */}
      {offeredKeep && !keepDecided ? (
        <MakerRow
          icon={<Clock aria-hidden className="h-5 w-5" strokeWidth={1.75} />}
          title="Picked up where you left off?"
          line={`A card you started ${keepAgeLabel(offeredKeep.at, Date.now())} · only on this device`}
          right={
            <span className="flex items-center gap-1.5">
              <ActionButton tone="neutral" icon={X} label="Fresh" onClick={() => { clearKeep(); setOfferedKeep(null); setKeepDecided(true); }} />
              <ActionButton tone="brand" icon={Check} label="Pick up" onClick={() => restoreKeep(offeredKeep)} />
            </span>
          }
          data="keep"
        />
      ) : null}


      {/* ── STARTED FROM ANOTHER CARD — said before anything is pressed. ── */}
      {initial && !isEdit ? (
        <p className="text-[14px] leading-snug text-ink/70" data-maker-copied="">
          Started from <b className="text-ink">{initial.sourceTitle ?? 'one of your cards'}</b> — a new card; that one
          keeps its bookings. Its discounts, terms and other settings came across too — they are on the card once it
          is made.
          {customizationEnabled
            ? initial.customization.status === 'copied'
              ? ` Its ${initial.customization.items.length === 1 ? 'option' : `${initial.customization.items.length} options`} under What’s included came across too — check them before you save.`
              : initial.customization.status === 'unreadable'
                ? ' We couldn’t read the options on that card just now, so none came across.'
                : ' No options are linked to that card, so none came across.'
            : ''}
        </p>
      ) : null}

      {/* ═══ THE PINNED ROW — the service menu left · Preview and ⓘ rounds right, no page title (makers prototype
          7 Nov 2026 § 3). "What you offer" keeps its shipped behaviour — the same sheet, the same pick; only its place
          moved. ═══ */}
      <div className="flex min-h-[52px] items-center gap-2 border-b pb-2" style={{ borderColor: line }} data-maker-pin="">
        {/* The service menu — "What you offer" as one pill (the same sheet, the same pick as the shipped row). */}
        <div className="min-w-0 flex-1" data-maker-row="kind">
          {canChooseKind ? (
            <ActionButton
              tone={category ? 'neutral' : 'brand'}
              caret
              icon={MessageSquare}
              label={category ? activeCategoryLabel : 'What you offer'}
              title={category ? `What you offer: ${activeCategoryLabel} · change` : 'Choose what you offer'}
              onClick={() => setSheet('kind')}
              aria-haspopup="dialog"
              className="max-w-full [&>.lbl]:truncate"
            />
          ) : (
            <span
              className="inline-flex min-h-11 max-w-full items-center gap-2 truncate rounded-full bg-ink/[0.06] px-4 text-[13px] font-medium text-ink"
              title={isEdit ? 'Set when the card was made' : undefined}
            >
              <MessageSquare aria-hidden className="h-[18px] w-[18px] flex-none" strokeWidth={1.9} />
              <span className="truncate">{activeCategoryLabel}</span>
            </span>
          )}
        </div>
        <ActionButton tone="neutral" iconOnly icon={Info} label="About this card" onClick={() => setAboutOpen((v) => !v)} aria-expanded={aboutOpen} />
      </div>
      {canChooseKind && !category ? (
        <p className="-mt-2 text-[13px] text-sn-accent" data-maker-kind-line="">Common for {typeWord} · pick what this card is for</p>
      ) : canChooseKind && kindFromShop ? (
        <p className="-mt-2 text-[13px] text-ink/55" data-maker-kind-line="">From your shop · change</p>
      ) : null}

      {/* ═══ AS COUPLES SEE IT, PINNED (Build 3 Lane E items 8–9; owner ✅ 9 Nov: "the service maker's 👁 preview button
          goes; the card preview is always pinned at the top"). On a phone the card sits under the pinned row and stays
          on screen while the fields scroll under it, redrawing as you type. It IS the card a host sees in Suppliers ›
          Find — `ServiceCardFace`, the one face `supplier-sheet.tsx` renders; never a second drawing. ═══ */}
      <div className="sticky top-0 z-[3] -mx-4 border-b px-4 pb-3 pt-1 md:hidden" style={{ borderColor: line, background: 'var(--sn-canvas)' }} data-maker-card-pinned="">
        <div className="flex items-baseline justify-between gap-2 pb-1.5">
          <span className="sn-eye">As couples see it</span>
          <span className="text-[11.5px] text-ink/50">updates as you type</span>
        </div>
        {cardFace}
      </div>

      {/* ═══ THE SURFACE | AS COUPLES SEE IT — split evenly from 820 up; on a phone the card is pinned above ═══ */}
      <div className="md:grid md:grid-cols-2 md:items-start md:gap-8" data-maker-split="">
        {/* noValidate: some fields sit in SHUT folds (inert). A browser that refuses a submit over a field it cannot
            show focuses nothing and says nothing — the press just does nothing. commitVendorService re-validates
            every field and says why (carried from the live card-fields fix, #6534). */}
        <form
          id={CARD_FORM_ID}
          ref={formRef}
          action={commitVendorService}
          onSubmit={onSubmit}
          // ⏎ RETURN NEVER SAVES THE CARD (owner 2026-11-04, "after i placed the price, it finished") — it moves to the
          // next field. Create / Save is the only way to save. lib/return-moves-on.ts
          onKeyDown={returnMovesOn}
          noValidate
          className="min-w-0"
          data-card-form=""
        >
          <PendingWatch onChange={setPending} />
          <input type="hidden" name="category" value={category} />
          {/* C3 2026-08-28 — set only when the current kind resolved a genuine search miss. */}
          <input type="hidden" name="collected_kind_phrase" value={collectPhrase ?? ''} />
          {claimToken ? <input type="hidden" name="claim_token" value={claimToken} /> : null}
          <input type="hidden" name="coverage_id" value={coverageId} />
          {editing ? <input type="hidden" name="vendor_service_id" value={editing.serviceId} /> : null}
          <input type="hidden" name="publish" value={publishValue} />
          {/* 🎁 THE GIFT ROW posts the card's ONE gift as its two columns: the Setnayan gift's on/off (always posted —
              an absent box would be indistinguishable from "never asked") and the shop pack; `gift_pack_present` =
              this screen drew the row, so the save may clear a pack (lib/gift-pick.ts). */}
          <input type="hidden" name="includes_setnayan_gift" value={giftPick === GIFT_SETNAYAN ? 'on' : 'off'} />
          <input type="hidden" name="gift_pack_present" value="1" />
          <input type="hidden" name="gift_pack_code" value={giftPick && giftPick !== GIFT_SETNAYAN ? giftPick : ''} />
          <input type="hidden" name="schedule_choice" value={scheduleChoice === scheduleNow ? '' : scheduleChoice} />
          {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}

          {/* ═══ ONE PAGE OF FIELDS — Name · Specialties · Price · What's included · Extras · Gift · Photos ═══
              The prototype's one rhythm: a label · its 48 px box · a quiet hint; a topic after the first opens with a
              divider, never a box around the group. */}
          <div className="space-y-5 pt-3" data-maker-first="">
            {aboutOpen ? (
              <div className="space-y-1 rounded-2xl bg-ink/[0.04] px-4 py-3 text-[14px] leading-snug text-ink/75" data-maker-about="" role="note">
                <b className="block text-ink">This card</b>
                <span className="block">
                  {isEdit
                    ? 'Save keeps what couples see. Hide, copy or delete it under More settings · Live · delete · copy.'
                    : 'Create shows it to couples as soon as it has a cover, a price and what’s included — or saves it, not shown yet, until it does. Hide, copy or delete it from the card later.'}
                </span>
                {!isEdit ? (
                  <span className="block">
                    Discounts, booking terms, the payment schedule, crew and transport, who it is for, its schedule and
                    what it comes with are on the card once it is made.
                  </span>
                ) : null}
              </div>
            ) : null}

            <header data-maker-head="">
              <h2 className="text-[20px] font-semibold leading-tight tracking-tight text-ink">{title.trim() || activeCategoryLabel || 'Your service card'}</h2>
              <p className="mt-0.5 text-[14px] text-ink/65">Your service card — price it and say what’s in it.</p>
            </header>

            {/* ── Name — written for them, theirs to change (Q2: editable on an existing card too) · Specialties. ── */}
            {category || isEdit ? (
              <div data-maker-row="name">
                <label htmlFor="title" className={LAB}>Name</label>
                <input
                  id="title"
                  name="title"
                  value={title}
                  onChange={(e) => {
                    titleTouched.current = true;
                    setTitle(e.target.value);
                  }}
                  maxLength={80}
                  aria-label="Service name"
                  placeholder={activeCategoryLabel || 'Service name'}
                  className={BOX}
                />
                <p className={HINT}>Written for you · change it if you like</p>
                <ClaimWordNotes hits={checks.claims} field="name" />
                <ServiceMismatchNote
                  mismatch={checks.mismatch}
                  categoryLabel={activeCategoryLabel}
                  onMove={canChooseKind && moveTrade ? (key) => pickCategory(key) : null}
                  moveWhy={moveTrade?.standing === 'locked' ? (moveTrade.why ?? 'Your plan doesn’t include that service yet.') : null}
                />
                {/* Specialties (optional) — the kind's chip details (was "More settings › Details"), posting with the card. */}
                <div className="mt-2" data-maker-row="specialties">
                  <ActionButton
                    tone="neutral"
                    icon={specOpen ? ChevronUp : Plus}
                    label={specOpen ? 'Specialties' : 'Specialties (optional)'}
                    onClick={() => setSpecOpen((v) => !v)}
                    aria-expanded={specOpen}
                  />
                  <div hidden={!specOpen} className="pt-3">
                    {detailsSlot && detailsKind === category ? (
                      detailsSlot
                    ) : (
                      <p className="text-[14px] text-ink/65">
                        {category ? `Specialties for ${activeCategoryLabel} open on the card once it is created.` : 'Pick what you offer first.'}{' '}
                        <Link href="/vendor-dashboard/attributes" className="font-semibold text-sn-accent">All details ›</Link>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {/* ── Price — shown as "from": the basis dropdown, its hint, the ₱ box, then "Price · more". ── */}
            <div className={TOPIC} data-maker-row="price" data-price-waits={priceWaits ?? undefined}>
              <div className={LAB}>
                <span>Price <span className={SMALL}>shown as “from”</span></span>
                {/* The price the form holds now — the couple's recorded figure too, while its box waits. */}
                {snap.hasPrice ? <span className="ml-auto text-[15px] font-semibold text-ink" data-maker-price-now="">{snap.priceLine.split(' · ')[0]}</span> : null}
              </div>
              <PickMenu
                label="How the price works"
                value={basis}
                options={basisOptions}
                onPick={(k) => {
                  basisTouched.current = true;
                  setBasis(k as Basis);
                }}
                dataAttr="data-maker-basis"
                className={`${BOX} flex items-center justify-between gap-2 text-left`}
                trigger={
                  <>
                    <span className="truncate">{basisOptions.find((o) => o.key === basis)?.label}</span>
                    <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={1.75} />
                  </>
                }
              />
              <p className={HINT} data-basis-hint="">{basisOptions.find((o) => o.key === basis)?.hint}</p>
              {editing && bookedNow !== undefined && saysBookedPriceStays(bookedNow) ? (
                <p className={HINT} data-booked-price-stays="">
                  {BOOKED_PRICE_STAYS_SUPPLIER}
                </p>
              ) : null}
              <div className="mt-3">
                {priceWaits ? <p className="text-[14px] text-ink/70" data-maker-price-waits="">{priceWaitsLine(priceFacts)}</p> : null}
                {/* The box waits on a couple-seeded card; it stays MOUNTED, so the couple's recorded price still posts. */}
                <div hidden={Boolean(priceWaits)}>
                  <PricingBasisEditor
                    idPrefix="canvas"
                    category={category}
                    basis={basis}
                    part="main"
                    defaults={initial?.pricing ?? EMPTY_PRICING}
                  />
                </div>
              </div>
              <div className="mt-2" data-maker-price-more="">
                <ActionButton
                  tone="neutral"
                  icon={priceMoreOpen ? ChevronUp : SlidersHorizontal}
                  label={priceMoreOpen ? 'Fewer settings' : 'Price · more'}
                  onClick={() => setPriceMoreOpen((v) => !v)}
                  aria-expanded={priceMoreOpen}
                />
                {/* Mounted while shut, so its boxes post with the card either way (was "More settings › Price · more"). */}
                <div hidden={!priceMoreOpen} className="pt-3">
                  <PricingBasisEditor
                    idPrefix="canvas"
                    category={category}
                    basis={basis}
                    part="more"
                    defaults={initial?.pricing ?? EMPTY_PRICING}
                    fixedExtra={<PriceBracketsEditor initial={initial?.brackets ?? []} />}
                  />
                </div>
              </div>
            </div>

            {/* ── What's included — at least one line; a line leaves by its swipe, with Undo. ── */}
            <div className={TOPIC} data-maker-row="included">
              <div className={LAB}>
                <span>What’s included <span className={SMALL}>{snap.inclusionLabels.length ? `${formatCount(snap.inclusionLabels.length)} line${snap.inclusionLabels.length === 1 ? '' : 's'}` : 'at least one line'}</span></span>
              </div>
              <InclusionsEditor initial={initial?.inclusions ?? []} bare />
              {incMissing && !inclusionsAreSet(snap.inclusionLabels) ? (
                <p role="alert" className="mt-1.5 text-[13px] font-medium" style={{ color: 'rgb(var(--color-danger))' }} data-maker-inc-error="">
                  Add what’s included — at least one line.
                </p>
              ) : null}
              <ClaimWordNotes hits={checks.claims} field="included" />
              {/* ★ Options on each line (always · optional · they pick) — CREATE-ONLY in the save (one run mints one
                  package), so it stays reachable while the card is made; the saved card points to Your packages. */}
              {customizationEnabled && !isEdit ? (
                <div className="mt-2" data-maker-options="">
                  <ActionButton
                    tone="neutral"
                    icon={optionsOpen ? ChevronUp : ListChecks}
                    label={optionsOpen ? 'Fewer options' : 'Options on each line'}
                    onClick={() => setOptionsOpen((v) => !v)}
                    aria-expanded={optionsOpen}
                  />
                  <div hidden={!optionsOpen} className="pt-3">
                    <CustomizationStep
                      categoryValue={category}
                      categoryLabel={activeCategoryLabel}
                      initialItems={initial?.customization.status === 'copied' ? initial.customization.items : undefined}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {/* ── Extras — priced add-ons (was "More settings › Add-ons"); a line leaves by its swipe. ── */}
            <div className={TOPIC} data-maker-row="extras">
              <div className={LAB}>
                <span>Extras <span className={SMALL}>priced add-ons · optional</span></span>
                {/* Centred: this ⓘ sits mid-row at 390, and a start-aligned 288 px body ran past the screen edge. */}
                <InfoTip label="" ariaLabel="About extras">
                  <span className="block font-semibold">Add-ons</span>
                  <span className="mt-1 block">Priced extras · “from ₱” each · up to 12. A couple adds them to this card when they ask for a quote.</span>
                </InfoTip>
              </div>
              <AddonsEditor serviceId={editing?.serviceId ?? ''} initial={editing?.addons ?? []} bare />
              <ClaimWordNotes hits={checks.claims} field="extras" />
            </div>

            {/* ── Gift — the shipped Setnayan-gift switch (was "More settings › Setnayan gift"), now ONE dropdown that
                also offers the shop's own gift packs. app/_components/gift-pick.tsx · lib/gift-pick.ts ── */}
            <div className={TOPIC} data-maker-row="gift">
              <GiftPickRow host="card" value={giftPick} onPick={setGiftPick} packs={giftPacks} free={giftFree} dataAttr="data-maker-gift" />
            </div>

            {/* ── Photos — one cover is enough. ── */}
            <div className={TOPIC} data-maker-row="photos">
              <div className={LAB}>
                <span>Photos <span className={SMALL}>one cover is enough{snap.hasClip ? ` · ▶ ${clipPillLabel(clipSeconds)}` : ''}</span></span>
              </div>
              <div className="space-y-3">
                <Field label="Cover photo" htmlFor="primary_photo_r2_key" help="The first thing couples see. PNG, JPEG or WebP up to 5 MB.">
                  <FileUpload
                    bucket="media"
                    pathPrefix={`vendors/${vendorProfileId}/services`}
                    name="primary_photo_r2_key"
                    unsavedHint={isEdit ? 'press Save below' : 'press Create below'}
                    maxSizeMB={5}
                    acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
                    mark="supplier"
                    frame="square"
                    previews="service-card"
                    compressImage
                    variant="square"
                    thumb={{ add: 'Add a cover', replace: 'Replace' }}
                    qrGuard
                    currentValue={editing?.coverKey ?? initial?.coverPhotoR2Key ?? null}
                    initialDisplayUrls={initial?.mediaDisplayUrls}
                  />
                </Field>
                {/* "One cover is enough" (prototype § 3): the showcase photos and the clip sit behind one press, MOUNTED
                    while shut so what they hold still posts — opened by itself when the card already has some. */}
                <div data-maker-showcase="">
                  <ActionButton
                    tone="neutral"
                    icon={showcaseOpen ? ChevronUp : Images}
                    label={showcaseOpen ? 'Fewer photos' : `More photos · a clip${snap.photoCount || snap.hasClip ? '' : ' (optional)'}`}
                    onClick={() => setShowcaseOpen((v) => !v)}
                    aria-expanded={showcaseOpen}
                  />
                  <div hidden={!showcaseOpen} className="pt-3">
                    <ShowcaseMediaFields
                      vendorProfileId={vendorProfileId}
                      unsavedHint={isEdit ? 'press Save below' : 'press Create below'}
                      onClipDurationSeconds={onClipDurationSeconds}
                      videoCurrent={initial?.showcaseVideoR2Key ?? null}
                      photosCurrent={initial?.showcasePhotoR2Keys}
                      displayUrls={initial?.mediaDisplayUrls}
                    />
                  </div>
                </div>
              </div>
              <PhotoCheckNotes checks={checks} serviceId={editing?.serviceId ?? null} showcaseRefs={checkInput.showcaseRefs} />
            </div>

            {/* The status line — on a phone it closes the surface; from 820 up the preview beside it says it. */}
            <div className="md:hidden">
              <p
                data-maker-status={status.tone}
                className="flex items-start gap-2.5 text-[14px] leading-snug"
                style={{ color: status.tone === 'ok' ? 'rgb(var(--color-ok))' : 'rgb(var(--color-warn))' }}
              >
                {status.tone === 'ok' ? (
                  <Check aria-hidden className="mt-0.5 h-[18px] w-[18px] flex-none" strokeWidth={2.2} />
                ) : (
                  <EyeOff aria-hidden className="mt-0.5 h-[18px] w-[18px] flex-none" strokeWidth={2} />
                )}
                <span>
                  {status.lead ? <>{status.lead} </> : null}
                  <b className="font-semibold">{status.text}</b>
                </span>
              </p>
              <div className="mt-2">
                <CardChecksSummary open={checks.open} unread={checks.unread} isEdit={isEdit} />
              </div>
            </div>

            {/* ═══ MORE SETTINGS — ON THE SAVED CARD (owner 7 Nov 2026: one page of fields while the card is made; "the
                other More-settings folds move OFF the creation page and stay on the saved card"). While a card is being
                MADE the folds stay MOUNTED but unseen, so every default and every value a copy brought along still
                posts exactly as before — nothing is lost by the move; they show here once the card exists. ═══ */}
            <div hidden={!isEdit} className={isEdit ? TOPIC : undefined} data-maker-more-wrap={isEdit ? 'card' : 'later'}>
              <Fold
                data="more"
                open={moreOpen}
                onOpenChange={onMoreOpenChange}
                anchor={MORE_ANCHOR}
                // 📌 Its body stops clipping once open and still, so the groups inside pin as slim lines UNDER this one
                // while you scroll them (owner 2026-11-04; the app-wide 2026-10-29 pin rule). fold.tsx
                popovers
                title="More settings"
                line={`Filled for ${fillWord}`}
                lead={<RowIcon><Settings aria-hidden className="h-5 w-5" strokeWidth={1.75} /></RowIcon>}
              >
                {/* 📐 ONE ICON COLUMN, ONE TEXT COLUMN (owner 2026-11-04 "alignments for the more settings is wrong"): a
                    nested row's mark sits in the same 40 px box as the row above it (SubIcon), with no extra inset, and
                    what a nested fold opens onto starts on the title's column (40 px mark + the head's 8 px gap). */}
                <div className="divide-y pb-2 [&>[data-fold]>[data-fold-body]>div>*]:pl-12" style={{ borderColor: line }} data-maker-more="">
                  {/* ── Schedule — its own, or shares one (a first-page row until 7 Nov 2026; on the saved card since). ── */}
                  <MakerRow
                    icon={<CalendarDays aria-hidden className="h-5 w-5" strokeWidth={1.75} />}
                    title="Schedule"
                    line={scheduleLine}
                    right={
                      <PickMenu
                        label="Which schedule this card books on"
                        value={scheduleChoice}
                        options={scheduleOptions}
                        onPick={setScheduleChoice}
                        dataAttr="data-maker-schedule"
                      />
                    }
                    data="schedule"
                  />

                  {/* Discounts — offered, NEVER pre-filled (owner 2026-10-14). */}
                  <Fold data="m-disc" defaultOpen={discountSeed !== null} title="Discounts" line={snap.discountConditions.length ? 'Set' : 'None yet · early booking · off-peak · promo'} lead={<SubIcon><Tag aria-hidden className="h-4 w-4" strokeWidth={1.75} /></SubIcon>}>
                    <div className="pb-4 pt-1">
                      {/* ⓘ (controller 2026-11-04): these are the card's starting offers; a quote can always go lower. */}
                      <div className="mb-2" data-maker-disc-tip="">
                        <InfoTip label="Starting offers" labelClassName="text-[14px] text-ink/70" align="start">
                          Starting offers. You can give a bigger discount in any quote.
                        </InfoTip>
                      </div>
                      <DiscountsEditor
                        initial={initial?.discounts ?? []}
                        seedOffPeak={discountSeed !== null && (initial?.discounts.length ?? 0) === 0}
                        seedExpiry={discountSeed?.expiry}
                        seedConditions={discountSeed?.conditions}
                      />
                    </div>
                  </Fold>

                  <Fold data="m-inc" title="What’s included · details" line="Every line is included" lead={<SubIcon><ListChecks aria-hidden className="h-4 w-4" strokeWidth={1.75} /></SubIcon>}>
                    <div className="pb-4 pt-1">
                      {customizationEnabled ? (
                        <p className="text-[14px] text-ink/65">
                          Choices couples make on this card (always · optional · they pick) are kept as they are.{' '}
                          <Link href="/vendor-dashboard/packages" className="font-semibold text-sn-accent underline-offset-2 hover:underline">Your packages ›</Link>
                        </p>
                      ) : (
                        <p className="text-[14px] text-ink/65">Every line under What’s included is part of the price.</p>
                      )}
                    </div>
                  </Fold>

                  <Fold data="m-crew" title="Crew and transport" line={defaults.crewApplies ? defaults.summary.crew : defaults.summary.crew} lead={<SubIcon><Truck aria-hidden className="h-4 w-4" strokeWidth={1.75} /></SubIcon>}>
                    <div className="space-y-3 pb-4 pt-1">
                      {!defaults.crewApplies ? <p className="text-[13px] text-ink/60">Usually nothing to feed or move — fill it only if you bring a team.</p> : null}
                      <Field label="Crew size" htmlFor="crew_size">
                        <input id="crew_size" name="crew_size" type="number" min={0} step={1} defaultValue={initial?.crewSize ?? ''} className="input-field" />
                      </Field>
                      <IncludedFlags
                        idPrefix="canvas"
                        category={category}
                        defaults={initial?.included ?? { crew_meal_included: false, transport_included: false, transport_flat_fee_php: null }}
                      />
                    </div>
                  </Fold>

                  <Fold data="m-terms" title="Booking terms" line={defaults.summary.terms} lead={<SubIcon><Clock aria-hidden className="h-4 w-4" strokeWidth={1.75} /></SubIcon>}>
                    <div className="space-y-3 pb-4 pt-1">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <Field label="Book ahead (months)" htmlFor="recommended_lead_time_months">
                          <input
                            id="recommended_lead_time_months"
                            name="recommended_lead_time_months"
                            type="number"
                            min={0}
                            step="0.5"
                            defaultValue={initial || isEdit ? (initial?.recommendedLeadTimeMonths ?? '') : (defaults.leadMonths ?? '')}
                            key={initial || isEdit ? 'kept' : `lead-${kindType}`}
                            className="input-field"
                          />
                        </Field>
                        <Field label="Last-minute ends (months)" htmlFor="last_minute_end_months">
                          <input id="last_minute_end_months" name="last_minute_end_months" type="number" min={0} step={1} defaultValue={initial?.lastMinuteEndMonths ?? ''} className="input-field" />
                        </Field>
                        <Field label="Last-minute surcharge (%)" htmlFor="last_minute_surcharge_pct">
                          <input id="last_minute_surcharge_pct" name="last_minute_surcharge_pct" type="number" min={0} max={100} step={1} defaultValue={initial?.lastMinuteSurchargePct ?? ''} className="input-field" />
                        </Field>
                      </div>
                      {/* ⚖ The supplier's own number — inside the plan's bookings per date per card (owner 2026-11-06:
                          Solo 1 · Pro 3 · Ultra 5, Ultra may add more). Free · Verified: not ruled, no plan cap. */}
                      <Field
                        label="How many a day · this card"
                        htmlFor="daily_capacity"
                        help={
                          (editing?.slots.length ?? 0) > 0
                            ? 'Time slots below set how many at once instead.'
                            : bookingsPerDate?.help
                              ? `Blank = up to your plan's number. ${bookingsPerDate.help}`
                              : 'Blank = the schedule decides.'
                        }
                      >
                        <input
                          id="daily_capacity"
                          name="daily_capacity"
                          type="number"
                          min={1}
                          max={bookingsPerDate?.cap != null && Number.isFinite(bookingsPerDate.cap) ? Math.max(bookingsPerDate.cap, Number(editing?.dailyCapacity) || 0) : undefined}
                          step={1}
                          defaultValue={editing?.dailyCapacity ?? ''}
                          disabled={(editing?.slots.length ?? 0) > 0}
                          className="input-field disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </Field>
                      <SlotRows existing={editing?.slots ?? []} />
                    </div>
                  </Fold>

                  <Fold data="m-pay" title="Payment schedule" line="How couples pay · first payment · no-show terms" lead={<SubIcon><Wallet aria-hidden className="h-4 w-4" strokeWidth={1.75} /></SubIcon>}>
                    <div className="pb-4 pt-1">
                      <PaymentScheduleEditor serviceId={editing?.serviceId ?? ''} initial={editing?.schedule ?? []} bare />
                    </div>
                  </Fold>

                  <Fold data="m-who" title="Who it is for" line={coverageId ? audienceLabel : 'Which of your coverages · events · faiths'} lead={<SubIcon><Users aria-hidden className="h-4 w-4" strokeWidth={1.75} /></SubIcon>}>
                    <div className="space-y-2 pb-4 pt-1">
                      {coverages.length > 0 ? (
                        <div className="flex min-h-11 items-center justify-between gap-3">
                          <span className="text-[15px] text-ink">Coverage</span>
                          <PickMenu
                            label="Coverage this card sits in"
                            value={coverageId || 'none'}
                            options={[{ key: 'none', label: 'Not assigned' }, ...coverages.map((c) => ({ key: String(c.id), label: c.label }))]}
                            onPick={(k) => setCoverageId(k === 'none' ? '' : k)}
                            dataAttr="data-maker-coverage"
                          />
                        </div>
                      ) : (
                        <p className="text-[14px] text-ink/65">Not in a coverage yet — saying Yes to “Add it to what you do” on Create puts it in one.</p>
                      )}
                      <MakerRow
                        title="Events and faiths"
                        line={coverageId ? audienceLabel : 'Pick a coverage first'}
                        right={<ChevronRight aria-hidden className="h-4 w-4 text-sn-accent" strokeWidth={2} />}
                        onPress={() => setSheet('audience')}
                        label="Choose the events and faiths this card is found under"
                        data="audience"
                      />
                      {branches.length > 0 ? (
                        <Field label="Branch" htmlFor="branch_id">
                          <select id="branch_id" name="branch_id" defaultValue={editing?.branchId ?? ''} className="input-field cursor-pointer">
                            <option value="">You (main)</option>
                            {branches.map((b) => (
                              <option key={b.id} value={b.id} disabled={b.usable === false}>
                                {b.label}{b.usable === false ? ' (not active)' : ''}
                              </option>
                            ))}
                          </select>
                        </Field>
                      ) : null}
                    </div>
                  </Fold>

                  <Fold data="m-comes" title="Comes with" line={otherCategoriesShown.length ? 'Your other cards this one goes with' : 'No other card yet'} lead={<SubIcon><Link2 aria-hidden className="h-4 w-4" strokeWidth={1.75} /></SubIcon>}>
                    <div className="pb-4 pt-1">
                      {otherCategoriesShown.length > 0 ? (
                        otherCategoriesShown.map((c) => (
                          <label key={c.value} className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
                            <span className="text-[15px] text-ink">{c.label}</span>
                            <input type="checkbox" name="linked" value={c.value} defaultChecked={initial?.linkedCategories.includes(c.value) ?? false} className="peer sr-only" />
                            <span aria-hidden className={SWITCH_TRACK} />
                          </label>
                        ))
                      ) : (
                        <p className="text-[14px] text-ink/65">Make another card and it can come with this one. Up to 6.</p>
                      )}
                    </div>
                  </Fold>

                  <Fold data="m-record" title="Record · collected" line={isEdit ? 'Booked · delivered · reviews · read-only' : 'Nothing yet · grows with each booking'} lead={<SubIcon><Award aria-hidden className="h-4 w-4" strokeWidth={1.75} /></SubIcon>}>
                    <div className="pb-4 pt-1">
                      {recordSlot ?? (
                        <p className="text-[14px] text-ink/65">Booked, what was delivered, reviews — the card collects it; you type nothing. The first booking starts it.</p>
                      )}
                    </div>
                  </Fold>

                  <Fold data="m-portfolio" title="Portfolio · collected" line="Albums from events this card was booked for · read-only" lead={<SubIcon><Images aria-hidden className="h-4 w-4" strokeWidth={1.75} /></SubIcon>}>
                    <div className="pb-4 pt-1">
                      <p className="text-[14px] text-ink/65">
                        Each booked event’s album lands here and in Their work on your page. Your cover photos are never
                        shown as proof.
                      </p>
                    </div>
                  </Fold>

                  <Fold data="m-live" title="Live · delete · copy" line={isEdit ? (liveOn ? 'Couples can see it · hide · start another from this' : 'Not shown yet · show · start another from this') : 'Shown once it has a cover, a price and what’s included'} lead={<SubIcon><Eye aria-hidden className="h-4 w-4" strokeWidth={1.75} /></SubIcon>}>
                    <div className="space-y-1 pb-4 pt-1">
                      {isEdit && editing ? (
                        <>
                          <div className="flex min-h-11 items-center justify-between gap-3">
                            <span>
                              <span className="block text-[15px] text-ink">Couples can see it</span>
                              <span className="block text-[13px] text-ink/55">
                                {liveSwitchWaits ? `Waits for ${status.text}` : 'Hidden cards keep their bookings'}
                              </span>
                            </span>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={liveOn}
                              aria-label="Couples can see it"
                              disabled={liveSwitchWaits}
                              onClick={() => setLiveOn((v) => !v)}
                              className={SWITCH_BUTTON}
                              data-maker-live=""
                            >
                              <SwitchTrack on={liveOn} />
                            </button>
                          </div>
                          {editing.legacyPromise ? (
                            <p className="text-[13px] text-ink/60">Your old promise · {editing.legacyPromise} · it stays on the card</p>
                          ) : null}
                          <Link
                            href={`/vendor-dashboard/services/new/${category}?from=${editing.serviceId}`}
                            className="sn-press flex min-h-11 items-center justify-between gap-3 text-[15px] text-ink"
                            data-maker-copy=""
                          >
                            <span className="flex items-center gap-2"><Copy aria-hidden className="h-4 w-4 text-ink/60" strokeWidth={1.75} />Start another from this</span>
                            <ChevronRight aria-hidden className="h-4 w-4 text-sn-accent" strokeWidth={2} />
                          </Link>
                          <button
                            type="button"
                            onClick={() => setSheet('delete')}
                            className="sn-press flex min-h-11 w-full items-center justify-between gap-3 text-left text-[15px]"
                            style={{ color: 'rgb(var(--color-danger))' }}
                            data-maker-delete=""
                          >
                            <span className="flex items-center gap-2"><Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />Delete</span>
                            <span className="text-[13px] text-ink/55">Booked before = hides instead</span>
                          </button>
                        </>
                      ) : (
                        <p className="text-[14px] text-ink/65">
                          Create shows it to couples as soon as it has a cover, a price and what’s included — or saves it,
                          not shown yet, until it does. Hide, copy or delete it from the card later.
                        </p>
                      )}
                    </div>
                  </Fold>
                </div>
              </Fold>
            </div>
          </div>
          {askResult && askResult.tone === 'ok' ? (
            <p role="status" className="mt-3 text-[14px]" style={{ color: 'rgb(var(--color-ok))' }}>{askResult.text}</p>
          ) : null}
        </form>

        {/* ═══ AS COUPLES SEE IT — the shipped face, painted from the live form; beside the surface from 820 up ═══ */}
        <aside className="hidden md:sticky md:top-24 md:block" data-maker-card="">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[16px] font-semibold text-ink">As couples see it</h3>
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink/45">Live</span>
            </div>
            {cardFace}
            <p
              data-maker-status={status.tone}
              className="flex items-start gap-2.5 text-[14px] leading-snug"
              style={{ color: status.tone === 'ok' ? 'rgb(var(--color-ok))' : 'rgb(var(--color-warn))' }}
            >
              {status.tone === 'ok' ? (
                <Check aria-hidden className="mt-0.5 h-[18px] w-[18px] flex-none" strokeWidth={2.2} />
              ) : (
                <EyeOff aria-hidden className="mt-0.5 h-[18px] w-[18px] flex-none" strokeWidth={2} />
              )}
              <span>
                {status.lead ? <>{status.lead} </> : null}
                <b className="font-semibold">{status.text}</b>
              </span>
            </p>
            <CardChecksSummary open={checks.open} unread={checks.unread} isEdit={isEdit} />
          </div>
        </aside>
      </div>

      {/* ═══ THE THUMB ROW — Cancel (grey) · Create / Save card (the one main, terracotta). The shipped row + buttons. ═══ */}
      <SupplierThumbRow name="maker" label="Card actions">
        <ActionButton tone="neutral" icon={X} label="Cancel" href={cancelTo} />
        <ActionButton
          tone="brand"
          main
          type="submit"
          form={CARD_FORM_ID}
          icon={Check}
          label={pending ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save card' : 'Create'}
          waiting={pending || saveBlocked}
        />
      </SupplierThumbRow>
      <UndoToastHost />

      {/* ═══ SHEETS — choices and sibling forms only. A sheet portals to <body>, so NO card field may live in one. ═══ */}

      {/* What you offer — rows, the shop's own words first ("Common for a caterer"), search, Something else, Ask us. */}
      {canChooseKind ? (
        <CanvasSheet id="canvas-kind" title="What you offer" open={sheet === 'kind'} onClose={() => setSheet(null)} confirmLabel={null}>
          <label className="flex min-h-11 items-center gap-2 rounded-full border px-3.5" style={{ borderColor: line }}>
            <Search aria-hidden className="h-4 w-4 flex-none text-ink/50" strokeWidth={1.9} />
            <input
              type="search"
              value={kindQuery}
              onChange={(e) => setKindQuery(e.target.value)}
              placeholder="Search what you offer"
              aria-label="Search kinds of service"
              className="min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none"
            />
          </label>

          {rankedTrades.length > 0 ? (
            <KindGroup heading="Matches what you typed">
              {rankedTrades.map((t) => (
                <KindRow
                  key={t.key}
                  opt={{ value: t.key, label: t.label, standing: t.standing, why: t.why, hint: t.branch }}
                  on={t.key === category}
                  onPick={() => {
                    pickCategory(t.key);
                    setSheet(null);
                  }}
                />
              ))}
            </KindGroup>
          ) : null}

          {coveredChoices.length > 0 ? (
            <KindGroup heading={`Common for ${typeWord}`} note={coverageNames.length > 0 ? 'What you already do, in your own words' : undefined}>
              {coveredChoices.map((opt) => (
                <KindRow
                  key={opt.value}
                  opt={opt}
                  on={opt.value === category}
                  onPick={() => {
                    pickCategory(opt.value);
                    setSheet(null);
                  }}
                />
              ))}
            </KindGroup>
          ) : null}

          <KindGroup heading="Something else">
            {categoryOptions.map((group) => {
              const rest = group.options
                .filter((o) => o.standing !== 'covered' && !rankedKeys.has(o.value))
                .filter((o) =>
                  kindQuery.trim().length === 0
                    ? true
                    : o.label.toLowerCase().includes(kindQuery.trim().toLowerCase()),
                );
              if (rest.length === 0) return null;
              return (
                <Fold key={group.key} data={`kind-${group.key}`} title={group.label} line={`${formatCount(rest.length)} kind${rest.length === 1 ? '' : 's'}`} defaultOpen={kindQuery.trim().length > 0}>
                  <div className="pb-2">
                    {rest.map((opt) => (
                      <KindRow
                        key={opt.value}
                        opt={opt}
                        on={opt.value === category}
                        onPick={() => {
                          pickCategory(opt.value);
                          setSheet(null);
                        }}
                      />
                    ))}
                  </div>
                </Fold>
              );
            })}
            <Link
              href={PROPOSE_CATEGORY_HREF}
              className="sn-press flex min-h-[58px] items-center gap-3 py-2"
              data-kind-ask-us=""
            >
              <RowIcon><MessageSquare aria-hidden className="h-5 w-5" strokeWidth={1.75} /></RowIcon>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-medium text-ink">Ask us</span>
                <span className="block text-[13.5px] text-ink/55">Tell us what you do in your own words</span>
              </span>
              <ChevronRight aria-hidden className="h-4 w-4 text-sn-accent" strokeWidth={2} />
            </Link>
          </KindGroup>

          {kindSearchMissed ? (
            <p className="text-[14px] text-ink/65">
              Nothing matches “{kindQuery.trim()}”. Try a plainer word — or Ask us and we will add it. You are not stuck:
              pick <strong>Miscellaneous</strong> for now and change it once we have your kind.
            </p>
          ) : null}
          {lockedWhy ? (
            <p className="text-[14px] text-ink/65">
              {lockedWhy}{' '}
              <Link href={PROPOSE_CATEGORY_HREF} className="font-semibold text-sn-accent underline-offset-2 hover:underline">
                Tell us what you do
              </Link>{' '}
              and we&rsquo;ll take it from there — this card stays exactly as you left it.
            </p>
          ) : null}
        </CanvasSheet>
      ) : null}

      {/* 🏷 Add <kind> to what you do? — asked once, on Create. */}
      {ask ? (
        <CanvasSheet id="canvas-ask" title={coverageAskLine(ask.label)} open={sheet === 'ask'} onClose={() => setSheet(null)} confirmLabel={null}>
          <p className="text-[15px] leading-snug text-ink/75">
            This card is a <b className="text-ink">{activeCategoryLabel}</b>. Couples search suppliers by what they do —
            add it and this card is found there too.
          </p>
          {askResult && askResult.tone !== 'ok' ? (
            <p role={askResult.tone === 'bad' ? 'alert' : 'status'} data-ask-result={askResult.tone} className="text-[14px] leading-snug" style={{ color: askResult.tone === 'bad' ? 'rgb(var(--color-danger))' : 'rgb(var(--color-warn))' }}>
              {askResult.text}
              {askResult.tone === 'plan' ? (
                <>
                  {' '}
                  <Link href="/vendor-dashboard/subscription" className="font-semibold text-sn-accent underline-offset-2 hover:underline">See plans ›</Link>
                </>
              ) : null}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            {askResult && askResult.tone !== 'ok' ? (
              <ActionButton tone="brand" main icon={Check} label={isEdit ? 'Save the card' : 'Create the card'} onClick={() => { setSheet(null); setSubmitNext(true); }} />
            ) : (
              <>
                <ActionButton tone="neutral" icon={X} label="Not now" onClick={() => answerAsk('no')} waiting={asking} />
                <ActionButton tone="brand" main icon={Plus} label={asking ? 'Adding…' : 'Yes, add it'} onClick={() => answerAsk('yes')} waiting={asking} />
              </>
            )}
          </div>
        </CanvasSheet>
      ) : null}

      {/* Delete — its own form; a card anyone booked hides instead (said before the tap). */}
      {editing ? (
        <CanvasSheet id="canvas-delete" title="Delete this card?" open={sheet === 'delete'} onClose={() => setSheet(null)} confirmLabel={null}>
          {deleteGate?.refusal ? (
            // An open booking: no Delete at all — the same words the list's swipe and the server say.
            <>
              <p role="alert" className="whitespace-pre-line text-[15px] leading-snug text-terracotta-700" data-maker-delete-refusal="">
                {deleteGate.refusal}
              </p>
              <div className="flex flex-wrap gap-2">
                <ActionButton tone="neutral" icon={X} label="Keep it" onClick={() => setSheet(null)} />
              </div>
            </>
          ) : (
            <>
              {deleteGate ? (
                <ul className="space-y-1.5 text-[15px] leading-snug text-ink/75" data-maker-delete-warning="">
                  {deleteGate.lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[15px] leading-snug text-ink/75">
                  If a couple ever booked or asked about it, it is hidden instead, so their record stays. Otherwise it is gone.
                </p>
              )}
              <form action={deleteVendorService} className="flex flex-wrap gap-2">
                <input type="hidden" name="vendor_service_id" value={editing.serviceId} />
                <ActionButton tone="neutral" icon={X} label="Cancel" onClick={() => setSheet(null)} />
                <SupplierSubmit tone="danger" main icon={<Trash2 aria-hidden strokeWidth={1.9} />} label="Delete" pendingLabel="Deleting…" />
              </form>
            </>
          )}
        </CanvasSheet>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════════
          parity:ignore-start
          THE AUDIENCE SHEET IS A SIBLING FORM, NOT A NESTED ONE. Who finds this card is
          `vendor_coverages.event_types` / `.faiths` — a different write from the card's, so a different form, outside
          the card form (scripts/lint-nested-forms.mjs). It posts `updateCoverageServesInPlace`: the same write and
          validation, reported here beside the button, never a redirect that would throw the card away.
          ═══════════════════════════════════════════════════════════════════ */}
      <CanvasSheet
        id="canvas-audience"
        title="Who it’s for"
        open={sheet === 'audience'}
        onClose={() => setSheet(null)}
        confirmLabel={null}
      >
        {coverages.length === 0 || !coverageId ? (
          <p className="text-sm" style={{ color: 'var(--m-slate-2)' }}>
            Pick the coverage this card sits in first (Who it is for › Coverage) — then choose the events and faiths it
            is found under.
          </p>
        ) : (
          <form action={saveAudience} className="space-y-4">
            <input type="hidden" name="coverage_id" value={coverageId} />
            {/* EVERY vocab option THE LEAF MAY SERVE renders, across these groups (lib/canvas-audience-groups.ts);
                the only pre-filter is allowedEventOptions — the SAME set the server enforces on save. */}
            {audienceGroups(audienceOptions).map((group) => (
              <ChipGroup
                key={group.id}
                heading={group.heading}
                blurb={group.blurb}
                options={group.options}
                coverageField="event_types"
                selected={events}
                onToggle={(k) => setEvents((cur) => toggle(cur, k))}
                disabled={!coverageId}
              />
            ))}
            {audienceOptions.length < eventTypeOptions.length ? (
              <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
                Only the events this category can serve are shown.
              </p>
            ) : null}
            {droppedKeys.length > 0 ? (
              <p className="text-xs" style={{ color: 'var(--m-blush-deep)' }}>
                No longer offered for this category:{' '}
                {droppedKeys.map((k) => eventTypeLabel(k)).join(' · ')} — saving
                removes {droppedKeys.length === 1 ? 'it' : 'them'}.
              </p>
            ) : null}
            <ChipGroup
              heading="Faith"
              blurb="Leave all off to welcome every faith. Faith unlocks you for a search; it never gates you out."
              options={faithOptions}
              coverageField="faiths"
              selected={faiths}
              onToggle={(k) => setFaiths((cur) => toggle(cur, k))}
              disabled={!coverageId}
            />
            <p className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
              Who-it&rsquo;s-for is saved on your coverage, not on this card — it saves on its own and your card stays
              exactly as you left it.
            </p>
            <SubmitButton
              className="button-primary min-h-[44px] disabled:opacity-50"
              pendingLabel="Saving…"
              disabled={!coverageId || events.length === 0}
            >
              Save who it&rsquo;s for
            </SubmitButton>
            {audienceState.message ? (
              <p role="alert" className="text-xs" style={{ color: 'var(--m-blush-deep)' }}>
                {audienceState.message}
              </p>
            ) : null}
            {audienceSaved ? (
              <p role="status" className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
                Saved — couples looking for these events will find this card.
              </p>
            ) : null}
          </form>
        )}
      </CanvasSheet>
      {/* parity:ignore-end */}
    </div>
  );
}

const EMPTY_PRICING = {
  pricing_basis: 'fixed' as const,
  starting_price_php: null,
  base_pax: null,
  added_pax_price_php: null,
  per_pax_price_php: null,
  min_pax: null,
  hour_base_php: null,
  min_hours: null,
  extra_hour_php: null,
};

/** The cover key on the form right now — the face draws the stored picture only while it is unchanged. */
function currentCoverKey(form: HTMLFormElement | null): string | null {
  if (!form) return null;
  const v = new FormData(form).get('primary_photo_r2_key');
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/** Lifts the card form's pending state to the thumb row, which is portalled outside the form. */
function PendingWatch({ onChange }: { onChange: (pending: boolean) => void }) {
  const { pending } = useFormStatus();
  useEffect(() => {
    onChange(pending);
  }, [pending, onChange]);
  return null;
}

function toggle(list: string[], key: string): string[] {
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
}

// ── Rows ────────────────────────────────────────────────────────────────────

/** The 40 px icon circle a first-question row leads with (the prototype's `.row .ico`). */
function RowIcon({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="grid h-10 w-10 flex-none place-items-center rounded-full text-ink"
      style={{ background: 'color-mix(in srgb, rgb(var(--color-gild)) 20%, transparent)' }}
    >
      {children}
    </span>
  );
}

/** The smaller mark a More-settings fold leads with. */
function SubIcon({ children }: { children: ReactNode }) {
  return <span aria-hidden className="grid h-10 w-10 flex-none place-items-center rounded-full text-ink/70">{children}</span>;
}

/**
 * One row: icon · title over a one-line summary · its control on the right. Pressable (a sheet opens) when
 * `onPress` is given; otherwise the right-hand control is the thing pressed.
 */
function MakerRow({
  icon,
  title,
  line,
  lineTone = 'mute',
  right,
  onPress,
  label,
  data,
}: {
  icon?: ReactNode;
  title: string;
  line?: string;
  lineTone?: 'mute' | 'brand';
  right?: ReactNode;
  onPress?: () => void;
  label?: string;
  data: string;
}) {
  const body = (
    <>
      {icon ? <RowIcon>{icon}</RowIcon> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-medium leading-tight text-ink">{title}</span>
        {line ? (
          <span className={`line-clamp-2 block text-[13.5px] leading-snug ${lineTone === 'brand' ? 'text-sn-accent' : 'text-ink/55'}`}>{line}</span>
        ) : null}
      </span>
      {right ? <span className="flex min-w-0 max-w-[55%] flex-none items-center justify-end">{right}</span> : null}
    </>
  );
  if (onPress) {
    return (
      <button type="button" onClick={onPress} aria-label={label} className="sn-press flex min-h-[58px] w-full items-center gap-2 py-2 text-left" data-maker-row={data}>
        {body}
      </button>
    );
  }
  return (
    <div className="flex min-h-[58px] items-center gap-2 py-2" data-maker-row={data}>
      {body}
    </div>
  );
}

/** Time slots — open to every plan (owner 2026-10-14). Existing ones can be removed; new ones added; all save with the card. */
function SlotRows({ existing }: { existing: VendorServiceTimeSlot[] }) {
  const [adds, setAdds] = useState<number[]>([]);
  const next = useRef(0);
  return (
    <div className="space-y-2" data-maker-slots="">
      <p className="text-[15px] text-ink">Exact time slots <span className="text-[13px] text-ink/55">· fixed times couples pick · every plan</span></p>
      {existing.map((s) => (
        <label key={s.slot_id} className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
          <span className="text-[14px] text-ink">
            {s.slot_label} · {formatSlotTime(s.start_time)}–{formatSlotTime(s.end_time)} · {formatCount(s.slot_capacity)} at once
          </span>
          <span className="flex items-center gap-2 text-[13px] text-ink/55">
            Remove
            <input type="checkbox" name="remove_slot_id" value={s.slot_id} className="h-5 w-5 accent-[rgb(var(--color-danger))]" />
          </span>
        </label>
      ))}
      {adds.map((k) => (
        <div key={k} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input name="new_slot_label" maxLength={60} placeholder="e.g. Morning" aria-label="Slot name" className="input-field col-span-2 sm:col-span-1" />
          <input name="new_slot_start" type="time" step={1800} aria-label="Starts" className="input-field" />
          <input name="new_slot_end" type="time" step={1800} aria-label="Ends" className="input-field" />
          <input name="new_slot_capacity" type="number" min={1} step={1} placeholder="1" aria-label="How many at once" className="input-field" />
        </div>
      ))}
      <button
        type="button"
        onClick={() => setAdds((cur) => [...cur, next.current++])}
        className="sn-press inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-sn-accent"
      >
        <Plus className="h-4 w-4" strokeWidth={2} />
        Add a time slot
      </button>
    </div>
  );
}

// ── The kind sheet's rows ───────────────────────────────────────────────────

function KindGroup({ heading, note, children }: { heading: string; note?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="pt-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink/55">{heading}</p>
      {note ? <p className="text-[13px] text-ink/55">{note}</p> : null}
      <div className="divide-y" style={{ borderColor: line }}>{children}</div>
    </div>
  );
}

/**
 * One kind of service, as a row.
 *
 * 🔒 A LOCKED ROW IS NOT A BUTTON THAT WORKS. It is disabled, not merely styled grey — a row that looks refused and
 * still picks is the worst of both, and its refusal would land on the far side of a whole authored card.
 */
function KindRow({
  opt,
  on,
  onPick,
}: {
  opt: CategoryChoice;
  on: boolean;
  onPick: () => void;
}) {
  const locked = opt.standing === 'locked';
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={locked}
      title={locked ? opt.why : undefined}
      onClick={onPick}
      className="sn-press flex min-h-[52px] w-full items-center gap-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-55"
      data-kind-row={opt.value}
    >
      <RowIcon><List aria-hidden className="h-5 w-5" strokeWidth={1.75} /></RowIcon>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] text-ink">{opt.label}</span>
        {opt.hint || locked ? (
          <span className="block truncate text-[13px] text-ink/55">{locked ? 'Needs a bigger plan' : opt.hint}</span>
        ) : null}
      </span>
      {on ? (
        <Check aria-hidden className="h-5 w-5 flex-none" style={{ color: 'rgb(var(--color-ok))' }} strokeWidth={2.2} />
      ) : (
        <ChevronRight aria-hidden className="h-4 w-4 flex-none text-sn-accent" strokeWidth={2} />
      )}
    </button>
  );
}

// ── Audience chips (the coverage-panel idiom, split for reading) ────────────
// parity:ignore-start — belongs to the sibling coverage form above. The field
// name here is `coverageField`, whose TYPE admits only the two shipped
// vendor_coverages column names, so this passthrough can never grow a third.

function ChipGroup({
  heading,
  blurb,
  options,
  coverageField,
  selected,
  onToggle,
  disabled,
}: {
  heading: string;
  blurb: string;
  options: AudienceOption[];
  /** The vendor_coverages column this group writes. Exhaustive by type. */
  coverageField: 'event_types' | 'faiths';
  selected: string[];
  onToggle: (key: string) => void;
  disabled: boolean;
}) {
  if (options.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.13em]" style={{ color: 'var(--m-slate-3)' }}>
        {heading}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o.key);
          return (
            <label
              key={o.key}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs"
              style={{
                borderColor: on ? 'var(--m-orange-3)' : line,
                background: on ? 'var(--m-orange-4)' : paper,
                color: on ? 'var(--m-orange-2)' : 'var(--m-slate)',
                opacity: disabled ? 0.5 : 1,
              }}
            >
              <input
                type="checkbox"
                name={coverageField}
                value={o.key}
                checked={on}
                disabled={disabled}
                onChange={() => onToggle(o.key)}
                className="hidden"
              />
              {on ? <Check aria-hidden className="h-3 w-3" strokeWidth={2.5} /> : null}
              {o.label}
            </label>
          );
        })}
      </div>
      <p className="text-[11px]" style={{ color: 'var(--m-slate-3)' }}>{blurb}</p>
    </div>
  );
}
// parity:ignore-end

// ── The sheet container ─────────────────────────────────────────────────────

/**
 * A bottom sheet. It holds CHOICES and SIBLING FORMS only — never a field of the card form: it portals to `<body>`
 * (see below), and a portalled input is outside the card's `<form>`, so it would never post (the 2026-09-07 → 10-14
 * fault this rebuild ended).
 *
 * Keeps the shipped primitive's contract — role="dialog", aria-modal, aria-labelledby, Esc, focus trap + restore,
 * scroll lock, backdrop-dismiss, via `useModalA11y` — and is hidden with the `hidden` attribute when shut, so a
 * sibling form's typed state survives a close.
 *
 *   • the root carries NO Tailwind display utility (`.flex` would out-cascade `[hidden]{display:none}`);
 *   • toggling display none→block restarts the CSS animation, so the rise replays on every open.
 */
function CanvasSheet({
  id,
  title,
  open,
  onClose,
  confirmLabel = 'Update card',
  footer = null,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onClose: () => void;
  /** The explicit confirm at the sheet's foot (owner 2026-07-28). Pass null when the sheet carries its own control. */
  confirmLabel?: string | null;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y({ open, onClose, containerRef: dialogRef });

  /**
   * 🔝 ABOVE THE FRAME THAT HOSTS THE MAKER (live 2026-11-06). The maker is also drawn INSIDE a sheet — Today's "What you
   * offer → ＋ Start" opens it in the shared `Sheet` (`setup-offer-fold.tsx`), which sits on the modal layer (z-50). This
   * root was `z-40` (the pop layer), so every sheet the maker opens — What you offer, Ask us, Preview, Who it's for,
   * Delete — opened BEHIND that sheet: the tap looked dead and a new supplier could not make a card from Today. It takes
   * the house layer above the modal (`--sn-z-toast`, the one the report sheet and the pay confirm already open over a
   * Sheet on), so it clears the standalone page and the Today sheet alike. 🔒 `the-maker-sheets-open-on-top.test.ts`.
   *
   * 🔑 PORTAL TO <body> — `position: fixed` is relative to the nearest TRANSFORMED ancestor, and `.sn-page-enter`
   * carries an identity transform (measured 2026-09-07: the backdrop was 184 px tall). The same fix
   * `category-search-overlay.tsx` and `team-summary-chip.tsx` carry.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div hidden={!open} className="fixed inset-0 z-sn-toast">
      {/* Phone: the one scrim (`<OverlayBackdrop>`, owner 2026-10-29). Desktop: the canvas stays clear beside the sheet
          (it is the live preview), so a clear catcher closes it instead. */}
      <OverlayBackdrop onClose={onClose} className="lg:hidden" />
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 hidden cursor-default lg:block" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        className={`sn-canvas-sheet absolute inset-x-0 bottom-0 mx-auto max-h-[86dvh] ${
          'lg:inset-y-0 lg:left-auto lg:right-0 lg:mx-0 lg:my-auto lg:h-fit lg:max-h-[86dvh] lg:max-w-[420px] lg:rounded-3xl lg:mr-6'
        } w-full max-w-[560px] overflow-y-auto rounded-t-3xl border shadow-[0_-12px_40px_rgba(0,0,0,0.18)] focus:outline-none`}
        style={{ borderColor: line, background: paper }}
      >
        <header
          className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur"
          style={{ borderColor: line, background: 'color-mix(in srgb, var(--m-paper) 92%, transparent)' }}
        >
          <h2 id={`${id}-title`} className="text-[17px] font-semibold leading-snug" style={{ color: 'var(--m-ink)' }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-full"
            style={{ color: 'var(--m-slate-2)' }}
          >
            <X aria-hidden className="h-5 w-5" strokeWidth={2} />
          </button>
        </header>
        <div className="sn-canvas-rise space-y-3 px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
          {children}
          {footer}
          {confirmLabel !== null ? (
            // type="button" is LOAD-BEARING: a default-submit button inside a form would submit it.
            // The shipped ActionButton, green — the press that closes a picker (makers prototype 7 Nov 2026).
            <div className="flex justify-center" data-sheet-confirm="">
              <ActionButton type="button" tone="ok" main icon={Check} onClick={onClose} label={confirmLabel} />
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
