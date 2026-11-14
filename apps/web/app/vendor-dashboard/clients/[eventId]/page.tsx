import Link from 'next/link';
import { weekdayDateWithYear } from '@/lib/format-date';
import { bookingFeeAttribution, SETNAYAN_SAVE_SOURCES, SUPPLIER_BROUGHT_SOURCES } from '@/lib/booking-fee-gate';
import { customerLandingHref } from '../../customers/anchors';
import { CoupleLogo } from '@/app/_components/couple-logo';
import { SaveFileLink } from '@/app/_components/save-file-link';
import { coupleLogoPlays } from '@/lib/couple-logo-plays';
import { logoPlaysFor } from '@/lib/logo-plays.server';
import { redirect } from 'next/navigation';
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Church,
  Clock3,
  FilePlus2,
  FileText,
  Paperclip,
  History,
  Info,
  LayoutGrid,
  Link2,
  Martini,
  MessageSquare,
  MessageSquarePlus,
  PackageCheck,
  Palette,
  ScrollText,
  Sparkles,
  UserRound,
  Users,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ServerTimer } from '@/lib/server-timing';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { readEventsYouRun } from '@/lib/events-you-run.server';
import { OpenTheirEvent } from './_components/open-their-event';
import { Badge } from '@/app/_components/badge';
import { getEditorialEligibility } from '@/lib/editorial-vendor-media';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { BoothPosterCard } from './_components/booth-poster-card';
import { BoothStudioCard } from './_components/booth-studio-card';
import { boothStudioEnabled } from '@/lib/booth-studio-flag';
import { sanitizeBoothStudioContent, type BoothStudioContent } from '@/lib/booth-studio';
import { VendorChallengeSection } from './_components/vendor-challenge-section';
import { BoothEventSection } from './_components/booth-event-section';
import { deriveCallTime } from '@/lib/vendor-timeline';
import {
  fetchVendorThreads,
  fetchReturningClientFlags,
  type ReturningClientFlag,
} from '@/lib/chat';
import {
  fetchPlanProgressForVendor,
  fetchPendingVendorPayments,
} from '@/lib/vendor-service-payment-schedules.server';
import { awaitsTheSupplier } from '@/lib/payment-refusal';
import { readVendorHeadcountRule, type SupplierHeadcount } from '@/lib/supplier-count.server';
import { loadRoleNames } from '@/lib/role-names.server';
import type { RoleNames } from '@/lib/role-names';
import { SupplierCountTile } from './_components/supplier-count-tile';
import {
  PROPOSAL_STATUS_LABEL,
  PROPOSAL_STATUS_TONE,
  formatCentavos,
  type ProposalStatus,
} from '@/lib/vendor-proposals';
import { SubmitButton } from '@/app/_components/submit-button';
import { RunOfShowHeader } from '@/app/_components/run-of-show-header';
import type { RunOfShowBlock } from '@/lib/run-of-show';
import {
  CardTabs,
  PipelineStrip,
  normalizeTab,
  type CustomerCardTab,
} from './_components/customer-card-nav';
import { ScriptTab } from './_components/script-tab';
import { CoupleAnswers } from './_components/couple-answers';
import { resolveVendorSpecializationAccessForVendor } from '@/lib/vendor-specialization-gate.server';
// The coordinator's ask, reused exactly as the live floor console mounts it —
// same component, same action, same host-side answering screen.
import { AskAccess } from '@/app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/ask-access';
import { fetchMyAreaGrants, fetchMyPendingAsk } from '@/lib/my-area-grants.server';
import { FLOOR_REQUESTABLE_AREAS } from '@/lib/floor-command';
import { readMyLastAccessAnswer } from '@/lib/my-access-ask.server';
import { readAsksForCoordinator } from '@/lib/coordinator-answers.server';
import { CoordinatorAnswers } from './_components/coordinator-answers';
import { ProposeChange } from './_components/propose-change';
import { ChangeRequestsQueue } from '@/app/_components/change-requests/change-requests-queue';
import { readMyChangeRequests, readOpenChangeRequests, readProposeTargets } from '@/lib/change-requests.server';
import { proposableOps } from '@/lib/change-requests';
import { isBookedCoordinator } from '@/lib/coordinator-trade';
import type { DelegateArea } from '@/lib/delegate-areas';
import { holdsSpecialization } from '@/lib/vendor-specialization-gate';
import { resolveEventFeeGate, resolveFeeEnforcement } from '@/lib/vendor-event-fee-access.server';
import { redactBriefForStage, reconcileStageWithPayload } from '@/lib/event-access-stage';
import { EventLockedByFee } from '@/app/vendor-dashboard/_components/event-locked-by-fee';
import { tilesForVendorCategories } from '@/lib/vendor-category-taxonomy';
// ONE definition of a category's name. A file-local `CATEGORY_LABELS` used to
// live here with 28 of the 52 categories, so `CATEGORY_LABELS[c] ?? c` printed
// the RAW ENUM KEY for the other 24 — `funeral_home`, `crew_meals`,
// `av_production` — and the call-time row wrote that key into a PERSISTED
// `proposed_label`. Ten of the 28 it did have also disagreed with the shared
// map ("Cake" vs "Cake maker"), so one category read two ways on two supplier
// screens. See `lib/one-word-per-category.test.ts`.
import { displayServiceLabel } from '@/lib/vendors';
import { ActivityFeed, type ActivityEvent } from './_components/customer-card-activity';
import type { ClientNote } from './_components/customer-card-notes';
import {
  suggestScheduleChange,
  vendorMarkServiceComplete,
  vendorAcknowledgeDeposit,
  vendorRejectDeposit,
  vendorPostHandover,
  vendorRaiseChangeOrder,
  vendorRespondChangeOrder,
  vendorWithdrawChangeOrder,
  vendorAgreeToLock,
  vendorDeclineLock,
  vendorWaitlistTheAsk,
} from './actions';
import { readDayCheck } from '@/lib/day-check.server';
import { heldServiceOfAsk } from '@/lib/service-plan-hold.server';
import { BookingAskOutcomeLine, LockAnswerLine, LockRequestAnswer } from './_components/booking-ask-panel';
import type { CarryOverTopUp } from './_components/top-up-carry-over';
import { overdueTopUps, topUpOwedPhp, topUpStage } from '@/lib/booking-fee-top-up';
import { readSettlePay } from '@/lib/booking-fee-settle-pay.server';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import type { SettlePay } from '@/app/_components/payment/settle-pay-by';
import { TopUpSettleSheet } from '@/app/_components/top-up-settle-sheet';
import { vendorBookingFeePayPath } from '@/lib/vendor-booking-fees';
import { supplierAskOutcomeOf, type SupplierAskRow } from '@/lib/booking-ask-words';
import { lockAgreeFeeHeld, lockAgreeHalls, lockAgreeNotice, lockDeclineNotice } from '@/lib/lock-answer-notice';
import { isLockHandshakeEnabled } from '@/lib/lock-handshake-flag';
import { PaymentAsksPanel } from './_components/payment-asks-panel';
import { CustomerMoneyFold } from './_components/customer-money-fold';
import type { ClientRefundView } from './_components/client-refunds';
import { CLIENT_REFUND_SELECT, clientRefundOf, type ClientRefundDbRow } from '@/lib/client-refunds';
import { BookingMoneySummary } from './_components/booking-money-summary';
import { bookingMoney, manilaTodayIso, type BookingMoney } from '@/lib/vendor-cashflow';
import { readVendorPaydayInstallments } from '@/lib/vendor-payday-read';
import { AppointmentsSection } from '@/app/_components/appointments-section';
import {
  appointmentCategoriesFor,
  resolveAppointmentLabel,
  type AppointmentKind,
  type AppointmentTypePreset,
  type AppointmentView,
} from '@/lib/appointments';
// Relationship Workspace shell (flag-gated · 2026-07-11). When
// NEXT_PUBLIC_RELATIONSHIP_WORKSPACE_ENABLED is set, the SAME tab components are
// re-grouped into the unified chat-first shell (Chat · Quote · Payments · Files ·
// Schedule · Call · Details) — a true two-sided mirror of the couple's Vendor
// Workspace. Otherwise the current tabbed page renders byte-for-byte unchanged.
import { isRelationshipWorkspaceEnabled } from '@/lib/relationship-workspace-flag';
import { pipelineCurrentLabel, supplierNextMove } from '@/lib/supplier-next-move';
import { ClientDayAnswers } from '../../_components/client-day-answers';
import { detailsNumbers } from './_components/details-numbers';
import { readShopPerGuest } from '@/lib/claimed-per-guest-shop.server';
import { DetailsNumbersRow } from './_components/details-numbers-row';
import { HostsList } from './_components/hosts-list';
import { SuppliersList } from './_components/suppliers-list';
import { supplierRows } from './_components/suppliers-rows';
import { ScheduleCalendar } from './_components/schedule-calendar';
import { DetailsDecisions } from './_components/details-decisions';
import { DetailsFormsDoor } from './_components/details-forms-door';
import { hostRows } from './_components/hosts-rows';
// 🗂 THE PICKED CLIENT (THE ONE BUILD, 8 Nov 2026) — the flag-ON shell, its nine page bodies and the page-id switch.
import { PickedClientShell } from './_components/picked-client-shell';
import { PickedClientSettings } from './_components/picked-client-settings';
import {
  SCRIPT_FOLD_ID,
  pickedMenuFor,
  visiblePickedPage,
  wantsScriptFold,
} from './_components/picked-client-menu';
import { pickedPageBodies } from './_pages/switch';
import type { PickedPageContext } from './_pages/context';
import { FilesPage } from './_pages/files';
import { EventFilesSection } from './_pages/event-files';
import { ReservationLine } from './_pages/payment';
// Call launcher is code-split (WebRTC · ssr:false) so the Call tab's bundle
// stays out of the initial page JS until that tab mounts — see the lazy loader.
// Payments tab — reuse the vendor thread's LIVE payment-confirm surface
// (couple-logged payments awaiting confirmation + plan progress / "mark cleared").
// Reused as-is; no payment logic is reimplemented here.
import { VendorPaymentLive } from '../../messages/[threadId]/_components/vendor-payment-live';
import { safeMonogramSvg } from '@/lib/monogram-svg-safe';
import { centreLogoOnItsInk } from '@/lib/logo-layers';
import { bespokeSvgToDataUri } from '@/lib/bespoke-monogram-shared';
import { isMissingRelationError, logQueryError } from '@/lib/supabase/error-detect';
import { readThreadUnreadCount } from '@/lib/couple-inbox';
import {
  buildSharedFiles,
  type ChatFileInput,
  type SharedFileEntry,
} from '@/lib/chat-shared-files';
// The tree kit (W4-B): `Card` here IS ShopCard — the local definition this
// file used to carry was byte-identical to the kit's dominant card recipe.
import { ShopCard, ShopCard as Card, ShopEmpty, shopInputClass } from '../../_components/kit';
import { depositProofDisplayUrl } from '@/lib/deposit-proof.server';
import { ProofImage } from '@/app/_components/proof-image';
import {
  MONEY_TAB,
  VENDOR_CLIENT_TABS,
  vendorClientTabHref,
  type VendorClientTab,
} from '@/lib/vendor-client-return';
import {
  acceptedQuoteTerms,
  firstPaymentSentence,
  pesoFromCentavos,
  supplierFirstPaymentStatus,
  moneyStepLine,
  type SupplierFirstPaymentStatus,
} from '@/lib/accepted-quote-terms';
import { readBookedMoney } from '@/lib/booked-money-step.server';
import { PaymentHistoryList } from '@/app/_components/payment-history-list';
import type { PaymentHistory } from '@/lib/payment-history';
import { recordedDepositPhp, type LoggedPayment } from '@/lib/paid-to-vendor';
import { readSupplierPayoutReadiness } from '@/lib/vendor-payment-methods.server';
import type { PayoutReadiness } from '@/lib/deposit-pay-step';
import { PayoutMethodNudge } from '@/app/vendor-dashboard/_components/payout-method-nudge';
import {
  fetchDueFeeBills,
  fetchWaivedFeeCharges,
  FEE_BILLS_UNREADABLE,
  forecastForBooking,
} from '@/lib/booking-fee-disclosure.server';
import {
  billsForSurface,
  feeDueCopy,
  type DueFeeBill,
  type FeeDisclosure,
  type WaivedFeeCharge,
} from '@/lib/booking-fee-disclosure';
import { BookingFeeBills, WaivedFeeRows } from '@/app/_components/booking-fee-notice';
import { manilaToday } from '@/lib/std-views';
import { readOpenPaymentAsks, type OpenPaymentAskRow } from '@/lib/vendor-payment-asks-read';
import { formatWallClock } from '@/lib/schedule-datetime-local';
import { formatCount } from '@/lib/format-number';
import { VENUE_CATEGORIES, supplierOwnWhere, whereChaptersFrom, type OwnBooking } from '@/lib/supplier-where';
import { readTradeChapters, suggestedChapters } from '@/lib/trade-chapters';
import { blocksWithAClock, buildSupplierDay, changedSinceSeen, inFinalWeek, type SupplierContactRow, type SupplierTaskRow } from '@/lib/supplier-schedule';
import { SCHEDULE_MARK_COLUMNS } from '@/lib/supplier-schedule-marks';
import { TASK_COLUMNS } from '@/lib/schedule-chapters';
import { SupplierSchedule } from './_components/supplier-schedule';
import { ScheduleSavedMark } from '@/app/_components/offline-ready/schedule-saved-mark';
import { OFFLINE_COPY_UNREAD, copyVersionOf, supplierSchedulePath } from '@/lib/offline-copies';
import { readCrewElsewhere } from '@/lib/crew-elsewhere.server';
import { askedOfYou, directionOf } from '@/lib/schedule-ask';
import type { ComponentProps } from 'react';
import { StayForm } from '@/app/_components/stay-form';

export const metadata = { title: 'Customer Card · Supplier' };

/**
 * Vendor Customer Card — the client detail view, respined (PR-2 of the Customer
 * Card program; design source 03_Strategy/Customer_Card_Prototype_2026-07-03.html
 * View 2). One card: a sticky header (avatar · names · event meta · stage pill ·
 * source badge · booked-category chips · action row), a 5-step pipeline strip
 * (Inquiry → Quoted → Booked → Delivered → Reviewed), and five tabs — Overview /
 * Quote & Payments / Files / Schedule / Activity — behind a `?tab=` search param.
 *
 * Stage-aware: the backing RPC (get_vendor_event_brief) returns stage
 * 'booked' | 'requested' | 'inquiry'. Since 20271235469220 (owner, 2026-09-20:
 * "they already see everything from the starts") every stage carries the same
 * brief — venue, address, headcount, meals, seat-plan size, run-of-show — and
 * opens for any live relationship (a thread, an ask, a shortlist row). What
 * stays booked-only is the WORK: suggest forms, handovers, the floor-plan and
 * production-sheet pages, the rival roster. Redirects on any RPC error (no
 * relationship to this event, or the event doesn't exist).
 *
 * Aggregates only: the RPC never returns guest rows; guest names never render.
 * Free for every vendor tier — tiers sell reach, not features.
 */

type Brief = {
  /**
   * THREE rungs since PR-H slice B. `'requested'` = the couple has ASKED this
   * supplier and nobody has answered. Since 20271235469220 every rung carries
   * the real venue, address, timeline, seat-plan size and (food categories)
   * dietary counts; the label decides what the supplier can DO, not see.
   */
  stage: 'booked' | 'inquiry' | 'requested';
  /** C2 (`-data`): the event's hosts — `event_chat_hosts()` rows; parsed by `chatHostsFrom` (`hostRows`). */
  hosts?: unknown;
  /** Present ONLY at stage 'requested'. Every field is a fact about this
   *  supplier's own row, never about the wedding. */
  lock_request?: {
    event_vendor_id: string;
    category: string | null;
    requested_at: string | null;
    expires_at: string | null;
  } | null;
  event: {
    display_name: string | null;
    event_date: string | null;
    venue_name: string | null;
    venue_address: string | null;
    region?: string | null;
    ceremony_type: string | null;
  };
  booked_categories: string[];
  pax: { invited: number; attending: number; maybe: number; pending: number; declined: number };
  dietary: { meal_counts: Record<string, number>; restriction_notes: number } | null;
  // Couple opt-in budget RANGE for this vendor's category (Customer Card respine
  // PR-5). NULL unless the couple opted in AND allocated to the vendor's
  // category(ies). Range-only — the exact figure is never recoverable.
  budget_band: { lo_centavos: number; hi_centavos: number } | null;
  palette: Record<string, string[]>;
  attire_guide: Record<string, unknown>;
  monogram: {
    text: string | null;
    color: string | null;
    font_key: string | null;
    frame_key: string | null;
    custom_svg: string | null;
  };
  timeline: {
    label: string;
    block_type: string;
    start_at: string | null;
    end_at: string | null;
    location: string | null;
  }[];
  seat_plan: {
    published: boolean;
    published_at: string | null;
    table_count: number;
    assigned_guests: number;
  };
};

const PALETTE_LABELS: Record<string, string> = {
  ceremony: 'Ceremony',
  reception: 'Reception',
  bride: 'Bride',
  groom: 'Groom',
  guest: 'Guest dress code',
  wedding_party: 'Wedding party',
  vip_family: 'VIP family',
  principal_sponsors: 'Principal sponsors',
  secondary_sponsors: 'Secondary sponsors',
  bearers_flower_girl: 'Bearers & flower girl',
  officiants: 'Officiants',
};

const MEAL_LABELS: Record<string, string> = {
  beef: 'Beef',
  chicken: 'Chicken',
  fish: 'Fish',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  kids: 'Kids meal',
  no_preference: 'No preference',
};


function fmtDate(iso: string | null): string {
  if (!iso) return 'Date not set yet';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmtShortDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** ⏱ A schedule time is the venue wall clock — read its digits, never re-zone. */
function fmtTime(iso: string | null): string | null {
  if (!iso) return null;
  return formatWallClock(iso) || null;
}

function fmtCODate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function fmtDelta(raw: number | string | null): string {
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (n === null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n).toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `−${abs}` : `+${abs}`;
}

function fmtPeso(php: number | null): string {
  if (php == null || !Number.isFinite(php)) return '—';
  return `₱${php.toLocaleString('en-PH', {
    minimumFractionDigits: php % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Whole-peso label from a centavos amount (bands are always ₱5,000-quantized). */
function fmtPesoCentavos(centavos: number | null): string {
  if (centavos == null || !Number.isFinite(centavos)) return '—';
  return `₱${Math.round(centavos / 100).toLocaleString('en-PH')}`;
}

/** Initials for the avatar — from the event display name (never a guest name). */
function coupleNameOrFallback(name: string | null): string {
  return name?.trim() || 'This couple';
}

function initials(name: string | null): string {
  if (!name) return '—';
  const words = name
    .replace(/[–—&]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const letters = words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '');
  return letters.join('') || name.slice(0, 2).toUpperCase();
}

const CO_STATUS: Record<VendorChangeOrderRow['status'], { label: string; cls: string }> = {
  proposed: { label: 'Awaiting response', cls: 'border-warn-300 bg-warn-50 text-warn-900' },
  accepted: { label: 'Accepted', cls: 'border-success-400 bg-success-50 text-success-700' },
  declined: { label: 'Declined', cls: 'border-ink/15 bg-ink/5 text-ink/60' },
  withdrawn: { label: 'Withdrawn', cls: 'border-ink/15 bg-ink/5 text-ink/60' },
};

type LiveBlock = {
  block_id: string;
  label: string;
  block_type: string;
  start_at: string | null;
  end_at: string | null;
  location: string | null;
  run_state?: 'upcoming' | 'live' | 'done' | 'skipped' | null;
  actual_start_at?: string | null;
  // 📖 Chapters (Step 4b): a top-level block is a chapter, a child its moment — never `notes` (couple-private).
  parent_block_id?: string | null;
  spot?: string | null;
  time_tba?: boolean | null;
  /** ⏭ An untimed moment's anchor — "right after the one above" (migration 20271302727358). */
  follows_block_id?: string | null;
  sort_order?: number | null;
  /** 🕑 "About 3:15" · "2:15/2:30" (migration 20271303051692). */
  time_shape?: string | null;
  time_or_minutes?: number | null;
  is_optional?: boolean | null;
  responsible_vendor_ids?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
  /** 🏛 Venue hours (migration 20271307658341): the setup / pack-up window and the venue booking that holds them. */
  ingress_minutes_before?: number | null;
  egress_minutes_after?: number | null;
  hours_vendor_id?: string | null;
};

type HandoverRow = {
  handover_id: string;
  kind: 'gallery_link' | 'file' | 'note' | 'signoff';
  label: string | null;
  payload: string | null;
  status: 'delivered' | 'acknowledged' | 'disputed';
  delivered_at: string;
  couple_acknowledged_at: string | null;
};

type SuggestionRow = {
  suggestion_id: string;
  block_id: string | null;
  kind: 'adjust' | 'new' | 'remove' | 'hours' | 'where' | 'skip';
  /** 📍 A Where request (migration 20271308641275): their booking and the chapters asked. */
  where_vendor_id?: string | null;
  proposed_block_ids?: string[] | null;
  /** For a 'remove', the moment's label as it was when asked — the block may be gone. */
  proposed_label: string | null;
  proposed_start_at: string | null;
  proposed_end_at: string | null;
  /** + My moment: the chapter it goes into (Step 4b). */
  proposed_parent_block_id: string | null;
  proposed_crew: string[] | null;
  note: string;
  /** 'withdrawn' = Take back (Step 4b). */
  status: 'open' | 'accepted' | 'declined' | 'withdrawn';
  /** Went straight in under the host's Auto-agree — no person decided (Step 4b). */
  auto_agreed?: boolean | null;
  created_at: string;
  /** 🔁 'to_supplier' = a host's or the coordinator's ask OF this supplier (D2) — theirs to answer, not their request. */
  direction?: string | null;
  suggested_by_name?: string | null;
  asked_as?: string | null;
  answer_note?: string | null;
};

type VendorChangeOrderRow = {
  change_order_id: string;
  raised_by: 'couple' | 'vendor';
  title: string | null;
  description: string | null;
  delta_amount_php: number | string | null;
  proposed_due_date: string | null;
  status: 'proposed' | 'accepted' | 'declined' | 'withdrawn';
  acknowledged_at: string | null;
  decline_reason: string | null;
  created_at: string;
};

/** One open "please send ₱X" this shop has put to this customer. */
type PaymentAskRow = {
  ask_id: string;
  /** PostgREST returns NUMERIC as a string; never assume a number. */
  amount_php: number | string | null;
  note: string | null;
  due_date: string | null;
  status: 'open' | 'withdrawn';
  created_at: string;
};

type ProposalRow = {
  proposal_id: string;
  public_id: string;
  title: string | null;
  status: ProposalStatus;
  total_centavos: number;
  valid_until: string | null;
  sent_at: string | null;
  created_at: string;
  /** Read for the accepted quote's terms (`acceptedQuoteTerms`). */
  line_items: unknown;
  payment_schedule: unknown;
};

type ContractRow = {
  contract_id: string;
  title: string | null;
  file_name: string | null;
  file_url: string | null;
  status: string;
  created_at: string;
};

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    tab?: string;
    suggest?: string;
    lens?: string;
    deposit_ack?: string;
    deposit_reject?: string;
    change_order?: string;
    change_order_resp?: string;
    handover?: string;
    /** A refused note write (`noteSaved`, actions.ts) — said in the notes list. */
    note?: string;
    /** vendorMarkServiceComplete's outcome — see VendorCompletionCard. */
    completed?: string;
    /** The payment-ask outcome flag — see PaymentAsksPanel. */
    ask?: string;
    /** `vendorAgreeToLock` / `vendorDeclineLock` answered from THIS card
     *  (`return_to`) — the sentence is said where the supplier pressed. */
    lock_agree?: string;
    /** `held` — the couple's news waits on the booking fee (`vendorAgreeToLock`). */
    fee?: string;
    lock_decline?: string;
    /** `hall_taken` — the card's taken halls and the free ones to offer (`lockAgreeHallsParam`). */
    taken?: string;
    free?: string;
    competing?: string;
  }>;
};

const HANDOVER_KIND_LABEL: Record<'gallery_link' | 'file' | 'note' | 'signoff', string> = {
  gallery_link: 'Album link',
  file: 'Sample / proof',
  note: 'Note',
  signoff: 'All delivered',
};

export default async function VendorCustomerCardPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;
  const tab: CustomerCardTab = normalizeTab(search.tab);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  // 🗂 Does this person RUN this couple's event as their coordinator, live? (owner "approved", 2026-10-28) — the
  // layout's cache()d read of their own seats, started now and read at the header, so it adds no trip. Fails closed.
  const eventsYouRunP = readEventsYouRun(supabase, user.id).catch(() => ({ events: [], measured: false }));

  // Stage gate + aggregation live inside the SECURITY DEFINER RPC. An error
  // means the vendor is neither booked nor holds an accepted inquiry on this
  // event (or it doesn't exist); bounce to Clients — UNCHANGED from before.
  const { data, error } = await supabase.rpc('get_vendor_event_brief', {
    p_event_id: eventId,
  });
  if (error || !data) redirect('/vendor-dashboard/clients');
  const rawBrief = data as Brief;
  const isBooked = rawBrief.stage === 'booked';

  // ── THE BOOKING FEE UNLOCKS THE EVENT (owner, 2026-09-20) ────────────────
  // Flag OFF ⇒ the stage is 'unlocked' for everybody and `redactBriefForStage`
  // is a NO-OP, so this whole block is byte-behaviour-identical to today.
  //
  // Flag ON ⇒ a supplier who has not settled the fee keeps the QUOTING payload
  // (event type · date · area · guest count · their own service · the couple's
  // preferences · the budget band) and loses the operating detail. The lock is
  // resolved SERVER-side here, never in a component, and `withheld` is carried
  // into the render so a redacted field can never read as an empty wedding.
  //
  // ⚠ THE QUOTE / PAYMENTS TAB AND THE CONVERSATION ARE NEVER GATED — a locked
  // supplier must always be able to talk and to pay (`ALWAYS_OPEN_SURFACES`).
  //
  // 🔒 AND SINCE MIGRATION 20271236283573 THE DATABASE NARROWS THE SAME FIELDS
  // ITSELF (the RPC is SECURITY DEFINER; a supplier could call it from their own
  // session and read what this page hid). `reconcileStageWithPayload` takes the
  // RPC's own `withheld` list as decisive: if SQL says it took the venue, this
  // page shows the locked panel even if the flag read came back 'unlocked' —
  // otherwise the booked layout would be drawn over NULLs and read as a wedding
  // with nothing planned.
  const rawGate = await resolveEventFeeGate(profile.vendor_profile_id, eventId, {
    booked: isBooked,
  });
  const feeGate = {
    ...rawGate,
    stage: reconcileStageWithPayload(rawGate.stage, rawBrief),
  };
  const { brief, withheld: feeWithheld } = redactBriefForStage(rawBrief, feeGate.stage);
  const feeUnlocked = feeGate.stage === 'unlocked';
  // 🔒 ONE BOOLEAN, AND IT IS THE NEGATIVE OF 'booked' — NOT `stage === 'inquiry'`.
  // This used to read `stage === 'inquiry'`, which was correct while there were
  // exactly two rungs and became a LEAK-SHAPED BUG the moment a third arrived:
  // an asked supplier would have fallen through every `isInquiry` branch into
  // the BOOKED render — the exact-venue panel, the meal counts, the full
  // run-of-show — on a payload where all of those are NULL or empty. Not a data
  // leak (the RPC withholds them), but a screen that claims to be showing a
  // booked client's day and shows blanks instead of saying what is actually
  // true. Deriving from `!isBooked` means the next rung is safe by default: a
  // new stage discloses nothing until somebody deliberately opens it.
  const preAgreement = !isBooked;

  // 🔒 WHO MAY ADVANCE THE PROGRAMME — computed, because it used to be the
  // literal `canAdvance`.
  //
  // `advance_schedule_block` now admits the booked COORDINATOR and no other
  // supplier (migration 20271227867922; before it, every booked vendor). This
  // page is one supplier's workspace, so the button was being shown to the
  // caterer and the florist too. Narrowing the database without narrowing this
  // would have MOVED the defect rather than fixed it: a control that is pressed
  // and refused is worse than a control that is absent — and worse still here,
  // because the thing it appears to move is somebody's ceremony.
  //
  // The predicate is the coordinator tile, the same fact
  // `current_coordinator_booked_event_ids()` joins on (`'coordinator' = ANY
  // (vp.services)`), so the screen and the gate cannot disagree about who this
  // is. Booking is the other half and it is already established: everything
  // below this point renders only when `isBooked`, and the RPC re-checks both
  // regardless — this decides what to DRAW, never what is permitted.
  // 🧭 THE ONE FACT (owner 8 Nov 2026): booked AND the coordinator trade — `isBookedCoordinator`, the TS mirror of
  // `public.is_booked_coordinator(event)` (migration 20271329284628). Never the `wedding_planner_external` seat.
  const theBookedCoordinator = isBookedCoordinator({
    booked: isBooked,
    services: (profile as { services?: string[] | null }).services,
  });
  const lockRequest = brief.stage === 'requested' ? (brief.lock_request ?? null) : null;

  // ── ASKING THE HOST FOR ACCESS, ON A DAY THAT IS NOT THE WEDDING ──────────
  // 🚨 THE ASK EXISTED AND COULD ONLY BE REACHED ON THE EVENT DAY. The whole
  // request half of the owner's 2026-08-24 ruling — "only the owner of the
  // event and coordinator (by request)" — lived in the live floor console,
  // and that page redirects unless the booking is dated TODAY. So a
  // coordinator planning a wedding for six months could not ask for the guest
  // list until the morning of it, which is the one day nobody wants to be
  // waiting on an answer. Same shape as a gate with no handle: the handle
  // existed for 24 hours.
  //
  // The component, the action and the host's answering screen are all reused
  // untouched. Only booked suppliers may ask (the action re-checks it server
  // side against the booking pool, so this is a display rule, not the gate).
  // …and the last ANSWER (owner 8 Nov 2026: the supplier sees what they asked for and what they got) — the third read
  // of the same round trip.
  // 🤝 …and, for the BOOKED COORDINATOR only, the other suppliers' asks waiting on them (owner 8 Nov 2026: "only
  // coordinator and hosts has the final say") — a fourth read in the same round trip, never for anybody else.
  // ✍️ …and the suppliers' proposed changes waiting on the coordinator (a fifth read, the coordinator only).
  const [myGrants, myPendingAsk, myLastAnswer, asksForMe, changesForMe] = isBooked
    ? await Promise.all([
        fetchMyAreaGrants(eventId),
        fetchMyPendingAsk(eventId),
        readMyLastAccessAnswer(supabase, eventId, user.id),
        theBookedCoordinator ? readAsksForCoordinator(supabase, eventId) : Promise.resolve(null),
        theBookedCoordinator ? readOpenChangeRequests(supabase, eventId) : Promise.resolve(null),
      ])
    : [{} as Partial<Record<DelegateArea, 'edit' | 'view' | null>>, null, null, null, null];
  // ✍️ A supplier who is NOT the coordinator, holding the guest list, the seat plan or the suppliers, PROPOSES changes
  // (owner 8 Nov 2026). Their composer's targets and their own changes — one more round trip, only for them.
  const proposeOps = isBooked && !theBookedCoordinator ? proposableOps(myGrants) : [];
  const [proposeTargets, myChanges] =
    proposeOps.length > 0
      ? await Promise.all([readProposeTargets(supabase, eventId, proposeOps), readMyChangeRequests(supabase, eventId, user.id)])
      : [null, null];
  // Only what the host has not already shared — asking for what you hold
  // spends the host's attention on nothing.
  const askableAreas = FLOOR_REQUESTABLE_AREAS.filter((a) => !myGrants[a]) as DelegateArea[];

  const admin = createAdminClient();
  const clientTimer = new ServerTimer('vendor-dashboard/customer-card');

  // One parallel round-trip for everything the card needs beyond the brief.
  //   • source row (event_vendors.source → In-house vs Imported) + completion
  //     handshake state + deposit state. Admin-read (already booked/inquiry-gated
  //     above); the source discriminator drives the header badge.
  //   • this org's proposals for the event (vendor-org RLS).
  //   • this org's contracts for the event (vendor owns vendor_contracts).
  //   • this org's threads (resolve the thread_id for this event → chat / log-pay).
  //   • editorial-media eligibility, cocktail-editability probe, live timeline
  //     rows, this org's suggestion history — all as before.
  const [
    { data: evRow },
    { data: proposalRows, error: proposalRowsError },
    { data: contractRows },
    threads,
    editorialEligibility,
    { data: cocktailEdit },
    { data: posterRow },
    { data: liveBlocks },
    { data: mySuggestions, error: mySuggestionsError },
    returningFlags,
    myTasksRes,
    myMarksRes,
    myScheduleFacts,
    myContactsRes,
    headcountRule,
    headcountNames,
  ] = await clientTimer.track('customer-card', () =>
    Promise.all([
      admin
        .from('event_vendors')
        .select(
          'vendor_id, source, status, lock_request_state, lock_declined_at, lock_decline_reason, lock_request_expires_at, lock_request_cancelled_at, completion_status, service_marked_complete_at, customer_confirmed_received_at, deposit_recorded_at, deposit_acknowledged_at, deposit_declined_at, deposit_decline_reason, deposit_proof_url',
        )
        .eq('event_id', eventId)
        .eq('marketplace_vendor_id', profile.vendor_profile_id)
        .maybeSingle(),
      supabase
        .from('vendor_proposals')
        .select('proposal_id, public_id, title, status, total_centavos, valid_until, sent_at, created_at, line_items, payment_schedule')
        .eq('vendor_profile_id', profile.vendor_profile_id)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false }),
      supabase
        .from('vendor_contracts')
        .select('contract_id, title, file_name, file_url, status, created_at')
        .eq('vendor_profile_id', profile.vendor_profile_id)
        .eq('event_id', eventId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false }),
      fetchVendorThreads(supabase, profile.vendor_profile_id),
      getEditorialEligibility(admin, eventId, profile.vendor_profile_id),
      supabase.rpc('get_vendor_cocktail_editor', { p_event_id: eventId }),
      // This org's booth poster for this event (its own table — one artwork per
      // vendor per event, not per booked service row). Admin-read: the page is
      // already booked/inquiry-gated above, and the row is scoped by
      // marketplace_vendor_id below.
      admin
        .from('event_vendor_booth_posters')
        .select('poster_ref, poster_content')
        .eq('event_id', eventId)
        .eq('vendor_profile_id', profile.vendor_profile_id)
        .maybeSingle(),
      // ⏰ EVERY block, Time-TBA chapters included (owner 2026-11-02, "TEN OWNER YESES" item 4: a TBA chapter shows
      // suppliers "Time TBA", never hidden) — their Schedule view (Step 4b) keeps it; the timeline, run of show and
      // call time below are fenced in code (`timedBlocks`), since a TBA chapter's stored 00:00 is only its day and is
      // never drawn as 12:00 AM. The chapter fields — never `notes`, which stay couple-side.
      supabase
        .from('event_schedule_blocks')
        .select(
          'block_id, label, block_type, start_at, end_at, location, run_state, actual_start_at, parent_block_id, spot, time_tba, follows_block_id, sort_order, time_shape, time_or_minutes, is_optional, responsible_vendor_ids, created_at, updated_at, ingress_minutes_before, egress_minutes_after, hours_vendor_id',
        )
        .eq('event_id', eventId)
        .order('start_at', { ascending: true })
        .order('sort_order', { ascending: true }),
      supabase
        .from('event_schedule_suggestions')
        .select(
          'suggestion_id, block_id, kind, proposed_label, proposed_start_at, proposed_end_at, proposed_parent_block_id, proposed_crew, note, status, auto_agreed, created_at, direction, suggested_by_name, asked_as, answer_note, vendor_profile_id, proposed_ingress_minutes, proposed_egress_minutes, where_vendor_id, proposed_block_ids',
        )
        .eq('event_id', eventId)
        .eq('vendor_profile_id', profile.vendor_profile_id)
        .order('created_at', { ascending: false })
        .limit(60),
      // Returning-client signal (Relationship Workspace · Details tab, PR 5).
      // SAME source as the vendor inbox pending badge — the SECURITY DEFINER
      // RPC that can see the couple's OTHER-event bookings (vendor RLS can't).
      // Graceful-degrades to an empty Map pre-migration, so the marker simply
      // doesn't render until 20261201000000 lands.
      fetchReturningClientFlags(supabase, profile.vendor_profile_id, [eventId]),
      // 🤝 THE SUPPLIER'S PART OF THE SCHEDULE (Step 4b) — their crews on moments (RLS: a booked supplier reads the
      // event's tasks), their Seen / Confirm marks (own rows), and the host's Auto-agree + the event day + every
      // booking row of theirs (admin, scoped to this org on this event — a supplier has no read on events' settings
      // or event_vendors). Each read's failure is said on the view, never drawn as "none".
      supabase.from('event_schedule_tasks').select(TASK_COLUMNS).eq('event_id', eventId),
      supabase
        .from('event_supplier_schedule_marks')
        .select(SCHEDULE_MARK_COLUMNS)
        .eq('event_id', eventId)
        .eq('vendor_profile_id', profile.vendor_profile_id)
        .maybeSingle(),
      Promise.all([
        admin.from('events').select('supplier_requests_auto_agree, event_date').eq('event_id', eventId).maybeSingle(),
        admin
          .from('event_vendors')
          .select('vendor_id, category, status, vendor_name')
          .eq('event_id', eventId)
          .eq('marketplace_vendor_id', profile.vendor_profile_id)
          .is('archived_at', null),
      ]),
      // 📇 Task contacts (4 additions (3), migration 20271303218631): RLS hands a supplier ONLY those on moments they
      // are on — the bridal-car driver's phone reaches the photographer on that moment, never the florist.
      supabase.from('event_schedule_task_contacts').select('task_id, block_id, name, phone').eq('event_id', eventId),
      // 🧮 WHO THEY COUNT (owner 2026-11-04) — a per-head booked supplier's count and its why, NUMBERS only
      // (`get_vendor_headcount_rule`). Null for a flat-priced service: the Headcount card then draws what it always did.
      isBooked && feeUnlocked ? readVendorHeadcountRule(supabase, eventId) : Promise.resolve(null),
      // …and the rule in the couple's words ("Only Bride's Crew") — admin-read like the event row above (a supplier has no
      // read on `events`), behind the same booking gate. A failed read is the usual words, logged (`loadRoleNames`).
      isBooked && feeUnlocked ? loadRoleNames(admin, eventId, 'vendorClientCard.roleNames') : Promise.resolve(null),
    ]),
  );

  const completionRow = (evRow ?? null) as ({
    vendor_id: string | null;
    source: string | null;
    completion_status: string | null;
    service_marked_complete_at: string | null;
    customer_confirmed_received_at: string | null;
    deposit_recorded_at: string | null;
    deposit_acknowledged_at: string | null;
    deposit_declined_at: string | null;
    deposit_decline_reason: string | null;
    deposit_proof_url: string | null;
  } & SupplierAskRow) | null;
  // 🔒 THE LAST ASK, WHEN IT CLOSED WITHOUT A BOOKING (pair P2, owner
  // 2026-10-10: "ask, agree, decline, lapse, withdraw all show on both pages in
  // the same words"). While it is open the panel below answers it; once the
  // supplier said no, the 48 hours ran out or the couple took it back, the card
  // says so — the sentence the couple's Build and Find read for this same row
  // (`lib/booking-ask-words.ts`). Before this the card simply went back to
  // "In conversation", as if nobody had ever asked.
  const askOutcome =
    isBooked || lockRequest ? null : supplierAskOutcomeOf(completionRow, isLockHandshakeEnabled());
  // The answer to Agree / Decline pressed HERE lands back here (`return_to`).
  const lockNotice =
    lockAgreeNotice(search.lock_agree, { competing: Number(search.competing) || null, feeHeld: lockAgreeFeeHeld(search.fee), feeLocksEvent: lockAgreeFeeHeld(search.fee) ? await resolveFeeEnforcement() : false, halls: lockAgreeHalls(search.taken, search.free) }) ??
    lockDeclineNotice(search.lock_decline);
  // 🔒 The couple's deposit receipt is a PRIVATE file. What reaches the card is
  // a short-lived link scoped to THIS event's deposit folder — never the stored
  // value, which the couple's session can write (a `https://wa.me/…` there
  // would otherwise render here as "View proof"). lib/deposit-proof.server.ts
  const completion = completionRow
    ? {
        ...completionRow,
        deposit_proof_url: await depositProofDisplayUrl(completionRow.deposit_proof_url, eventId),
      }
    : null;

  // Source badge: the supplier brought them → Imported — their own invite QR, Locked QR or a reused booking
  // (`SUPPLIER_BROUGHT_SOURCES`), or an inquiry through the supplier's own link (`website`, RW-22: the record now
  // carries its thread's source); anything else (a Setnayan surface, host_manual, cascade, legacy NULL) → In-house.
  const isImported =
    (completion?.source != null && SUPPLIER_BROUGHT_SOURCES.has(completion.source)) || completion?.source === 'website';
  // RW-39: the sources the fee counts as Setnayan's — a sourced inquiry stamp (`shop_page`, `explore`, …) or a Find save.
  const isFromSetnayan =
    !isImported &&
    completion?.source != null &&
    (bookingFeeAttribution(completion.source) === 'sourced' || SETNAYAN_SAVE_SOURCES.has(completion.source));

  const depositRecorded = Boolean(completion?.deposit_recorded_at);
  const depositAcked = Boolean(completion?.deposit_acknowledged_at);
  /*
    THE SUPPLIER'S OWN ANSWER, KEPT (2026-08-27). A refusal used to ERASE the
    couple's claim, so this screen simply stopped showing the block — the state
    was invisible because the facts were gone. The couple keeps their record
    now (owner ruling), which means the claim survives a refusal and this card
    must SAY so, or it would ask the same question again forever.
  */
  const depositDeclined = Boolean(completion?.deposit_declined_at);

  // S19 · can this couple see anywhere to pay you? Read only when the answer is
  // about to be shown — a booking ask on screen, or a booked client whose
  // deposit is still outstanding. The supplier's OWN profile id, never a param.
  const payoutMatters = Boolean(lockRequest) || (isBooked && !depositAcked);
  const payoutReadiness: PayoutReadiness = payoutMatters
    ? await readSupplierPayoutReadiness({
        adminClient: admin,
        vendorProfileId: profile.vendor_profile_id,
        // The SHOP OWNER's account — the Pro-tier check (payment links) is theirs,
        // and a team member may be the one looking.
        vendorUserId: profile.user_id,
      }).catch((): PayoutReadiness => 'unreadable')
    : 'unreadable';
  const eventVendorId = completion?.vendor_id ?? null;

  // ── THE BOOKING FEE, BOTH HALVES ────────────────────────────────────────
  // BEFORE they agree: what agreeing will cost them, priced by the same
  // `bookingFeePhp` the SQL charge is pinned against. Owner, 2026-09-20: "as a
  // vendor i do not know i have to pay."
  // AFTER it is billed: the unpaid bill FOR THIS COUPLE, with the door to pay.
  //
  // ⚠ The forecast is resolved ONLY while a lock ask is on screen — it is the
  // sentence that belongs beside the Agree button, and nowhere else on this
  // page is a decision being made about money.
  // …and THE DAY, BEFORE THE YES (owner 2026-11-04, `lib/day-check.ts`): the ask's day through the SAME capacity
  // rule the yes enforces (`vendor_day_check`), read beside the forecast — same moment, no extra wait.
  // 🧭 …and whether the asked-for service is on PLAN hold (owner 2026-11-06, SERVICES LIFE CYCLE) — then Agree gives way
  // to "Pick which stay on" and the card says why, naming the service.
  const [feeForecast, dayCheck, heldService]: [FeeDisclosure | null, Awaited<ReturnType<typeof readDayCheck>> | null, string | null] = lockRequest?.event_vendor_id
    ? await Promise.all([
        forecastForBooking(admin, {
          vendorProfileId: profile.vendor_profile_id,
          eventVendorId: lockRequest.event_vendor_id,
        }),
        readDayCheck(supabase, lockRequest.event_vendor_id),
        heldServiceOfAsk(supabase, lockRequest.event_vendor_id),
      ])
    : [null, null, null];
  const heldNotice = heldService ? lockAgreeNotice('service_on_hold', { heldService }) : null;
  // Third of the three BOOKING_FEE_BILL_SURFACES — scoped to THIS event, so one
  // couple's fee can never appear on another couple's page.
  // The overdue sentence states the lock's TRUE state — the gate's own answer (batch-5 walk F).
  const [clientFeeBillsRead, feeEnforced] = await Promise.all([
    fetchDueFeeBills(supabase, user.id).catch(() => FEE_BILLS_UNREADABLE),
    resolveFeeEnforcement(),
  ]);
  const clientFeeBills: DueFeeBill[] =
    clientFeeBillsRead === FEE_BILLS_UNREADABLE
      ? []
      : billsForSurface(clientFeeBillsRead, 'client', { eventId });
  // 💸 THE CARRY-OVER (owner 2026-11-12, top-up rule 4): an OVERDUE top-up on ANOTHER booking turns this ask's Agree
  // into "Settle ₱X to accept". Read off the same shop-wide bills; a held top-up carries nothing over.
  const overdueElsewhere =
    lockRequest && clientFeeBillsRead !== FEE_BILLS_UNREADABLE
      ? overdueTopUps(clientFeeBillsRead, manilaToday()).filter((b) => b.eventId !== eventId)
      : [];
  // 💸 WHERE TO PAY (owner 13 Nov, "how can they settle if they do not have the QR Code"): each top-up's settle sheet,
  // and the carry-over's, shows the shipped pay block — the bill read as /pay reads it, its codes minted HERE. Only
  // ONE overdue bill elsewhere gets it: a code carries one bill's figure, never a sum of several (that sheet keeps its
  // shipped door to the bills). A failed read → null → the shipped door, never an empty sheet.
  const settleBills = [
    ...clientFeeBills.filter((b) => b.topUp),
    ...(overdueElsewhere.length === 1 ? overdueElsewhere : []),
  ];
  const settlePays = new Map<string, SettlePay>();
  if (settleBills.length > 0) {
    const paySettings = await fetchPlatformSettings(supabase);
    await Promise.all(
      settleBills.map(async (b) => {
        const pay = await readSettlePay(supabase, paySettings, b.referenceCode, user.id);
        if (pay) settlePays.set(b.orderId, pay);
      }),
    );
  }
  const carryOver: CarryOverTopUp | null =
    overdueElsewhere.length > 0
      ? {
          orderId: overdueElsewhere[0]!.orderId,
          amountPhp: topUpOwedPhp(overdueElsewhere),
          coupleName: overdueElsewhere[0]!.coupleName,
          dueOn: overdueElsewhere[0]!.dueOn,
          payHref: vendorBookingFeePayPath(overdueElsewhere[0]!.orderId),
          pay: overdueElsewhere.length === 1 ? (settlePays.get(overdueElsewhere[0]!.orderId) ?? null) : null,
        }
      : null;
  // …and the WAIVED charge for this booking, if it was one of the free five.
  // Owner 2026-09-20: a free booking must still name the fee it would have
  // carried, so the first payable one is not a surprise.
  const clientWaivedRead = await fetchWaivedFeeCharges(
    admin,
    profile.vendor_profile_id,
  ).catch(() => FEE_BILLS_UNREADABLE);
  const clientWaived: WaivedFeeCharge[] =
    clientWaivedRead === FEE_BILLS_UNREADABLE
      ? []
      : clientWaivedRead.filter((c) => c.eventId === eventId);

  const isCompleteConfirmed =
    completion?.completion_status === 'confirmed' ||
    completion?.completion_status === 'auto_confirmed' ||
    Boolean(completion?.customer_confirmed_received_at);
  const isDisputed = completion?.completion_status === 'disputed';
  const isVendorMarked =
    Boolean(completion?.service_marked_complete_at) && !isCompleteConfirmed && !isDisputed;

  const proposals = (proposalRows ?? []) as ProposalRow[];

  // THE FIRST PAYMENT YOU ASKED FOR — the supplier's end of the couple's
  // "First payment requested" line (2026-09-19). Same rule, same quote
  // (`acceptedQuoteTerms`), plus the couple's recorded deposit row from the
  // payment log (the one deposit reader, `recordedDepositPhp`). A refused
  // ledger read leaves the amount unknown ("an amount"), never ₱0.
  const acceptedTerms = acceptedQuoteTerms(proposals, brief.event.event_date);
  let recordedDeposit: number | null = null;
  if (acceptedTerms?.firstPaymentCentavos != null && completion?.vendor_id && completion.deposit_recorded_at) {
    const { data: depRows, error: depErr } = await admin
      .from('event_vendor_payments')
      .select('amount_php, is_deposit_record')
      .eq('event_id', eventId)
      .eq('vendor_id', completion.vendor_id)
      .eq('is_deposit_record', true);
    if (depErr) {
      // eslint-disable-next-line no-console
      console.error('[VendorClientPage] recorded deposit read failed', depErr.message);
    } else {
      recordedDeposit = recordedDepositPhp((depRows ?? []) as LoggedPayment[], null);
    }
  }
  const firstPaymentStatus = supplierFirstPaymentStatus({
    terms: acceptedTerms,
    recordedPhp: recordedDeposit,
    recordedAt: completion?.deposit_recorded_at ?? null,
    acknowledgedAt: completion?.deposit_acknowledged_at ?? null,
    declinedAt: completion?.deposit_declined_at ?? null,
  });
  const firstPaymentSentenceText = firstPaymentSentence(acceptedTerms);
  // THE NEXT INSTALLMENT, THIS END (2026-09-20). The couple's "Amount to pay"
  // names the next payment from `moneyStep`; the supplier reads the same step
  // here, so both ends name the same payment. Only once the first is settled —
  // before that the status line above says it all.
  // Read for ANY booked client, not only one with an accepted quote: the
  // payment HISTORY ("show the current payments done as well") exists whenever
  // money has been recorded, quote or no quote.
  const supplierMoney =
    acceptedTerms || isBooked
      ? await readBookedMoney(admin, {
          eventId,
          vendorProfileId: profile.vendor_profile_id,
          eventDate: brief.event.event_date,
          viewer: 'vendor',
          otherName: 'the couple',
        })
      : null;
  const supplierNextLine =
    supplierMoney &&
    (supplierMoney.step.kind === 'installment_due' ||
      // NOTHING DUE FROM THE COUPLE YET — the supplier's end of the same
      // sentence, so neither side is told a payment is owed when it is not.
      supplierMoney.step.kind === 'installment_not_due_yet' ||
      supplierMoney.step.kind === 'paid_in_full')
      ? moneyStepLine(supplierMoney.step, 'vendor', 'the couple')
      : null;
  const supplierPaymentHistory = supplierMoney?.history ?? null;
  const firstPayment =
    firstPaymentStatus && acceptedTerms && firstPaymentSentenceText
      ? {
          sentence: firstPaymentSentenceText,
          status: firstPaymentStatus,
          nextLine: supplierNextLine,
          laterRows: acceptedTerms.schedule
            .filter((r) => !r.isFirstPayment)
            .map((r) => ({ label: r.label, amount: pesoFromCentavos(r.amountCentavos), dueText: r.dueText })),
        }
      : null;
  const contracts = (contractRows ?? []) as ContractRow[];
  const hasContract = contracts.length > 0;

  // Thread for THIS event → drives [Open chat] + [Log payment] (the pay-confirm
  // flow lives inside the thread) in the header action row.
  const thread = threads.find((t) => t.event_id === eventId) ?? null;
  const threadId = thread?.thread_id ?? null;
  // 🔴 The Chat tab's unread count (v8.3) — started now, awaited at the shell, so it waits on nothing below.
  const chatUnreadP = threadId ? readThreadUnreadCount(supabase, user.id, threadId) : Promise.resolve(null);

  /*
    ── ONE CHAT BOX (owner, 2026-09-18: "why did the chatbox never change?") ──
    #5586 made the two THREAD pages one Messenger-style frame. This page — the
    one a supplier actually lands on from the Clients list and from every
    notification about a client — still embedded its OWN copy of the chat
    under the flag-on shell: two navigation rows above a conversation that
    #5586 never touched. Owner's brief: "a single chat box with everything
    inside it."

    The copy is gone. Landing here on the conversation now lands on THE
    conversation — the thread page, which is the one frame — and this page's
    sections (Quote · Payments · Files · Schedule · Details) sit one tap away
    behind that frame's ⋮ and stay reachable here by `?tab=`. The tab strip
    keeps a "Chat" entry as a DOOR to the thread, never a second room.

    🔑 A redirect, not a second mount of the frame. Two mounts of one frame
    are two places for the conversation to be drawn, and this repo's recurring
    disease is one fact rendered by two mechanisms that quietly stop agreeing
    — which is precisely how this page came to show the old chat for a day
    after the new one shipped. Flag-off keeps its "Open chat" button, which
    already went to the thread page; the two shells now agree where chat lives.
  */
  /*
    🗂 THE CHAT MOVED INTO THE CLIENT (THE ONE BUILD, 8 Nov 2026 · v111/v113). The redirect that forwarded a bare or
    `?tab=chat` landing to the thread page is GONE: the picked client's Chat page draws THE conversation in place
    (`_pages/chat.tsx` — still ONE chat box: the body is shared with the thread page, never a second mount), and a
    bare landing opens Details. The full-screen thread route stays for the envelope doors (6 Nov ruling).
  */
  const relationshipShellEnabled = isRelationshipWorkspaceEnabled();
  const rawTab = typeof search.tab === 'string' ? search.tab : undefined;

  /*
    ⚖ WHERE A MONEY ANSWER COMES BACK TO (owner, live, 2026-09-20: "clicked
    confirmed and it just bounced to the chat page"). A tab the strip knows is
    the honest "the page they pressed it on"; anything else lands on Payments. The deposit
    forms post it; the actions re-validate it (lib/vendor-client-return.ts) and
    never trust it as given. Without it those actions redirect here WITHOUT a
    tab, which this very gate then forwards to the thread.
  */
  /* The completion flag, read ONCE and handed to both mounts of the card, so
     the two shells cannot disagree about whether the supplier is told. */
  const completedNotice = typeof search.completed === 'string' ? search.completed : null;

  const depositReturnTo = vendorClientTabHref(
    eventId,
    (VENDOR_CLIENT_TABS as readonly string[]).includes(rawTab ?? '')
      ? (rawTab as VendorClientTab)
      : MONEY_TAB,
  );

  /*
    FILES THE COUPLE SENT IN THE CONVERSATION — the third source of the Files
    tab, and the one it was missing.

    ⚠ IT RIDES THE SCOPE THIS PAGE ALREADY HAS. Same user client, same thread
    the header's [Open chat] button opens, same RLS. No admin client, no new
    SECURITY DEFINER, no widening: if the supplier may open the thread they may
    see what is in it, and if they may not, this read returns nothing — which is
    exactly what the Files page is told below.

    ⚠ `chatFilesMeasured` EXISTS BECAUSE A REFUSAL LOOKS LIKE AN EMPTY ROOM.
    In this app a denied query comes back as zero rows, so "nothing was ever
    shared" and "you were not allowed to see it" render identically unless the
    error is checked. Production has never had a single chat attachment, so the
    empty state is what every supplier sees today — all the more reason it must
    not also be what a refusal says.
  */
  let chatFiles: ChatFileInput[] = [];
  let chatFilesMeasured = true;
  if (threadId) {
    const { data: chatFileRows, error: chatFileRowsError } = await supabase
      .from('chat_messages')
      .select(
        'message_id,sender_role,created_at,attachment_name,attachment_mime,attachment_size_bytes,attachment_url',
      )
      .eq('thread_id', threadId)
      // A row counts as a file if EITHER the stored reference or the filename
      // survived — a name with no reference still tells the supplier the file
      // exists, and listing it unlinked beats pretending it never arrived.
      .or('attachment_url.not.is.null,attachment_name.not.is.null')
      .order('created_at', { ascending: false })
      .limit(200);
    if (chatFileRowsError) {
      logQueryError(
        'VendorClientDetail.chatFiles',
        chatFileRowsError,
        { eventId, thread_id: threadId },
        'graceful_degrade',
      );
      chatFilesMeasured = false;
    } else {
      chatFiles = (chatFileRows ?? []) as ChatFileInput[];
    }
  }

  // Returning-client marker (Details/Overview tab). A row exists ONLY when this
  // couple previously CONFIRMED-booked THIS vendor on a DIFFERENT event — i.e.
  // they're a returning client (N≥1). The RPC returns the most-recent such prior
  // event's name/date (DISTINCT ON per event) — no exact count and no prior
  // event_id, so we surface that one named past event, not a linked list.
  const returningFlag: ReturningClientFlag | null = returningFlags.get(eventId) ?? null;

  // Reviewed pipeline step — vendor_reviews is publicly readable (USING TRUE),
  // so a cheap existence check on (vendor, event) is safe. Only worth a read once
  // the booking could plausibly have a review (booked + delivered).
  let hasReview = false;
  if (isBooked && isCompleteConfirmed) {
    const { data: reviewRow, error: reviewRowError } = await supabase
      .from('vendor_reviews')
      .select('review_id, created_at')
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .eq('event_id', eventId)
      .limit(1)
      .maybeSingle();
    // ⚠ WHETHER THEY HAVE ALREADY REVIEWED THIS COUPLE. Refused, `Boolean(null)`
    // ⚠ is false, so the page invites them to write a review they have already
    // ⚠ written — "you did not do this", said to somebody who did.
    if (reviewRowError) {
      logQueryError(
        'VendorClientDetail.reviewRow',
        reviewRowError,
        { eventId },
        'graceful_degrade',
      );
    }
    hasReview = Boolean(reviewRow);
  }

  // Payments (booked only): the couple's payment tables are couple-RLS, so we
  // read them through the SAME admin-gated fetchers the chat thread uses
  // (ownership proven inside via event_vendors.marketplace_vendor_id === us).
  // NO RLS weakening, NO new SECURITY DEFINER — reuse only.
  let planStepRows: Awaited<ReturnType<typeof fetchPlanProgressForVendor>>[number] | null = null;
  let pendingPayments: Awaited<ReturnType<typeof fetchPendingVendorPayments>> = [];
  // Full per-booking plan list — retained (beyond the single matched row) so the
  // flag-ON Payments tab can feed the live VendorPaymentLive surface exactly as
  // the thread page does. Unused on the flag-OFF path, so its render is unchanged.
  let planRowsAll: Awaited<ReturnType<typeof fetchPlanProgressForVendor>> = [];
  // AREA-VENDOR — the money on record for a booking with NO frozen plan (the
  // only kind production has): logged payments + the balance, from the same
  // ownership-gated timeline Today and /payday read. Empty when nothing is
  // logged, or when the read is refused (logged, never shown as money).
  let ledgerMoney: BookingMoney = { rows: [], receivedPhp: 0, expectedPhp: 0 };
  // ⚠ A LEDGER THAT COULD NOT BE READ IS NOT AN EMPTY ONE. Refused or cut short,
  // this used to render "No payments to confirm yet" over a real deposit. Now
  // the Quote and Payments tabs say the payments couldn't load.
  let ledgerUnreadable = false;
  if (isBooked) {
    const [plans, pending, payday] = await Promise.all([
      fetchPlanProgressForVendor({
        adminClient: admin,
        eventId,
        vendorProfileId: profile.vendor_profile_id,
      }),
      fetchPendingVendorPayments({
        adminClient: admin,
        eventId,
        vendorProfileId: profile.vendor_profile_id,
      }),
      // This event's rows only, paged to the server's exact count
      // (`lib/vendor-payday-read.ts`) — never one capped request.
      readVendorPaydayInstallments(supabase, { eventId }),
    ]);
    planRowsAll = plans;
    if (!payday.complete) {
      logQueryError(
        'VendorClientPage.paydayInstallments',
        { message: payday.error ?? `read ${payday.rows.length} rows without reaching the server count` },
        { eventId },
        'graceful_degrade',
      );
      ledgerUnreadable = plans.length === 0;
    } else if (plans.length === 0) {
      ledgerMoney = bookingMoney(payday.rows, eventId, eventVendorId);
    }
    // One booking per event_vendors row for this org+event; take the one whose
    // eventVendorId matches the completion row (there is normally exactly one).
    planStepRows =
      plans.find((p) => p.eventVendorId === eventVendorId) ?? plans[0] ?? null;
    pendingPayments = pending;
  }
  // 💸 B2-E · THE REFUNDS THIS SHOP GAVE THIS CLIENT (`event_vendor_refunds`, read under the shop's own RLS and scoped to
  // this booking). Booked-only, like the Payment page that draws them. ONE request (plus a signed link per proof photo,
  // in parallel, only when a refund carries one). Refused → `measured: false`: the page says so and Paid is "part of
  // this couldn't load" — never a Paid figure that silently ignores a refund.
  let clientRefunds: { measured: boolean; rows: ClientRefundView[] } | null = null;
  if (isBooked && eventVendorId) {
    const { data: refundRows, error: refundErr } = await supabase
      .from('event_vendor_refunds')
      .select(CLIENT_REFUND_SELECT)
      .eq('event_vendor_id', eventVendorId)
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .is('removed_at', null)
      .order('refunded_on', { ascending: false })
      .order('created_at', { ascending: false });
    if (refundErr) {
      logQueryError('VendorClientPage.refunds', refundErr, { eventId }, 'graceful_degrade');
      clientRefunds = { measured: false, rows: [] };
    } else {
      const shaped = ((refundRows ?? []) as ClientRefundDbRow[]).map(clientRefundOf);
      clientRefunds = {
        measured: true,
        rows: await Promise.all(
          shaped.map(async (r) => ({ ...r, proofUrl: r.proofRef ? await displayUrlForStoredAsset(r.proofRef).catch(() => null) : null })),
        ),
      };
    }
  }

  // H4 — what still waits on the SUPPLIER. A payment they said never arrived is
  // Setnayan's to referee, so no "awaiting your confirmation" count includes it;
  // the live payment section still shows it, with where it stands.
  const awaitingPayments = pendingPayments.filter(awaitsTheSupplier);

  // Change-Order Trail — depends on the event_vendor id resolved above.
  const { data: changeOrderRows, error: changeOrderRowsError } = eventVendorId
    ? await supabase
        .from('vendor_change_orders')
        .select(
          'change_order_id, raised_by, title, description, delta_amount_php, proposed_due_date, status, acknowledged_at, decline_reason, created_at',
        )
        .eq('event_vendor_id', eventVendorId)
        .order('created_at', { ascending: false })
    : { data: null, error: null };
  // ⚠ CHANGE ORDERS CARRY MONEY (`delta_amount_php`) AND CAN BE AWAITING AN
  // ⚠ ANSWER. Refused, `?? []` hides one raised by the couple, so the supplier
  // ⚠ never acknowledges it and the couple is left waiting on a reply to a
  // ⚠ request the other side cannot see.
  if (changeOrderRowsError) {
    logQueryError(
      'VendorClientDetail.changeOrders',
      changeOrderRowsError,
      { eventId },
      'graceful_degrade',
    );
  }
  const changeOrdersMeasured = !changeOrderRowsError;
  const changeOrders = (changeOrderRows ?? []) as VendorChangeOrderRow[];

  /*
    PAYMENT ASKS (booked only) — what this shop has asked this customer for.

    Read on the vendor's OWN session: `vendor_payment_asks` carries a vendor
    SELECT policy (booked event ∩ own profile), so RLS is doing the scoping here
    rather than an admin client pretending to.

    ⚠ AN UNREADABLE ASK IS NOT "NO ASK". `?? []` would hide a live request for
    money — the shop would see nothing outstanding, ask again, and the couple
    would receive the same bill twice from a screen that looked calm. Measured
    separately (`asksMeasured`) so the panel can say "we could not read this"
    instead of "there is nothing here", which are opposite sentences.
  */
  // Read to the END (`readOpenPaymentAsks`): it was `.limit(20)`, so a 21st
  // open ask was hidden and the shop could bill the same thing twice.
  const askRead = isBooked && eventVendorId
    ? await readOpenPaymentAsks(supabase, eventVendorId)
    : { rows: [] as OpenPaymentAskRow[], error: null, complete: true };
  const askRowsError = askRead.error;
  // 🪤 SAME DEPLOY-WINDOW CARVE-OUT AS THE COUPLE'S SIDE. A relation this build
  // has not seen yet is a TRUE empty — nothing can have been written into a
  // table that does not exist — and reporting it as unmeasured would put the
  // "we could not load what you have already asked for" warning on every booked
  // customer's page for the length of a deploy. Only a real refusal counts.
  const asksAbsent = isMissingRelationError(askRowsError);
  if (askRowsError && !asksAbsent) {
    logQueryError(
      'VendorClientDetail.paymentAsks',
      askRowsError,
      { eventId },
      'graceful_degrade',
    );
  }
  // A read that stopped short of the server's count is NOT measured either —
  // a shorter list of asks is exactly the double-bill this panel prevents.
  const asksMeasured = asksAbsent || (!askRowsError && askRead.complete);
  const paymentAsks = (asksMeasured ? askRead.rows : []) as PaymentAskRow[];

  // Delivery handovers (booked). event_vendor scoped — safe to read for the
  // vendor's own booking via their RLS.
  const { data: handoverRows, error: handoverRowsError } = isBooked
    ? await supabase
        .from('booking_handovers')
        .select('handover_id, kind, label, payload, status, delivered_at, couple_acknowledged_at')
        .eq('event_id', eventId)
        .eq('vendor_profile_id', profile.vendor_profile_id)
        .order('created_at', { ascending: false })
        .limit(20)
    : { data: null, error: null };
  // ⚠ WORK THEY HAVE ALREADY DELIVERED — the gallery link, the files handed
  // ⚠ over. Refused, the delivery record reads as empty, so finished work
  // ⚠ reappears as outstanding on the supplier's own client page.
  if (handoverRowsError) {
    logQueryError(
      'VendorClientDetail.handovers',
      handoverRowsError,
      { eventId },
      'graceful_degrade',
    );
  }
  const handoversMeasured = !handoverRowsError;
  const handovers = (handoverRows ?? []) as HandoverRow[];

  // Private CRM notes (vendor-org-only RLS). Author display resolved best-effort
  // via the admin client (RLS on users would otherwise hide teammates).
  const { data: noteRows, error: noteRowsError } = await supabase
    .from('vendor_client_notes')
    .select('note_id, body, remind_at, done_at, author_user_id, created_at')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  // ⚠ THE TEAM'S PRIVATE NOTES ON THIS CLIENT, INCLUDING THEIR REMINDERS.
  // ⚠ Refused, the notes read as never written and any `remind_at` on them
  // ⚠ silently stops being shown — an absence that deletes a warning, which is
  // ⚠ invisible by construction: there is no wrong-looking empty state, the
  // ⚠ reminder simply is not there.
  if (noteRowsError) {
    logQueryError(
      'VendorClientDetail.notes',
      noteRowsError,
      { eventId },
      'graceful_degrade',
    );
  }
  const notesMeasured = !noteRowsError && noteRows !== null;
  const rawNotes = (noteRows ?? []) as Omit<ClientNote, 'author_label'>[];
  const authorIds = Array.from(new Set(rawNotes.map((n) => n.author_user_id)));
  const authorLabels = new Map<string, string>();
  if (authorIds.length > 0) {
    // ⚠ `display_name`, NOT `full_name` — public.users has no `full_name`.
    // PostgREST 42703s the whole query, so `authors` was always null and every
    // teammate's CRM note rendered with a blank author instead of their name
    // (only the caller's own notes showed, via the hardcoded 'You' branch).
    const { data: authors, error: authorsError } = await admin
      .from('users')
      .select('user_id, display_name')
      .in('user_id', authorIds);
    if (authorsError) {
      logQueryError('vendor-dashboard/clients:noteAuthors', authorsError, { eventId });
    }
    for (const a of (authors ?? []) as Array<{ user_id: string; display_name: string | null }>) {
      if (a.display_name) authorLabels.set(a.user_id, a.display_name);
    }
  }
  const notes: ClientNote[] = rawNotes.map((n) => ({
    ...n,
    author_label: n.author_user_id === user.id ? 'You' : authorLabels.get(n.author_user_id) ?? null,
  }));

  const everyBlock = (liveBlocks ?? []) as LiveBlock[];
  // The timeline, run of show and call time: blocks with a clock only — a Time-TBA chapter (and every moment in it)
  // has no clock to draw or call from. Their Schedule view below keeps it, "Time TBA".
  const allBlocks = blocksWithAClock(everyBlock);
  // 🔁 One read, two directions (D2, migration 20271303655108): what THIS supplier asked the host (`to_host` — every
  // reader below, as before) and what a host or the coordinator asked of THEM (`to_supplier` — "Asked of you").
  const mineBothWays = (mySuggestions ?? []) as SuggestionRow[];
  const suggestions = mineBothWays.filter((r) => directionOf(r) === 'to_host');
  const askedOfThem = mySuggestionsError
    ? null
    : askedOfYou(mineBothWays.filter((r) => directionOf(r) === 'to_supplier')).map((r) => ({
        suggestion_id: r.suggestion_id,
        block_id: r.block_id,
        vendor_profile_id: profile.vendor_profile_id,
        suggested_by_name: r.suggested_by_name ?? null,
        asked_as: r.asked_as ?? null,
        proposed_start_at: r.proposed_start_at,
        proposed_end_at: r.proposed_end_at,
        note: r.note,
        status: r.status,
        answer_note: r.answer_note ?? null,
        created_at: r.created_at,
        // 📍 A host's Where ask (migration 20271308641275) — the chapters they ask this supplier to serve.
        kind: r.kind,
        proposed_block_ids: r.proposed_block_ids ?? null,
      }));

  // 🤝 Their part of the day (Step 4b) — one pass over the reads above (`lib/supplier-schedule.ts`).
  const [factsEvent, factsBookings] = myScheduleFacts;
  const myBookingIds = ((factsBookings.data ?? []) as { vendor_id: string }[]).map((b) => b.vendor_id);
  if (eventVendorId && !myBookingIds.includes(eventVendorId)) myBookingIds.push(eventVendorId);
  const supplierDay = liveBlocks
    ? buildSupplierDay({
        blocks: everyBlock.map((b) => ({
          block_id: b.block_id,
          parent_block_id: b.parent_block_id ?? null,
          label: b.label,
          start_at: b.start_at,
          end_at: b.end_at,
          location: b.location,
          spot: b.spot ?? null,
          time_tba: b.time_tba === true,
          follows_block_id: b.follows_block_id ?? null,
          sort_order: b.sort_order ?? 0,
          time_shape: b.time_shape ?? 'at',
          time_or_minutes: b.time_or_minutes ?? null,
          is_optional: b.is_optional === true,
          responsible_vendor_ids: b.responsible_vendor_ids ?? [],
          created_at: b.created_at ?? null,
          updated_at: b.updated_at ?? null,
          ingress_minutes_before: b.ingress_minutes_before ?? null,
          egress_minutes_after: b.egress_minutes_after ?? null,
          hours_vendor_id: b.hours_vendor_id ?? null,
        })),
        myBookingIds,
        // 🏛 Their VENUE bookings — a venue sets the hours of the chapters it is booked to.
        venueBookingIds: ((factsBookings.data ?? []) as { vendor_id: string; category: string | null }[])
          .filter((b) => VENUE_CATEGORIES.has(b.category ?? ''))
          .map((b) => b.vendor_id),
        tasks: (myTasksRes.data ?? []) as SupplierTaskRow[],
        requests: suggestions,
        contacts: myContactsRes.error ? [] : ((myContactsRes.data ?? []) as SupplierContactRow[]),
      })
    : null;
  /* 📍 WHERE — the chapters they serve, picked by them as a request (owner 2026-11-04, migration 20271308641275). Their
     trade's usual chapters (`service_categories.default_chapters`) prefill an empty pick — read only when one is empty. */
  const myBookings: OwnBooking[] = ((factsBookings.data ?? []) as { vendor_id: string; category: string | null; status: string | null; vendor_name: string | null }[]).map(
    (b) => ({ vendorId: b.vendor_id, category: b.category, status: b.status, label: b.vendor_name }),
  );
  const whereChapters = whereChaptersFrom(
    everyBlock.map((b) => ({
      block_id: b.block_id,
      parent_block_id: b.parent_block_id ?? null,
      label: b.label,
      start_at: b.start_at,
      location: b.location,
      responsible_vendor_ids: b.responsible_vendor_ids ?? [],
      block_type: b.block_type,
      time_tba: b.time_tba === true,
    })),
  );
  let ownWhere = liveBlocks && !factsBookings.error ? supplierOwnWhere({ bookings: myBookings, chapters: whereChapters, requests: suggestions }) : null;
  if (ownWhere?.some((w) => w.draft.length === 0)) {
    const trade = await readTradeChapters(admin);
    if (trade.ok) {
      ownWhere = supplierOwnWhere({
        bookings: myBookings,
        chapters: whereChapters,
        requests: suggestions,
        tradeDefault: (category) => suggestedChapters(whereChapters, trade.byCategory.get(category ?? '')),
      });
    }
  }
  const scheduleMarks = myMarksRes.error
    ? null
    : {
        seenAt: (myMarksRes.data as { seen_at: string | null } | null)?.seen_at ?? null,
        confirmedAt: (myMarksRes.data as { confirmed_at: string | null } | null)?.confirmed_at ?? null,
        // 🔒 CHANGE LOCK (audit D7): their part is locked — the host's changes are refused until they unlock.
        lockedAt: (myMarksRes.data as { locked_at: string | null } | null)?.locked_at ?? null,
      };
  const factsRow = (factsEvent.data ?? null) as { supplier_requests_auto_agree: boolean | null; event_date: string | null } | null;
  // 🚗 ONE CREW, TWO EVENTS (slice 5, owner 2026-11-04): their crews' moments here, against the same crews on their
  // other events that day. Only when this event's crews were read — an unread crew list is never "no clash".
  const timedHere = new Map(blocksWithAClock(everyBlock).map((b) => [b.block_id, b]));
  const crewHere = myTasksRes.error
    ? []
    : ((myTasksRes.data ?? []) as Array<SupplierTaskRow & { call_at: string | null }>).flatMap((t) => {
        const b = timedHere.get(t.block_id);
        const startIso = t.call_at ?? b?.start_at ?? null;
        return b && t.crew && t.vendor_id && myBookingIds.includes(t.vendor_id) && startIso
          ? [{ blockId: t.block_id, crew: t.crew, startIso, endIso: b.end_at ?? null }]
          : [];
      });
  const crewElsewhere = myTasksRes.error || factsEvent.error
    ? null
    : await readCrewElsewhere({
        admin,
        supabase,
        vendorProfileId: profile.vendor_profile_id,
        eventId,
        eventDate: factsRow?.event_date ?? null,
        here: crewHere,
      });
  const supplierPart = {
    day: supplierDay,
    autoAgree: factsRow?.supplier_requests_auto_agree === true,
    marks: scheduleMarks,
    changed: supplierDay ? changedSinceSeen(supplierDay.stamps, scheduleMarks?.seenAt ?? null) : false,
    finalWeek: inFinalWeek(factsRow?.event_date ?? null, manilaToday()),
    tasksRead: !myTasksRes.error,
    answered: suggestions.filter((r) => r.status !== 'open').slice(0, 6),
    asked: askedOfThem,
    where: ownWhere,
    elsewhere: crewElsewhere,
  };
  // The couple's invitation to arrange the cocktail area is a WORKING control
  // (ruling item 7): its own page is gated, so the door to it is too — a link
  // that only ever lands on a locked screen is a dead end, not an invitation.
  const canEditCocktail = !!cocktailEdit && feeUnlocked;

  // Booth poster: the stored ref is raw (r2://bucket/key), so resolve it to a
  // display URL for the preview — the same ref → URL step the 3D scenes do.
  const posterRef = (posterRow as { poster_ref?: string | null } | null)?.poster_ref ?? null;
  // Booth Studio words, sanitized by the renderer's own rule so the composer
  // opens on exactly what a guest would be shown.
  const boothStudioContent = sanitizeBoothStudioContent(
    (posterRow as { poster_content?: unknown } | null)?.poster_content ?? null,
  );
  const posterDisplayUrl = posterRef ? await displayUrlForStoredAsset(posterRef) : null;


  const runOfShowBlocks: RunOfShowBlock[] = allBlocks
    .filter((b) => b.start_at)
    .map((b) => ({
      block_id: b.block_id,
      label: b.label,
      start_at: b.start_at as string,
      end_at: b.end_at,
      location: b.location,
      run_state: (b.run_state ?? 'upcoming') as RunOfShowBlock['run_state'],
      actual_start_at: b.actual_start_at ?? null,
    }));

  // The old "Full timeline / My slots only" lens and its per-moment forms moved into the Schedule view (Step 4b):
  // which moments are this supplier's own is read there from `responsible_vendor_ids`, the column the database's
  // own-items rule reads (`current_vendor_owns_schedule_block`, 20271263061583).
  const callTime = deriveCallTime(allBlocks, brief.booked_categories);
  const callTimeAlreadyRequested = suggestions.some(
    (s) => s.kind === 'new' && s.note.startsWith('Suggested call time'),
  );

  const paletteEntries = Object.entries(PALETTE_LABELS)
    .map(([key, label]) => ({ key, label, colors: brief.palette?.[key] ?? [] }))
    .filter((p) => p.colors.length > 0);
  const mealEntries = Object.entries(brief.dietary?.meal_counts ?? {}).sort((a, b) => b[1] - a[1]);
  // ── SEC-3 (2026-07-26) · CROSS-TENANT stored XSS ───────────────────────────
  // This value is events.monogram_custom_svg. `events` UPDATE RLS is ROW-level,
  // never column-level, and the anon key is public — so the COUPLE can PATCH
  // arbitrary markup into it through PostgREST, bypassing every server action
  // and the write-time sanitizer. It then rendered here, in a VENDOR's
  // authenticated session, via dangerouslySetInnerHTML, with no script-src CSP
  // to stop it. The old `startsWith('<svg')` check was a shape test, not a
  // safety one — and the comment at the render site called this a "first-party
  // asset", which is exactly the assumption that made it dangerous.
  //
  // Two changes: gate the value (safeMonogramSvg), and stop inlining it — the
  // mark now renders as an inert data-URI <img>, an image context with no
  // script execution and no external fetches, so this surface no longer
  // depends on the sanitizer being exhaustive. Same pattern as
  // BespokeMonogramMark / EventMonogram elsewhere in the app.
  // Framed on its ink like every other surface's (lib/logo-layers.ts) — a
  // Logo-editor logo placed left of centre is centred here too.
  const monogramSvg = centreLogoOnItsInk(safeMonogramSvg(brief.monogram.custom_svg));
  // ▶ It plays when it moves and the couple's animation is on (owner
  // 2026-09-29: "all logos should animate if animation is active"). The
  // player builds its live tree through an ALLOWLIST on the browser's parse
  // (`inertLogoTree`), so this vendor session still never receives the
  // couple's raw markup; a logo that fails it stays the inert <img> below.
  const monogramPlays = await logoPlaysFor(eventId, monogramSvg);

  // ---- Pipeline derivation (server-side, from data already loaded) ----
  //   Quoted    = any proposal row with status ≠ draft.
  //   Booked    = the RPC returned stage 'booked'.
  //   Delivered = completion handshake confirmed / auto_confirmed.
  //   Reviewed  = a vendor_reviews row exists (public-read; checked above).
  const isQuoted = proposals.some((p) => p.status !== 'draft');
  // An ACCEPTED quote is still "quoted" on the ladder — a booking exists only
  // once the supplier agrees to the couple's request — but it is a different
  // next move and a different word on the strip (lib/supplier-next-move.ts).
  const isAccepted = proposals.some((p) => p.status === 'accepted');
  const isDelivered = isBooked && isCompleteConfirmed;
  // `reached` = furthest reached index; `current` = highlighted stage.
  let reached = 0; // Inquiry
  if (isQuoted) reached = Math.max(reached, 1);
  if (isBooked) reached = Math.max(reached, 2);
  if (isDelivered) reached = Math.max(reached, 3);
  if (hasReview) reached = Math.max(reached, 4);
  const current = hasReview ? 4 : isDelivered ? 3 : isBooked ? 2 : isQuoted ? 1 : 0;
  // Reviewed is only cheaply knowable post-delivery; before that, cap the strip
  // at Delivered so we never imply a review-state we didn't read.
  const capAt = isDelivered ? 4 : 3;

  // PR-H · "They asked you" outranks "Quote sent" and "In conversation": it is
  // the only one of the three with a FUSE on it, and it is the only one the
  // supplier has to act on. Checked below 'Booked' so an agreed row that still
  // carries a stale marker can never read as unanswered.
  const stagePill = isBooked
    ? { label: 'Booked', cls: 'bg-success-100 text-success-900' }
    : lockRequest
      ? { label: 'They asked you', cls: 'bg-warn-100 text-warn-900' }
      : isQuoted
        ? { label: 'Quote sent', cls: 'bg-warn-100 text-warn-900' }
        : { label: 'In conversation', cls: 'bg-terracotta/10 text-terracotta-700' };

  // "This couple" only when there is genuinely no name. The brief names the
  // couple at every stage (20271235469220); a blank string is not a name.
  const eventName = coupleNameOrFallback(brief.event.display_name);
  // "Open their event" + the seat pill (Coordinator · Co-host) — only with a LIVE seat on THIS event (`seatRunsTheEvent`).
  const runThisEvent = (await eventsYouRunP).events.find((e) => e.eventId === eventId) ?? null;
  const runsThisEvent = runThisEvent !== null;
  const metaBits = [
    fmtShortDate(brief.event.event_date) || null,
    brief.event.venue_name ?? brief.event.region ?? null,
  ].filter(Boolean);

  // ---- Activity feed events (merged, newest-first done in the component) ----
  const activityEvents: ActivityEvent[] = [];
  for (const p of proposals) {
    if (p.status === 'draft') continue;
    const at = p.sent_at ?? p.created_at;
    activityEvents.push({
      id: `prop-${p.proposal_id}`,
      kind: 'proposal',
      title: `Quote ${PROPOSAL_STATUS_LABEL[p.status].toLowerCase()}`,
      detail: `${formatCentavos(p.total_centavos)}${
        p.valid_until ? ` · valid until ${fmtShortDate(p.valid_until)}` : ''
      }`,
      at,
      sortAt: at ? Date.parse(at) : 0,
    });
  }
  for (const s of suggestions) {
    activityEvents.push({
      id: `sug-${s.suggestion_id}`,
      kind: 'schedule',
      title:
        s.kind === 'new'
          ? 'Suggested a new timeline entry'
          : s.kind === 'remove'
            ? 'Asked to remove a timeline entry'
            : s.kind === 'skip'
              ? 'Your crew asked to skip a part'
              : 'Requested a schedule change',
      detail: `${s.note.slice(0, 90)}${s.note.length > 90 ? '…' : ''} · ${s.status}`,
      at: s.created_at,
      sortAt: Date.parse(s.created_at),
    });
  }
  if (completion?.deposit_recorded_at) {
    activityEvents.push({
      id: 'deposit-recorded',
      kind: 'deposit',
      title: depositAcked
        ? 'Payment confirmed'
        : depositDeclined
          ? 'You said this never reached you'
          : 'Payment recorded',
      detail: depositAcked
        ? 'You confirmed the couple’s payment — their date is locked in.'
        : depositDeclined
          ? 'They were told, and their own record of paying was kept. If they send it again you’ll be asked once more.'
          : 'The couple recorded a payment — confirm receipt to lock the date.',
      at:
        completion.deposit_acknowledged_at ??
        completion.deposit_declined_at ??
        completion.deposit_recorded_at,
      sortAt: Date.parse(
        completion.deposit_acknowledged_at ??
          completion.deposit_declined_at ??
          completion.deposit_recorded_at,
      ),
    });
  }
  if (completion?.service_marked_complete_at) {
    activityEvents.push({
      id: 'marked-complete',
      kind: 'handshake',
      title: isCompleteConfirmed ? 'Delivery confirmed' : 'Marked service complete',
      detail: isCompleteConfirmed
        ? 'The couple confirmed they received everything.'
        : 'Waiting on the couple to confirm receipt (auto-confirms after 7 days).',
      at: completion.customer_confirmed_received_at ?? completion.service_marked_complete_at,
      sortAt: Date.parse(
        completion.customer_confirmed_received_at ?? completion.service_marked_complete_at,
      ),
    });
  }
  for (const pp of pendingPayments) {
    activityEvents.push({
      id: `pay-${pp.paymentId}`,
      kind: 'payment',
      title: 'Payment logged by the couple',
      detail: `${fmtPeso(pp.amountPhp)}${pp.installmentLabel ? ` · ${pp.installmentLabel}` : ''} · ${
        awaitsTheSupplier(pp) ? 'awaiting your confirmation' : 'you said it never arrived · Setnayan is checking'
      }`,
      at: pp.paidAt,
      sortAt: Date.parse(pp.paidAt),
    });
  }

  // Appointments (Relationship Workspace + Appointments, PR 12). Booked-only —
  // the vendor-insert RLS requires a booked (vendor, event) relationship, so the
  // scheduler is meaningless at the inquiry stage. One cheap reference read of
  // the category → meeting-type catalog + this org's appointment rows on the
  // event, both under the vendor's own RLS.
  let appointmentPresets: AppointmentTypePreset[] = [];
  let appointmentViews: AppointmentView[] = [];
  if (isBooked) {
    const apptCats = appointmentCategoriesFor(brief.booked_categories);
    const [{ data: catalogRows }, { data: apptRows }] = await Promise.all([
      supabase
        .from('appointment_type_catalog')
        .select('category, type, label, default_mode, default_duration_min, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('event_appointments')
        .select(
          'appointment_id, kind, type, custom_label, location, scheduled_at, duration_min, status, initiated_by, note, thread_id, room_created_at',
        )
        .eq('event_id', eventId)
        .eq('vendor_profile_id', profile.vendor_profile_id)
        .order('created_at', { ascending: false }),
    ]);
    const catalog = (catalogRows ?? []) as Array<{
      category: string;
      type: string;
      label: string;
      default_mode: AppointmentKind;
      default_duration_min: number;
    }>;
    const typeLabels: Record<string, string> = {};
    for (const r of catalog) typeLabels[r.type] = r.label;
    appointmentPresets = catalog
      .filter((r) => apptCats.includes(r.category))
      .map((r) => ({
        type: r.type,
        label: r.label,
        default_mode: r.default_mode,
        default_duration_min: r.default_duration_min,
      }));
    appointmentViews = ((apptRows ?? []) as Array<Omit<AppointmentView, 'label'>>).map((a) => ({
      ...a,
      label: resolveAppointmentLabel(a, typeLabels),
    }));
  }

  clientTimer.flush();

  const bodyPad = 'px-4 py-6 sm:px-6';

  // ------------------------------------------------------------------------
  // Header pieces + tab-body nodes — extracted so BOTH the flag-OFF tabbed page
  // and the flag-ON RelationshipTabShell render the SAME JSX. Nothing INSIDE any
  // tab component changed; the flag-OFF branch reproduces the original markup
  // byte-for-byte (same wrappers, same order, same CardTabs `?tab=` URL behavior).
  // ------------------------------------------------------------------------
  const backLink = (
    <Link
      href="/vendor-dashboard/customers"
      className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink/55 hover:text-ink"
    >
      <ArrowLeft aria-hidden className="h-4 w-4" /> Clients
    </Link>
  );

  /* The booking ask, its outcome, and this couple's fee bills — one node, drawn in the flag-off header and at the top of
     the picked client's Details page (THE ONE BUILD), so the answer is where the supplier is looking on both. */
  const askAnswerBlock = (
    <>
      {/* PR-H · THE ANSWER BELONGS WHERE THE SUPPLIER IS LOOKING.
          The Overview feed already carries this card, but a supplier who
          follows the notification's link, or who opens the client from their
          list, lands HERE — and before this they landed on a page that showed
          them a request they could read and not answer. A decision with a
          seven-day fuse may not be reachable from exactly one screen. Same two
          server actions, no second state machine. */}
      {lockNotice && !(heldNotice && search.lock_agree === 'service_on_hold') ? <LockAnswerLine notice={lockNotice} /> : null}
      {heldNotice ? <LockAnswerLine notice={heldNotice} /> : null}
      {lockRequest ? (
        <LockRequestAnswer
          eventVendorId={lockRequest.event_vendor_id}
          expiresAt={lockRequest.expires_at}
          payoutReadiness={payoutReadiness}
          feeForecast={feeForecast}
          returnTo={`/vendor-dashboard/clients/${eventId}`}
          agreeLock={vendorAgreeToLock}
          declineLock={vendorDeclineLock}
          dayCheck={dayCheck}
          waitlistAsk={vendorWaitlistTheAsk}
          heldService={heldService}
          carryOver={carryOver}
        />
      ) : askOutcome ? (
        <BookingAskOutcomeLine outcome={askOutcome} />
      ) : isBooked && !depositAcked ? (
        <PayoutMethodNudge readiness={payoutReadiness} context="client" />
      ) : null}
      {/* The bill for THIS couple, where the supplier already is. Not inside
          the ask panel: by the time a fee exists the ask has been answered. */}
      <BookingFeeBills
        bills={clientFeeBills}
        copyFor={(b) => feeDueCopy(b, manilaToday(), feeEnforced)}
        payDoorFor={(b) => {
          // 💸 A top-up's door opens its settle sheet, with WHERE to pay in it (owner 13 Nov).
          const pay = b.topUp ? settlePays.get(b.orderId) : undefined;
          if (!pay) return null;
          const copy = feeDueCopy(b, manilaToday(), feeEnforced);
          return function topUpSettleDoor(accent: string) {
            return (
            <TopUpSettleSheet
              orderId={b.orderId}
              label={copy.payLabel ?? 'Settle'}
              accent={accent}
              stage={topUpStage(b.dueOn, manilaToday())}
              dueOn={b.dueOn}
              coupleName={b.coupleName}
              pay={pay}
            />
            );
          };
        }}
      />
      <WaivedFeeRows charges={clientWaived} />
    </>
  );

  const badgesRow = (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {runsThisEvent ? (
        <Badge tone="quiet" data="coordinator">{runThisEvent?.seatWord ?? 'Coordinator'}</Badge>
      ) : null}
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${stagePill.cls}`}
      >
        {stagePill.label}
      </span>
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
          isImported
            ? 'bg-ink/5 text-ink/60'
            : 'bg-terracotta/10 text-terracotta-700'
        }`}
      >
        {isImported ? (
          <>
            <UserRound aria-hidden className="h-3 w-3" /> Imported
          </>
        ) : isFromSetnayan ? (
          // RW-39 (walk 13 Nov 2026): a couple Setnayan brought — the same sources the fee counts as sourced. It read
          // "In-house" beside "fee due", which a supplier reads as "my own client".
          <>
            <Sparkles aria-hidden className="h-3 w-3" /> From Setnayan
          </>
        ) : (
          <>
            <Sparkles aria-hidden className="h-3 w-3" /> In-house
          </>
        )}
      </span>
      {brief.booked_categories.map((c) => (
        <span
          key={c}
          className="inline-flex items-center rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-ink/70"
        >
          {isBooked ? 'Booked · ' : ''}
          {displayServiceLabel(c)}
        </span>
      ))}
    </div>
  );

  const identityBlock = (
    <div className="flex items-start gap-4">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-ink/10 bg-white text-lg font-semibold text-ink/70">
        {initials(brief.event.display_name)}
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
          {eventName}
        </h1>
        {metaBits.length > 0 ? (
          <p className="mt-0.5 truncate text-sm text-ink/55">{metaBits.join(' · ')}</p>
        ) : null}
        {askAnswerBlock}
        {badgesRow}
      </div>
    </div>
  );

  const actionRow = (
    <div className="mt-3 flex flex-wrap gap-2">
      {runsThisEvent ? <OpenTheirEvent eventId={eventId} /> : null}
      {threadId ? (
        <Link
          href={`/vendor-dashboard/messages/${threadId}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-cream"
        >
          <MessageSquare aria-hidden className="h-3.5 w-3.5" /> Open chat
        </Link>
      ) : null}
      <Link
        href={customerLandingHref('proposals')}
        className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-2 text-xs font-semibold text-ink/70 hover:border-terracotta/40"
      >
        <FileText aria-hidden className="h-3.5 w-3.5" /> New quote
      </Link>
      <Link
        href={
          hasContract
            ? customerLandingHref('contracts')
            : `/vendor-dashboard/contracts/new?event=${eventId}`
        }
        className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-2 text-xs font-semibold text-ink/70 hover:border-terracotta/40"
      >
        <FilePlus2 aria-hidden className="h-3.5 w-3.5" /> {hasContract ? 'Contract' : 'Contract'}
      </Link>
      <Link
        href={`/vendor-dashboard/clients/${eventId}?tab=files`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-2 text-xs font-semibold text-ink/70 hover:border-terracotta/40"
      >
        <Paperclip aria-hidden className="h-3.5 w-3.5" /> Files
      </Link>
      <Link
        href={`/vendor-dashboard/clients/${eventId}?tab=schedule`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-2 text-xs font-semibold text-ink/70 hover:border-terracotta/40"
      >
        <CalendarDays aria-hidden className="h-3.5 w-3.5" /> Schedule
      </Link>
      {threadId ? (
        <Link
          href={`/vendor-dashboard/messages/${threadId}#pending-payments`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-2 text-xs font-semibold text-ink/70 hover:border-terracotta/40"
        >
          <Wallet aria-hidden className="h-3.5 w-3.5" /> Log payment
        </Link>
      ) : null}
    </div>
  );

  /**
   * "Ask the host for access" — one definition, mounted by BOTH renders.
   *
   * 🚨 IT SHIPPED ON ONE BRANCH ONLY. The first version sat inside the
   * flag-OFF body, and the flag-ON `RelationshipTabShell` return never
   * mentioned it — so whether a coordinator could ask for the guest list
   * depended on an environment variable whose production value is not readable
   * from a session (it inlines at build time). The file's own comment three
   * hundred lines up asserts that both branches "render the SAME JSX"; a
   * sentence is not a mechanism. Defined here, used twice, so the two cannot
   * drift again.
   */
  const askBlock = isBooked ? (
    <div className="mt-4 space-y-4">
      <AskAccess
        eventId={eventId}
        askable={askableAreas}
        pendingAreas={myPendingAsk?.requestedAreas ?? null}
        held={myGrants}
        lastAnswer={myLastAnswer}
        askerIsCoordinator={theBookedCoordinator}
      />
      {asksForMe ? (
        <CoordinatorAnswers
          eventId={eventId}
          asks={asksForMe.asks}
          measured={asksForMe.measured}
          shareable={(Object.keys(myGrants) as DelegateArea[]).filter((a) => myGrants[a])}
          changes={
            changesForMe && (!changesForMe.measured || changesForMe.rows.length > 0) ? (
              <ChangeRequestsQueue eventId={eventId} rows={changesForMe.rows} measured={changesForMe.measured} />
            ) : null
          }
        />
      ) : null}
      {proposeTargets && myChanges ? (
        <ProposeChange
          eventId={eventId}
          ops={proposeOps}
          guests={proposeTargets.guests}
          tables={proposeTargets.tables}
          suppliers={proposeTargets.suppliers}
          mine={myChanges.rows}
          measured={proposeTargets.measured && myChanges.measured}
        />
      ) : null}
    </div>
  ) : null;

  const pipelineBlock = (
    <div className="mt-3">
      <PipelineStrip
        reached={reached}
        current={current}
        capAt={capAt}
        currentLabel={pipelineCurrentLabel({
          isBooked,
          lockRequested: Boolean(lockRequest),
          isAccepted,
        })}
      />
    </div>
  );

  const overviewNode = (
    <OverviewTab
      eventId={eventId}
      brief={brief}
      headcountRule={headcountRule}
      headcountNames={headcountNames}
      returningFlag={returningFlag}
      isBooked={isBooked}
      paletteEntries={paletteEntries}
      mealEntries={mealEntries}
      monogramSvg={monogramSvg}
      monogramPlays={monogramPlays}
      isImported={isImported}
      editorialEligibility={editorialEligibility}
      canEditCocktail={canEditCocktail}
      vendorProfileId={profile.vendor_profile_id}
      posterRef={posterRef}
      posterDisplayUrl={posterDisplayUrl}
      boothStudioContent={boothStudioContent}
      completion={completion}
      eventVendorId={eventVendorId}
      depositRecorded={depositRecorded}
      firstPayment={firstPayment}
      paymentHistory={supplierPaymentHistory}
      depositAcked={depositAcked}
      depositDeclined={depositDeclined}
      isCompleteConfirmed={isCompleteConfirmed}
      isDisputed={isDisputed}
      isVendorMarked={isVendorMarked}
      hideCompletion={relationshipShellEnabled}
      search={search}
      depositReturnTo={depositReturnTo}
    />
  );

  /*
    THE ASK PANEL — AND WHERE IT HAD TO GO, WHICH IS NOT WHERE IT LOOKS LIKE IT
    SHOULD.

    🔴 THIS PAGE HAS TWO SHELLS AND ONLY ONE OF THEM HAS A "PAYMENTS" TAB. The
    unified RelationshipTabShell (chat · quote · payments · files · …) renders
    ONLY behind `NEXT_PUBLIC_RELATIONSHIP_WORKSPACE_ENABLED`, which defaults
    OFF. The shell production actually serves has six tabs and `payments` is not
    one of them — `normalizeTab` does not accept the word, so a redirect to
    `?tab=payments` silently lands on Overview.

    The panel therefore lives on **Quote & Payments** (`quoteNode`), the one
    money tab BOTH shells render, immediately under the balance it is about. One
    copy, one redirect target, reachable on either arm. *A fix nobody can reach
    is no fix* — this repo has paid for that three times, and the third was the
    owner finding it.

    ⛔ NOT rendered when the shop is not booked. `vendor_payment_asks`' insert
    policy is gated on `current_vendor_booked_event_ids()`, so a form there would
    be a door that always refuses.
  */
  const askNotice = typeof search.ask === 'string' ? search.ask : null;
  // Rendered when the shop CAN ask, or when it just tried and needs to be told
  // why it could not — never nothing in the second case.
  const askPanel = isBooked || askNotice ? (
    <PaymentAsksPanel
      eventId={eventId}
      customerName={eventName}
      asks={paymentAsks.map((a) => ({
        askId: a.ask_id,
        // PostgREST hands NUMERIC back as a STRING. `Number(null)` is 0, which
        // would render "₱0" — a real-looking figure for a value we do not have —
        // so an unreadable amount becomes null and the row prints an em dash.
        amountPhp:
          a.amount_php == null || Number.isNaN(Number(a.amount_php))
            ? null
            : Number(a.amount_php),
        note: a.note,
        dueDate: a.due_date,
        createdAt: a.created_at,
      }))}
      measured={asksMeasured}
      notice={askNotice}
      canAsk={isBooked}
    />
  ) : null;

  const quoteTab = (afterMoney?: React.ReactNode) => (
    <QuoteTab
      eventId={eventId}
      proposals={proposals}
      isBooked={isBooked}
      planStepRows={planStepRows}
      // Only what still waits on the supplier — a refused payment is Setnayan's.
      pendingPayments={awaitingPayments}
      ledgerMoney={ledgerMoney}
      ledgerUnreadable={ledgerUnreadable}
      threadId={threadId}
      askPanel={askPanel}
      afterMoney={afterMoney}
    />
  );
  const reservationAcknowledgedAt = planStepRows?.reservationAcknowledgedAt ?? null;
  // Flag ON: the Quotation page carries no reservation line — it is on the Payment page. Flag OFF has no Payment
  // page, so its Quote & Payments tab mounts the same line under the money fold, as before.
  const quoteNode = quoteTab();
  const quoteNodeFlagOff = quoteTab(<ReservationLine acknowledgedAt={reservationAcknowledgedAt} />);

  /* 🗂 What every picked-client page is handed (`_pages/context.ts`) — facts this page already resolved, no new read. */
  const pickedCtx: PickedPageContext = {
    eventId,
    vendorProfileId: profile.vendor_profile_id,
    viewerUserId: user.id,
    threadId,
    eventName,
    stage: brief.stage,
    isBooked,
    feeUnlocked,
    eventVendorId,
    eventDate: brief.event.event_date,
  };

  // Files: the ONE shared builder, read once; the page body (`_pages/files.tsx`, C1) draws the rows.
  const sharedFiles = buildSharedFiles({
    contracts,
    handovers,
    chatFiles,
    coupleLabel: eventName,
  });
  const filesNode = (
    <FilesPage
      ctx={pickedCtx}
      files={sharedFiles}
      chatFilesMeasured={chatFilesMeasured}
      threadId={threadId}
      isBooked={isBooked}
      board={<EventFilesSection ctx={pickedCtx} mode="files" />}
    />
  );

  /* 📅 YOUR SCHEDULE, SAVED FOR NO SIGNAL — this supplier's (a Host/MC's) own day, kept on their phone for the venue
     (`lib/offline-copies.ts`). The version is what this tab draws of the day; a read that failed is `unread`, which is
     never kept over the older copy. */
  const scheduleCopyPath = supplierSchedulePath(eventId);
  const scheduleCopyVersion = supplierDay ? copyVersionOf([supplierDay, runOfShowBlocks, callTime]) : OFFLINE_COPY_UNREAD;
  const scheduleNode = (
    <>
      {scheduleCopyPath ? (
        <ScheduleSavedMark viewer={user.id} eventKey={eventId} eventDate={factsRow?.event_date ?? null} path={scheduleCopyPath} version={scheduleCopyVersion} className="mb-3" />
      ) : null}
      <ScheduleTab
        eventId={eventId}
        preAgreement={preAgreement}
        brief={brief}
        allBlocks={allBlocks}
        runOfShowBlocks={runOfShowBlocks}
        canAdvance={theBookedCoordinator}
        callTime={callTime}
        callTimeAlreadyRequested={callTimeAlreadyRequested}
        supplierPart={supplierPart}
        handovers={handovers}
        handoversMeasured={handoversMeasured}
        eventVendorId={eventVendorId}
        changeOrders={changeOrders}
        changeOrdersMeasured={changeOrdersMeasured}
        search={search}
        // 🗓 v113's Schedule order (owner 2026-11-08): your part (Where · Hours · Asked of you · the chapters) and then
        // Appointments, BEFORE the handover and change requests — so the meetings sit with the day, not under the paperwork.
        appointments={
          isBooked ? (
            <div className="mt-5 border-t border-ink/10 pt-4" data-schedule-appointments="">
              <AppointmentsSection
                role="vendor"
                eventId={eventId}
                vendorProfileId={profile.vendor_profile_id}
                returnPath={`/vendor-dashboard/clients/${eventId}?tab=schedule`}
                threadId={threadId}
                currentUserId={user.id}
                counterpartyName={eventName}
                presets={appointmentPresets}
                appointments={appointmentViews}
              />
            </div>
          ) : null
        }
      />
    </>
  );

  // SCRIPT — the host/MC prep surface (owner-locked 2026-08-01). Gated on the
  // same entitlement the day-of Stage-Script desk uses, so exactly one trade
  // sees the tab. `eventTiles` narrows to what this vendor was actually booked
  // for, via the shipped category→tile bridge.
  const scriptAccess = await resolveVendorSpecializationAccessForVendor(
    supabase,
    profile.vendor_profile_id,
    {
      services: (profile as { services?: string[] | null }).services,
      eventTiles: tilesForVendorCategories(brief.booked_categories),
    },
  );
  const showScript = holdsSpecialization(scriptAccess, 'stage_script');

  const scriptNode = showScript ? (
    <ScriptTab
      eventId={eventId}
      vendorProfileId={profile.vendor_profile_id}
      coupleName={eventName}
    />
  ) : null;

  // ❓ WHAT THEY TOLD YOU — EVERY SUPPLIER (owner 2026-11-04, verbatim "Yes, every supplier"). The host reads the
  // couple's answers inside the Script tab above; every other trade reads them here, on Details (flag-on) / the
  // overview (flag-off). One place per role: never both — a supplier holding the Script tab reads them there.
  // Fee-gated like the Script tab: the answers are the couple's own words, so they open with the event.
  const coupleAnswersNode =
    !showScript && feeUnlocked ? (
      <CoupleAnswers
        supabase={supabase}
        eventId={eventId}
        vendorProfileId={profile.vendor_profile_id}
        coupleName={eventName}
      />
    ) : null;

  // One node, both layouts (the flag-on shell and the flag-off card render the
  // same `activityNode`), so the notice cannot appear on one and not the other.
  const activityNode = (
    <>
      {!notesMeasured ? (
        <p role="alert" className="mb-2 px-1 text-xs text-ink/70">
          <strong className="text-ink">We couldn&rsquo;t load your private notes.</strong>{' '}
          Notes you and your team wrote about this client are missing from the
          feed below, along with any reminder set on them. Nothing has been
          deleted.
        </p>
      ) : null}
      <ActivityFeed eventId={eventId} events={activityEvents} notes={notes} noteFailed={search.note === 'error'} />
    </>
  );

  // ── THE FEE GATE, APPLIED ONCE FOR BOTH LAYOUTS ─────────────────────────
  // `feeLockPanel` is the ONE locked screen; `gated()` is the ONE way a tab is
  // withheld. Defined here, used by both the flag-OFF card and the flag-ON
  // shell, for exactly the reason `askBlock` is (see its docblock): a gate that
  // exists on one branch is a gate whose behaviour depends on an env var whose
  // production value a session cannot read.
  //
  // 🔒 `quoteNode`, `paymentsTabNode` and the chat door are DELIBERATELY absent
  // from every call below. Money and the conversation are always open.
  const feeLockPanel = feeUnlocked ? null : (
    <EventLockedByFee
      stage={feeGate.stage}
      access={feeGate.access}
      withheld={feeWithheld}
      threadId={threadId}
    />
  );
  const gated = (node: React.ReactNode): React.ReactNode => (feeUnlocked ? node : feeLockPanel);

  // ---- Flag OFF: the current tabbed Customer Card, byte-identical ----
  if (!relationshipShellEnabled) {
    return (
      <section className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-6 lg:px-8">
        <div className="overflow-hidden sn-tile">
          {/* ============================ HEADER ============================ */}
          <header className="sticky top-0 z-10 sn-pin-hair bg-cream/95 px-4 pt-4 backdrop-blur sm:px-6">
            {backLink}
            {identityBlock}
            {actionRow}
            {pipelineBlock}

            {/* Tab rail */}
            <div className="mt-2">
              <CardTabs eventId={eventId} active={tab} showScript={showScript} />
            </div>
          </header>

          {/* ============================ BODY ============================ */}
          <div className={bodyPad}>
            {tab === 'overview' ? feeLockPanel : null}
            {/* Item 2 of the ruling — "the request to access features". The
                panel above already says why, so this withholds rather than
                repeating it. */}
            {tab === 'overview' && feeUnlocked ? askBlock : null}
            {/* Item 1 — the brief itself. Rendered at every stage, but from the
                REDACTED payload: a quoting supplier still prices the job. */}
            {tab === 'overview' ? overviewNode : null}
            {tab === 'overview' ? coupleAnswersNode : null}
            {tab === 'quote' ? quoteNodeFlagOff : null}
            {tab === 'files' ? gated(filesNode) : null}
            {tab === 'schedule' ? gated(scheduleNode) : null}
            {tab === 'script' ? gated(scriptNode) : null}
            {tab === 'activity' ? gated(activityNode) : null}
          </div>
        </div>
      </section>
    );
  }

  // ------------------------------------------------------------------------
  // Flag ON (production) — THE PICKED CLIENT (THE ONE BUILD, 8 Nov 2026 · v113):
  // the pinned row + the nine-page menu + one page body at a time
  // (`PickedClientShell`), drawn over the still-mounted Clients list when it was
  // opened from it (`customers/@client`). Everything below runs ONLY on this
  // branch, so the flag-OFF path adds zero queries and stays untouched.
  // ------------------------------------------------------------------------

  // Payments tab — the vendor's LIVE payment-confirm surface (couple-logged
  // payments awaiting confirmation + per-booking plan progress / "mark cleared").
  // Reuses VendorPaymentLive exactly as the thread page does — no payment logic is
  // reimplemented. A genuine empty state stands in when there's nothing to confirm
  // or the booking isn't live.

  const paymentsTabNode =
    isBooked && threadId ? (
      pendingPayments.length === 0 && planRowsAll.length === 0 ? (
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Payments
          </p>
          {ledgerUnreadable ? (
            <LedgerUnreadableNote />
          ) : (
            <>
          <BookingMoneySummary money={ledgerMoney} />
          <p className="flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm text-ink/55">
            <Wallet aria-hidden className="h-4 w-4 shrink-0 text-ink/40" />{' '}
            {ledgerMoney.rows.length > 0
              ? `Nothing waiting on you. When ${eventName} logs another payment, confirm it here.`
              : `No payments to confirm yet. When ${eventName} logs a payment, confirm it here.`}
          </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Payments
          </p>
          <VendorPaymentLive
            threadId={threadId}
            eventId={eventId}
            initialPending={pendingPayments}
            initialPlans={planRowsAll}
          />
        </div>
      )
    ) : (
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          Payments
        </p>
        <p className="flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm text-ink/55">
          <Wallet aria-hidden className="h-4 w-4 shrink-0 text-ink/40" /> A payment
          schedule and couple-logged payments appear here once they book you
          {threadId ? '' : ' and you start a conversation'}.
        </p>
      </div>
    );

  /*
    🗂 THE NINE PAGES. Each body is its own `_pages/<page>.tsx` (owned by the lane named in it); until a lane fills
    its page, the body draws the section this page drew before (`shipped`), relocated — never redrawn.
      • Details  — the booking ask + its answer, the stage strip, the fee panel, the access ask, the completion
                   handshake, the brief and what the couple told you (B1 step 6 re-orders it to v113).
      • Chat     — the conversation, in place (C2 lands the shared thread body).
      • Schedule — the supplier's part of the day + appointments, then the Script fold (`?tab=script`).
      • Quotation · Payment · Files — the shipped money and files sections.
      • Report   — the activity feed + private notes until C3's Report lands.
  */
  // 🔢 The three numbers (v113): every input already read above — no new request. A refused read says so.
  const sentQuote = [...proposals]
    .filter((p) => p.status !== 'draft')
    .sort((a, b) => (b.sent_at ?? b.created_at ?? '').localeCompare(a.sent_at ?? a.created_at ?? ''))[0];
  // 👥 RW-108: a claimed per-guest booking — the couple's figure and count (the same read as Customers, #7633).
  const shopPerGuest = isBooked || sentQuote ? null : (await readShopPerGuest(admin, profile.vendor_profile_id, [eventId]))?.get(eventId) ?? null;
  const numbersCells = detailsNumbers({
    isBooked,
    todayIso: manilaTodayIso(),
    eventDate: brief.event.event_date,
    ledger: ledgerUnreadable ? null : { receivedPhp: ledgerMoney.receivedPhp, expectedPhp: ledgerMoney.expectedPhp },
    onPlan: planRowsAll.length > 0,
    sentQuotePhp: proposalRowsError ? null : sentQuote ? sentQuote.total_centavos / 100 : undefined,
    perGuest: shopPerGuest,
    peso: (php) => fmtPeso(php),
  });

  // ------------------------------------------------------------------------
  // "Your next move" — decided in lib/supplier-next-move.ts and EXECUTED by its test. It was the desktop context
  // rail of the old tab shell (lg+ only); THE ONE BUILD keeps it, still desktop-only, on Details beside the stage
  // strip it explains. Its two quick links (Chat · Payments) are gone — both are pages of the menu now.
  // ------------------------------------------------------------------------
  const inquiryStatus: string | null = thread?.inquiry_status ?? null;
  const nextMove = supplierNextMove(
    {
      inquiryStatus,
      lockRequested: Boolean(lockRequest),
      awaitingPaymentCount: awaitingPayments.length,
      isDelivered,
      hasReview,
      isBooked,
      isAccepted: isAccepted,
      isQuoted,
    },
    eventName,
  );
  const nextMoveCard = (
    <div className="hidden lg:block" data-next-move="">
      <ShopCard pad="tight">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50">Your next move</p>
        <div className="mt-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${stagePill.cls}`}
          >
            {stagePill.label}
          </span>
        </div>
        <h3 className="mt-2 text-sm font-semibold text-ink">{nextMove.title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-ink/60">{nextMove.body}</p>
        {awaitingPayments.length > 0 ? (
          <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-warn-900">
            {awaitingPayments.length} awaiting confirmation
          </p>
        ) : null}
      </ShopCard>
    </div>
  );

  /*
    📋 DETAILS, IN v113's ORDER (owner 2026-11-08; v113 `strip+three+hosts+det+acc+sups+dec+forms`; B1 step 6):
    the stage strip · the three numbers · Hosts · the brief's details · the access request · Suppliers on this event ·
    Decisions · Forms sent. The answers waiting on the shop (an inquiry, a date change, a removal) sit right under the
    numbers — they are the next thing to do. Decisions is the LIST, in place (Build 2 #42): drawn by the thread page
    from the ONE draw Chat and Quotation share — 0 requests of Details' own.
  */
  const detailsShipped = (
    <div className="space-y-4" data-details-shipped="">
      {pipelineBlock}
      <DetailsNumbersRow cells={numbersCells} />
      {askAnswerBlock}
      {/* 🗓 The two answers Today used to own (date change · removal request), on THIS client — C1's ONE mount (A2 A8),
          read only for a booked client (both ask a booked/paid shop); an answer given here lands back here. */}
      {isBooked ? (
        <ClientDayAnswers
          eventId={eventId}
          vendorProfileId={profile.vendor_profile_id}
          coupleName={eventName}
          eventDate={brief.event.event_date}
        />
      ) : null}
      {badgesRow}
      {/* 🗂 The coordinator's door (owner 2026-10-28). */}
      {runsThisEvent ? (
        <div className="flex flex-wrap gap-2">
          <OpenTheirEvent eventId={eventId} />
        </div>
      ) : null}
      {nextMoveCard}
      {/* 👥 `brief.hosts` — C2's `event_chat_hosts()` on every rung (spec §9 #1); an unread list draws nothing. */}
      <HostsList hosts={hostRows(brief.hosts)} />
      {/* The brief, from the REDACTED payload at every locked stage — then what the couple told you beside it (v113 `det`). */}
      {overviewNode}
      {coupleAnswersNode}
      {feeLockPanel}
      {/* Item 2 of the ruling — "the request to access features". The panel
          above already says why, so this withholds rather than repeating it. */}
      {feeUnlocked ? askBlock : null}
      {/* The other booked suppliers — the brief carries them from booking on; absent before. */}
      {isBooked ? <SuppliersList rows={supplierRows((brief as { vendor_roster?: unknown }).vendor_roster)} /> : null}
      {isBooked && feeUnlocked ? (
        <VendorCompletionCard
          eventId={eventId}
          isCompleteConfirmed={isCompleteConfirmed}
          isDisputed={isDisputed}
          isVendorMarked={isVendorMarked}
          notice={completedNotice}
        />
      ) : null}
      {/* Decisions — the list in place (Build 2 #42), from the thread's one draw; no read of its own. */}
      <DetailsDecisions threadId={threadId} eventId={eventId} />
      <DetailsFormsDoor />
    </div>
  );

  const bodies = pickedPageBodies({
    ctx: pickedCtx,
    shipped: {
      details: detailsShipped,
      schedule: (
        <>
          {/* 📅 v113 `calC`: the shop's month first — the Clients calendar itself, this event's day picked (one request,
              on first view; the shop's own calendar, so outside the fee gate). No date yet → no month to point at. */}
          {brief.event.event_date ? <ScheduleCalendar eventDate={brief.event.event_date} todayIso={manilaTodayIso()} /> : null}
          {gated(scheduleNode)}
          {/* The Script fold sits at the END of Schedule (7 Nov ruling) — same entitlement gate as before. */}
          {showScript ? (
            <section id={SCRIPT_FOLD_ID} className="mt-6 scroll-mt-4" data-script-fold="">
              {gated(scriptNode)}
            </section>
          ) : null}
        </>
      ),
      quote: quoteNode,
      payments: paymentsTabNode,
      report: feeUnlocked ? activityNode : feeLockPanel,
      // Files are fee-gated as before: while the fee withholds the event, the page draws the one lock panel.
      files: feeUnlocked ? undefined : feeLockPanel,
    },
    files: { files: sharedFiles, chatFilesMeasured },
    // C1's Payment page draws the money itself from what this page already read (C1 NEEDS #2, wired at integration):
    // the money fold's own inputs and the shipped asks panel. Payment is a booked-only page.
    payment: {
      reservationAcknowledgedAt,
      money: isBooked
        ? {
            steps: planStepRows?.steps ?? null,
            clearedAt: planStepRows?.clearedAt ?? null,
            pending: awaitingPayments,
            ledgerMoney,
            ledgerUnreadable,
            unreadableNote: <LedgerUnreadableNote />,
          }
        : undefined,
      asks: askPanel,
      refunds:
        isBooked && eventVendorId && clientRefunds
          ? { eventVendorId, clientName: eventName, measured: clientRefunds.measured, rows: clientRefunds.rows }
          : undefined,
    },
  });

  return (
    <PickedClientShell
      eventId={eventId}
      eventName={eventName}
      chatUnread={await chatUnreadP}
      menu={pickedMenuFor(isBooked).map((m) => ({ id: m.id, label: m.label }))}
      initialPage={visiblePickedPage(rawTab, isBooked)}
      bodies={bodies}
      scrollToScript={wantsScriptFold(rawTab) && showScript}
      settingsLine={{
        line: 'Who looks after this client, and what reaches you.',
        tip: 'Settings for this client only. Your shop-wide settings stay in Clients ⚙.',
      }}
      settings={
        <PickedClientSettings
          autoAgree={factsEvent.error ? null : factsRow?.supplier_requests_auto_agree === true}
        />
      }
    />
  );
}

// The local `Card` that lived here (identical to the kit's card recipe) is
// retired — `Card` is imported from `_components/kit` at the top of the file.

// ===========================================================================
// Completion handshake card (booked) — the vendor's "Mark service complete"
// affordance + the four post-mark states. Extracted verbatim from OverviewTab
// so BOTH the inline flag-OFF render and the flag-ON relationship-shell
// Details-tab node share one source of truth (reuses vendorMarkServiceComplete —
// no handshake logic reimplemented).
// ===========================================================================
function VendorCompletionCard({
  eventId,
  isCompleteConfirmed,
  isDisputed,
  isVendorMarked,
  notice,
}: {
  eventId: string;
  isCompleteConfirmed: boolean;
  isDisputed: boolean;
  isVendorMarked: boolean;
  /**
   * `?completed=` — and it took a sweep to notice NOBODY WAS READING IT.
   * `vendorMarkServiceComplete` has redirected with `?completed=1` since the
   * handshake shipped and no component anywhere in the tree ever looked at the
   * word, so the one thing that changed on the screen was the state below —
   * which also changes on a reload, an hour later, for any other reason. 🔑 A
   * redirect flag that nothing renders is not feedback; it is a log line with
   * a nicer address. Same disease as the bounce this PR is about, one step
   * further along: the supplier arrives on the RIGHT tab and is still not told.
   */
  notice?: string | null;
}) {
  return (
    <Card>
      {notice === '1' ? (
        <p
          role="status"
          className="mb-3 rounded-lg bg-success-50 px-3 py-2 text-xs text-success-900"
        >
          Marked complete — the couple has been asked to confirm they received everything.
        </p>
      ) : null}
      {notice === 'notyours' ? (
        <p role="alert" className="mb-3 rounded-lg bg-warn-50 px-3 py-2 text-xs text-warn-900">
          We couldn&rsquo;t find your booking on this event, so nothing was marked. If you were
          booked here, open the conversation and tell the couple.
        </p>
      ) : null}
      {isCompleteConfirmed ? (
        <div className="flex items-center gap-3 text-sm">
          <CheckCircle2 aria-hidden className="h-5 w-5 shrink-0 text-success-600" strokeWidth={1.75} />
          <span className="text-ink/75">
            <span className="font-medium text-ink">Service complete.</span> The couple confirmed
            they received everything.
          </span>
        </div>
      ) : isDisputed ? (
        <div className="flex items-center gap-3 text-sm">
          <Clock3 aria-hidden className="h-5 w-5 shrink-0 text-warn-600" strokeWidth={1.75} />
          <span className="text-ink/75">
            <span className="font-medium text-ink">The couple reported a problem</span> with the
            delivery. Reach out via your thread to sort it out.
          </span>
        </div>
      ) : isVendorMarked ? (
        <div className="flex items-center gap-3 text-sm">
          <Clock3 aria-hidden className="h-5 w-5 shrink-0 text-ink/40" strokeWidth={1.75} />
          <span className="text-ink/75">
            <span className="font-medium text-ink">Marked complete.</span> Waiting on the couple to
            confirm they received everything (auto-confirms after 7 days).
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-ink/70">
            <span className="font-medium text-ink">Wrapped up this wedding?</span> Mark your
            service complete — the couple confirms they got everything, then their review opens.
          </div>
          <form action={vendorMarkServiceComplete}>
            <input type="hidden" name="event_id" value={eventId} />
            <SubmitButton className="button-primary shrink-0" pendingLabel="Marking…">
              Mark service complete
            </SubmitButton>
          </form>
        </div>
      )}
    </Card>
  );
}

// ===========================================================================
// Returning-client marker (Details/Overview tab, PR 5).
//
// Rendered ONLY when `returningFlag` is present — i.e. this couple has a
// prior CONFIRMED booking with this vendor on a DIFFERENT event (answering an
// inquiry is now free — the returning-client signal is informational only). The reuse RPC returns the
// most-recent prior event's name/date (DISTINCT ON) — not an exact count and not
// its event_id — so we name that one past event rather than link a list.
//
// 🧹 The shortcut pills that sat under it (Chat · Quote · Files · Details) were removed 12 Nov 2026 (owner, live): a
// leftover from before the picked-client menu, which already opens every one of those pages — and its "Quote" went to
// the chat's #build-quote, not the Quotation page. 🔒 lib/the-details-page-has-no-second-menu.test.ts
// ===========================================================================
function ReturningMarker({ returningFlag }: { returningFlag: ReturningClientFlag | null }) {
  if (!returningFlag) return null;
  return (
    <ShopCard>
      <div className="flex items-start gap-3 rounded-xl border border-mulberry/20 bg-mulberry/[0.05] px-3 py-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mulberry/10 text-mulberry">
          <History aria-hidden className="h-4 w-4" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-mulberry">
            Returning client · you&rsquo;ve worked together before
          </p>
          <p className="mt-0.5 text-xs text-ink/65">
            {returningFlag.prior_event_display_name ? (
              <>
                Previously booked you for{' '}
                <span className="font-medium text-ink/80">
                  {returningFlag.prior_event_display_name}
                </span>
                {returningFlag.prior_event_date
                  ? ` · ${fmtShortDate(returningFlag.prior_event_date)}`
                  : ''}
                .
              </>
            ) : (
              'This couple has booked you on a previous event.'
            )}
          </p>
        </div>
      </div>
    </ShopCard>
  );
}

// ===========================================================================
// OVERVIEW TAB
// ===========================================================================
function OverviewTab(props: {
  eventId: string;
  brief: Brief;
  /** 🧮 Their count and its why (owner 2026-11-04) — null for a flat-priced service or a refused read. */
  headcountRule: SupplierHeadcount | null;
  /** The couple's words for roles, for the rule's line. */
  headcountNames: RoleNames | null;
  returningFlag: ReturningClientFlag | null;
  isBooked: boolean;
  paletteEntries: { key: string; label: string; colors: string[] }[];
  mealEntries: [string, number][];
  monogramSvg: string | null;
  monogramPlays: boolean;
  isImported: boolean;
  editorialEligibility: Awaited<ReturnType<typeof getEditorialEligibility>>;
  canEditCocktail: boolean;
  vendorProfileId: string;
  /** Raw stored ref for this vendor's per-event booth poster, or null. */
  posterRef: string | null;
  /** Resolved display URL for the poster preview, or null. */
  posterDisplayUrl: string | null;
  /** This vendor's Booth Studio words for this event (sanitized), or null. */
  boothStudioContent: BoothStudioContent | null;
  completion: {
    deposit_proof_url: string | null;
    /** The supplier's own words when they said it never reached them. */
    deposit_decline_reason?: string | null;
  } | null;
  eventVendorId: string | null;
  depositRecorded: boolean;
  depositAcked: boolean;
  /** They answered "it never arrived" — a state that keeps the couple's record. */
  depositDeclined: boolean;
  /**
   * The first payment this supplier's ACCEPTED quote asked for, and whether the
   * couple has recorded it (`supplierFirstPaymentStatus`). null = no accepted
   * quote, or it requested no first payment.
   */
  firstPayment: {
    sentence: string;
    status: SupplierFirstPaymentStatus;
    /** The next installment from `moneyStep`, once the first is settled. */
    nextLine: string | null;
    laterRows: { label: string; amount: string; dueText: string }[];
  } | null;
  /**
   * WHAT THE COUPLE HAS ALREADY PAID — `readBookedMoney().history`, the same
   * shape their own card renders. A refused ledger read arrives as
   * `{ state: 'unreadable' }` and says so; it is never shown as no payments.
   */
  paymentHistory: PaymentHistory | null;
  isCompleteConfirmed: boolean;
  isDisputed: boolean;
  isVendorMarked: boolean;
  /** Flag ON: the relationship shell renders the completion card as its own
   *  Details-tab node, so suppress the inline copy here to avoid doubling up.
   *  Flag OFF: false → the card renders inline exactly as before. */
  hideCompletion: boolean;
  search: { deposit_ack?: string; deposit_reject?: string; completed?: string };
  /**
   * The tab this page is showing, as a path the deposit forms post back.
   * Resolved by the PAGE (past its chat-redirect gate, so it is never `chat`)
   * and re-validated by the action — see lib/vendor-client-return.ts and the
   * owner's 2026-09-20 "clicked confirmed and it just bounced to the chat page".
   */
  depositReturnTo: string;
}) {
  const {
    eventId,
    depositReturnTo,
    brief,
    headcountRule,
    headcountNames,
    returningFlag,
    isBooked,
    paletteEntries,
    mealEntries,
    monogramSvg,
    monogramPlays,
    isImported,
    editorialEligibility,
    canEditCocktail,
    vendorProfileId,
    posterRef,
    posterDisplayUrl,
    boothStudioContent,
    completion,
    eventVendorId,
    depositRecorded,
    depositAcked,
    depositDeclined,
    firstPayment,
    paymentHistory,
    isCompleteConfirmed,
    isDisputed,
    isVendorMarked,
    hideCompletion,
    search,
  } = props;

  return (
    <div className="space-y-4">
      {/* Returning-client marker + quick-action bar (Relationship Workspace ·
          Details tab, PR 5). Additive — sits at the top of the Overview. */}
      <ReturningMarker returningFlag={returningFlag} />

      {/* Imported hint (invite the couple to Setnayan). */}
      {isImported ? (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-terracotta/30 bg-terracotta/[0.05] p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Invite them to Setnayan — free</p>
            <p className="mt-0.5 text-sm text-ink/65">
              This couple lives in your own book. Invite them and their planning syncs here
              automatically.
            </p>
          </div>
          <Link
            href="/vendor-dashboard/clients"
            className="shrink-0 text-sm font-semibold text-mulberry hover:underline"
          >
            Invite →
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Event snapshot */}
        <Card>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink/70">
            <CalendarDays aria-hidden className="h-4 w-4 text-terracotta" /> Event snapshot
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink/55">Date</dt>
              <dd className="text-right font-medium">{fmtDate(brief.event.event_date)}</dd>
            </div>
            {brief.event.venue_name || brief.event.venue_address ? (
              <>
                {brief.event.venue_name ? (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-ink/55">Venue</dt>
                    <dd className="text-right font-medium">{brief.event.venue_name}</dd>
                  </div>
                ) : null}
                {brief.event.venue_address ? (
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-ink/55">Address</dt>
                    <dd className="text-right font-medium">{brief.event.venue_address}</dd>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink/55">Area</dt>
                <dd className="text-right font-medium">
                  {brief.event.region ?? 'Not shared yet'}
                </dd>
              </div>
            )}
          </dl>
          {brief.event.ceremony_type ? (
            <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-ink/15 bg-white/70 px-2.5 py-1 text-xs font-medium text-ink/70">
              <Church aria-hidden className="h-3.5 w-3.5" />
              {brief.event.ceremony_type.replace(/_/g, ' ')}
            </span>
          ) : null}
        </Card>

        {/* Headcount */}
        <Card>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink/70">
            <Users aria-hidden className="h-4 w-4 text-terracotta" /> Headcount
          </h2>
          {/* 🧮 WHO THEY COUNT (owner 2026-11-04, the approved prototype's "Supplier · their count"): a per-head service
              reads ITS number — the couple's rule and ticks applied — with the why in the ⓘ. Numbers only, never names. */}
          {headcountRule ? (
            <SupplierCountTile count={headcountRule} names={headcountNames} />
          ) : brief.pax.invited > 0 ? (
            <>
              <p className="mt-3 text-3xl font-semibold tracking-tight">
                {brief.pax.attending}
                <span className="ml-2 text-sm font-normal text-ink/55">
                  attending of {brief.pax.invited} invited
                </span>
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/60">
                <span>{brief.pax.pending} pending</span>
                <span>{brief.pax.maybe} maybe</span>
                <span>{brief.pax.declined} declined</span>
              </div>
              <p className="mt-2 text-xs text-ink/45">
                RSVPs are still moving — numbers firm up closer to the day.
              </p>
            </>
          ) : (
            <p className="mt-3 flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2.5 text-sm text-ink/55">
              <Info aria-hidden className="h-4 w-4 shrink-0 text-ink/40" /> No guest list yet — this
              fills in once they start their RSVPs.
            </p>
          )}
        </Card>

        {/* Dietary (food-relevant categories + coordinator only) — every stage
            since 20271235469220; the RPC returns NULL for other categories. */}
        {brief.dietary ? (
          <Card>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink/70">
              <UtensilsCrossed aria-hidden className="h-4 w-4 text-terracotta" /> Meals
              <span className="text-xs font-normal text-ink/50">(attending guests)</span>
            </h2>
            {mealEntries.length === 0 ? (
              <p className="mt-2 text-sm text-ink/55">No meal preferences recorded yet.</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {mealEntries.map(([pref, n]) => (
                  <li key={pref} className="flex items-center justify-between text-sm">
                    <span>{MEAL_LABELS[pref] ?? pref}</span>
                    <span className="font-semibold">{n}</span>
                  </li>
                ))}
              </ul>
            )}
            {brief.dietary.restriction_notes > 0 ? (
              <p className="mt-3 rounded-lg bg-warn-50 px-3 py-2 text-xs text-warn-900">
                {brief.dietary.restriction_notes}{' '}
                {brief.dietary.restriction_notes === 1 ? 'guest has' : 'guests have'} dietary
                restriction notes — ask the couple for the details that matter to your menu.
              </p>
            ) : null}
            {isBooked ? (
              <Link
                href={`/vendor-dashboard/clients/${eventId}/production-sheet`}
                className="mt-3 inline-block text-sm font-medium text-mulberry underline"
              >
                Open the production sheet
              </Link>
            ) : null}
          </Card>
        ) : null}

        {/* Style — palette + monogram merged (per prototype). */}
        <Card>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink/70">
            <Palette aria-hidden className="h-4 w-4 text-terracotta" /> Style
          </h2>
          <div className="mt-3 flex items-start gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-terracotta/20 bg-terracotta/[0.06]">
              {monogramSvg ? (
                /* SEC-3: inert data-URI <img>, NOT dangerouslySetInnerHTML —
                   this is the couple's host-writable mark rendering inside a
                   vendor's session. eslint-disable-next-line @next/next/no-img-element */
                <CoupleLogo
                  svg={monogramSvg}
                  plays={coupleLogoPlays(monogramSvg, monogramPlays)}
                  place="vendor-client-style"
                  className="flex h-full w-full p-0.5"
                  still={
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={bespokeSvgToDataUri(monogramSvg)}
                      alt=""
                      className="h-full w-full object-contain p-0.5"
                      draggable={false}
                    />
                  }
                />
              ) : brief.monogram.text ? (
                <span
                  className="text-lg font-semibold tracking-wide"
                  style={{ color: brief.monogram.color ?? undefined }}
                >
                  {brief.monogram.text}
                </span>
              ) : (
                <Palette aria-hidden className="h-6 w-6 text-terracotta/50" />
              )}
            </div>
            <p className="text-xs text-ink/55">
              Their monogram &amp; palettes, pulled from the mood board.
            </p>
          </div>
          {paletteEntries.length === 0 ? (
            <p className="mt-3 text-sm text-ink/55">The couple hasn&rsquo;t set their palettes yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {paletteEntries.map((p) => (
                <li key={p.key} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-ink/70">{p.label}</span>
                  <span className="flex gap-1.5">
                    {p.colors.map((hex, i) => (
                      <span
                        key={`${hex}-${i}`}
                        title={hex}
                        className="h-5 w-5 rounded-full border border-ink/15"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`/vendor-dashboard/clients/${eventId}/mood-board`}
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-mulberry hover:underline"
          >
            Open mood board →
          </Link>
        </Card>

        {/* Budget — couple opt-in range for THIS vendor's category (PR-5).
         *  Rendered at both stages; it's a quote input, most useful at inquiry.
         *  Present → a rounded range; absent → the couple hasn't opted in (or has
         *  no allocation for this category). Never an exact figure. */}
        <Card>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink/70">
            <Wallet aria-hidden className="h-4 w-4 text-terracotta" /> Budget
          </h2>
          {brief.budget_band ? (
            <>
              <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">
                {fmtPesoCentavos(brief.budget_band.lo_centavos)}
                <span className="mx-1.5 text-ink/40">–</span>
                {fmtPesoCentavos(brief.budget_band.hi_centavos)}
              </p>
              <p className="mt-2 text-xs text-ink/55">
                Shared by the couple · for your category. A range to quote against —
                never their exact number.
              </p>
            </>
          ) : (
            <p className="mt-3 flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2.5 text-sm text-ink/55">
              <Info aria-hidden className="h-4 w-4 shrink-0 text-ink/40" /> Not shared —
              the couple hasn&rsquo;t opted into budget sharing.
            </p>
          )}
        </Card>
      </div>

      {/* Seat plan — status + size at every stage; the floor plan itself opens once booked. */}
      <Card>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink/70">
          <LayoutGrid aria-hidden className="h-4 w-4 text-terracotta" /> Seat plan
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              brief.seat_plan.published
                ? 'bg-success-100 text-success-900'
                : 'bg-ink/5 text-ink/60'
            }`}
          >
            {brief.seat_plan.published ? 'Published' : 'Not published yet'}
          </span>
          <span className="text-sm text-ink/65">
            {formatCount(brief.seat_plan.table_count)} tables · {formatCount(brief.seat_plan.assigned_guests)} guests seated
          </span>
        </div>
        {brief.seat_plan.published && isBooked ? (
          <Link
            href={`/vendor-dashboard/clients/${eventId}/seat-plan`}
            className="mt-2 inline-block text-sm font-medium text-mulberry underline"
          >
            View the floor plan
          </Link>
        ) : brief.seat_plan.published ? (
          <p className="mt-2 text-xs text-ink/45">
            You can open the floor plan once they book you.
          </p>
        ) : (
          <p className="mt-2 text-xs text-ink/45">
            Once the couple publishes their floor plan, you&rsquo;ll be able to view it here.
          </p>
        )}
      </Card>

      {/* "From your vendors" editorial media (booked, recommended pick only). */}
      {editorialEligibility.eligible ? (
        <Link
          href={`/vendor-dashboard/clients/${eventId}/editorial-media`}
          className="flex items-center justify-between gap-4 rounded-2xl border border-terracotta/30 bg-terracotta/[0.05] p-4 transition hover:bg-terracotta/[0.08] sm:p-5"
        >
          <span>
            <span className="block text-sm font-semibold">Add to their editorial ✨</span>
            <span className="mt-0.5 block text-sm text-ink/65">
              You&rsquo;re the couple&rsquo;s recommended pick — add up to 3 photos and 3 short clips of
              your work, credited to you on their front-page story.
            </span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-mulberry">Open →</span>
        </Link>
      ) : editorialEligibility.isRecommendedPick ? (
        <ShopCard className="flex items-start gap-3">
          <Sparkles aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-ink/30" strokeWidth={1.75} />
          <span>
            <span className="block text-sm font-semibold">Add to their editorial ✨</span>
            <span className="mt-0.5 block text-sm text-ink/65">
              {editorialEligibility.isDisputed
                ? `${brief.event.display_name ?? 'The couple'} reported a problem with the delivery. Once that’s sorted out, you can add a photo or a 5-second clip to their story.`
                : `Once ${brief.event.display_name ?? 'the couple'} marks your service complete, you can add a photo or a 5-second clip to their story — credited to you on their front-page editorial.`}
            </span>
          </span>
        </ShopCard>
      ) : null}

      {/* Deposit acknowledge (booked). */}
      {/* Reject outcome. ⚠ IT USED TO SIT OUTSIDE THE DEPOSIT CARD because a
          successful reject erased the claim and the card vanished with it. The
          couple keeps their record now, so the card stays and says what
          happened; this notice is the confirmation of the press itself. */}
      {search.deposit_reject === 'ok' ? (
        <Card>
          <p className="text-sm text-ink/75">
            <span className="font-medium text-ink">Marked as not received.</span> They were told, and
            their own record of paying was kept — a payment can be slow or land under a different
            name. If they send it again you&rsquo;ll be asked once more.
          </p>
        </Card>
      ) : search.deposit_reject === 'error' ? (
        <Card>
          <p role="alert" className="text-xs text-warn-900">That didn&rsquo;t go through — try again.</p>
        </Card>
      ) : null}

      {firstPayment || paymentHistory ? (
        <Card>
          {firstPayment ? (
            <>
          <p className="text-sm font-medium text-ink">{firstPayment.sentence}</p>
          <p
            className={
              firstPayment.status.state === 'recorded_short' || firstPayment.status.state === 'refused'
                ? 'mt-1 text-xs text-warn-900'
                : 'mt-1 text-xs text-ink/65'
            }
          >
            {firstPayment.status.line}
          </p>
          {firstPayment.nextLine ? (
            <p className="mt-1 text-xs font-medium text-ink">{firstPayment.nextLine}</p>
          ) : null}
          {firstPayment.laterRows.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-ink/65">
              {firstPayment.laterRows.map((r, i) => (
                <li key={`${i}-${r.label}`}>
                  {r.label}: {r.amount} — due {r.dueText}
                </li>
              ))}
            </ul>
          ) : null}
            </>
          ) : null}
          {/* WHAT THEY HAVE ALREADY PAID — the supplier's end of the couple's
              own history, from the SAME `readBookedMoney().history`. */}
          <PaymentHistoryList history={paymentHistory} className="mt-3 border-t border-ink/10 pt-2" />
        </Card>
      ) : null}

      {depositRecorded && eventVendorId ? (
        <Card>
          {search.deposit_ack === 'error' ? (
            <p role="alert" className="mb-3 rounded-lg bg-warn-50 px-3 py-2 text-xs text-warn-900">
              That didn&rsquo;t go through — try again.
            </p>
          ) : null}
          {depositAcked ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle2 aria-hidden className="h-5 w-5 shrink-0 text-success-600" strokeWidth={1.75} />
                <span className="text-ink/75">
                  <span className="font-medium text-ink">Payment confirmed.</span> You&rsquo;ve confirmed
                  you received the couple&rsquo;s payment — their date is locked in.
                </span>
              </div>
              {/* ── THE RECEIPT, BIG ENOUGH TO JUDGE (owner, live, 2026-09-20) ──
                  This was the words "View proof" and nothing else, on the one
                  screen where a supplier decides whether a couple's money
                  arrived. You cannot check a reference number against your bank
                  app through a link you have to open in another tab — and on a
                  phone that tab replaces the Confirm button you were reaching
                  for. `deposit_proof_url` here is ALREADY a short-lived signed
                  link (depositProofDisplayUrl, resolved above) — never the
                  stored ref, never public. */}
              {completion?.deposit_proof_url ? (
                <ProofImage
                  url={completion.deposit_proof_url}
                  alt="The payment proof this couple sent"
                  className="pl-8"
                />
              ) : null}
            </div>
          ) : depositDeclined ? (
            /*
              YOU SAID IT NEVER REACHED YOU — a state that could not exist before
              2026-08-27, because the refusal erased the claim and this whole card
              disappeared with it. The couple keeps their record now, so the card
              stays and reports the answer instead of asking again.
              🔑 CONFIRM SURVIVES; REFUSE DOES NOT. A payment can turn up a day
              later under a different name, and the acknowledge RPC clears the
              refusal for exactly that. Refusing twice would change nothing, so
              there is no second refusal to press.
            */
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="text-sm text-ink/70">
                <span className="font-medium text-ink">You said this never reached you.</span> They
                were told, and their own record of paying was kept.
                {completion?.deposit_decline_reason ? (
                  <>
                    {' '}
                    Your words: &ldquo;{completion.deposit_decline_reason}&rdquo;
                  </>
                ) : null}
              {/* ── THE RECEIPT, BIG ENOUGH TO JUDGE (owner, live, 2026-09-20) ──
                  This was the words "View proof" and nothing else, on the one
                  screen where a supplier decides whether a couple's money
                  arrived. You cannot check a reference number against your bank
                  app through a link you have to open in another tab — and on a
                  phone that tab replaces the Confirm button you were reaching
                  for. `deposit_proof_url` here is ALREADY a short-lived signed
                  link (depositProofDisplayUrl, resolved above) — never the
                  stored ref, never public. */}
                {completion?.deposit_proof_url ? (
                  <ProofImage
                    url={completion.deposit_proof_url}
                    alt="What this couple sent as proof"
                    className="mt-2"
                  />
                ) : null}
              </div>
              <form action={vendorAcknowledgeDeposit}>
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="vendor_id" value={eventVendorId} />
                <input type="hidden" name="return_to" value={depositReturnTo} />
                <SubmitButton
                  className="button-secondary w-full shrink-0 sm:w-auto"
                  pendingLabel="Confirming…"
                >
                  It arrived after all
                </SubmitButton>
              </form>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-ink/70">
                <span className="font-medium text-ink">A couple recorded a payment.</span> The date is
                held for you. Confirm you received it to lock it in.
              {/* ── THE RECEIPT, BIG ENOUGH TO JUDGE (owner, live, 2026-09-20) ──
                  This was the words "View proof" and nothing else, on the one
                  screen where a supplier decides whether a couple's money
                  arrived. You cannot check a reference number against your bank
                  app through a link you have to open in another tab — and on a
                  phone that tab replaces the Confirm button you were reaching
                  for. `deposit_proof_url` here is ALREADY a short-lived signed
                  link (depositProofDisplayUrl, resolved above) — never the
                  stored ref, never public. */}
                {completion?.deposit_proof_url ? (
                  <ProofImage
                    url={completion.deposit_proof_url}
                    alt="The payment proof this couple sent"
                    className="mt-2"
                  />
                ) : null}
              </div>
              <div className="flex flex-col items-stretch gap-2 sm:items-end">
                <form action={vendorAcknowledgeDeposit}>
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="vendor_id" value={eventVendorId} />
                  <input type="hidden" name="return_to" value={depositReturnTo} />
                  <SubmitButton className="button-primary w-full shrink-0 sm:w-auto" pendingLabel="Confirming…">
                    Confirm payment received
                  </SubmitButton>
                </form>
                {/* Reject path — the vendor never received this payment. Clears
                    the couple's recorded deposit so they must re-submit (does NOT
                    un-lock the booking). Optional reason reaches the couple. */}
                <details className="text-right">
                  <summary className="cursor-pointer list-none text-[11px] font-medium text-ink/50 underline-offset-2 hover:text-ink/75 hover:underline">
                    Didn&rsquo;t receive it?
                  </summary>
                  <form action={vendorRejectDeposit} className="mt-2 flex flex-col gap-2 text-left">
                    <input type="hidden" name="event_id" value={eventId} />
                    <input type="hidden" name="vendor_id" value={eventVendorId} />
                    <input type="hidden" name="return_to" value={depositReturnTo} />
                    <input
                      type="text"
                      name="reason"
                      maxLength={200}
                      placeholder="Reason (optional) — e.g. no payment received"
                      className="w-full rounded-md border border-ink/15 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-danger-400 focus:outline-none focus:ring-1 focus:ring-danger-400 sm:w-64"
                    />
                    <SubmitButton
                      className="inline-flex min-h-[36px] items-center justify-center rounded-md border border-danger-300 bg-danger-50 px-3 py-1.5 text-xs font-medium text-danger-700 transition-colors hover:bg-danger-100"
                      pendingLabel="Sending…"
                    >
                      Didn&rsquo;t receive this payment
                    </SubmitButton>
                  </form>
                </details>
              </div>
            </div>
          )}
        </Card>
      ) : null}

      {/* Completion handshake (booked). Rendered inline on flag OFF; on flag ON
          the relationship shell surfaces it as its own Details-tab node instead
          (hideCompletion), so it isn't shown twice. */}
      {isBooked && !hideCompletion ? (
        <VendorCompletionCard
          eventId={eventId}
          isCompleteConfirmed={isCompleteConfirmed}
          isDisputed={isDisputed}
          isVendorMarked={isVendorMarked}
          notice={typeof search.completed === 'string' ? search.completed : null}
        />
      ) : null}

      {/* Cocktail area (booked, eligible). */}
      {canEditCocktail ? (
        <div className="rounded-2xl border border-terracotta/25 bg-terracotta/[0.04] p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink/70">
            <Martini aria-hidden className="h-4 w-4 text-terracotta" /> Cocktail area
          </h2>
          <p className="mt-2 text-sm text-ink/65">
            The couple opened up their cocktail / waiting area for you to arrange — place and move
            booths (and the room itself, if you&rsquo;re the stylist) right on their blueprint.
          </p>
          <Link
            href={`/vendor-dashboard/clients/${eventId}/cocktail`}
            className="mt-3 inline-block text-sm font-medium text-mulberry underline"
          >
            Arrange the cocktail area
          </Link>
        </div>
      ) : null}

      {/* Booth poster (booked). Deliberately NOT gated on canEditCocktail: the
          poster belongs to the vendor's presence at the event, not to the
          cocktail room, so a vendor whose booth sits in the reception must be
          able to dress it — matching vendor_set_booth_poster's wider gate. */}
      {isBooked ? (
        <BoothPosterCard
          eventId={eventId}
          vendorProfileId={vendorProfileId}
          initialRef={posterRef}
          initialDisplayUrl={posterDisplayUrl}
        />
      ) : null}

      {/* Booth Studio — the words on the booth, drawn in the couple's palette.
          Same reach as the poster (any BOOKED vendor, the RPC's own gate) and
          dark behind the same flag the 3D renderer reads. */}
      {isBooked && boothStudioEnabled() ? (
        <BoothStudioCard eventId={eventId} initial={boothStudioContent} />
      ) : null}

      {/* Papic Games — custom Photo Challenge authoring (booked-only). Self-gates
          on the flag + the vendor's Pro tier; renders nothing when off. */}
      {isBooked ? (
        <VendorChallengeSection eventId={eventId} vendorProfileId={vendorProfileId} />
      ) : null}

      {/* Your booth in THEIR 3D Plan (booked-only). The "unlock the 3D Plan for
          this couple" section that stood here is RETIRED (owner 2026-09-05): the
          room is free for couples. What a vendor buys for it is BRANDING — ₱500
          for this one celebration here, or the ₱3,000 / 4-week cycle for every
          client on the subscription page. Self-gates on the 3D kill-switch. */}
      {isBooked ? (
        <BoothEventSection eventId={eventId} vendorProfileId={vendorProfileId} />
      ) : null}
    </div>
  );
}

// ===========================================================================
// QUOTE & PAYMENTS TAB
// ===========================================================================
function QuoteTab(props: {
  eventId: string;
  proposals: ProposalRow[];
  isBooked: boolean;
  planStepRows: Awaited<ReturnType<typeof fetchPlanProgressForVendor>>[number] | null;
  pendingPayments: Awaited<ReturnType<typeof fetchPendingVendorPayments>>;
  /** No-plan booking: the logged payments and the balance (AREA-VENDOR). */
  ledgerMoney: BookingMoney;
  /** The no-plan ledger read failed or was cut short — say so, never "none". */
  ledgerUnreadable: boolean;
  threadId: string | null;
  /**
   * "Ask for a payment" — passed in rather than built here so this component
   * stays a pure renderer and the panel has exactly ONE call site. Null when
   * the shop is not booked, which is also when the insert policy would refuse.
   */
  askPanel: React.ReactNode;
  /** Drawn under the money fold — the flag-off card's reservation-policy line. */
  afterMoney?: React.ReactNode;
}) {
  const {
    eventId,
    proposals,
    isBooked,
    planStepRows,
    pendingPayments,
    ledgerMoney,
    ledgerUnreadable,
    threadId,
    askPanel,
    afterMoney,
  } = props;
  const steps = planStepRows?.steps ?? null;

  return (
    <div className="space-y-6">
      {/* Quotation */}
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          Quotation
        </p>
        {proposals.length === 0 ? (
          <p className="flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm text-ink/55">
            <FileText aria-hidden className="h-4 w-4 shrink-0 text-ink/40" /> No quotes sent yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {proposals.map((p) => (
              <li
                key={p.proposal_id}
                className="flex items-center gap-3 rounded-xl border border-ink/10 border-l-[3px] border-l-terracotta bg-white px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{formatCentavos(p.total_centavos)}</p>
                  <p className="truncate text-xs text-ink/55">
                    {p.title ? `${p.title} · ` : ''}
                    {p.sent_at ? `Sent ${fmtShortDate(p.sent_at)}` : `Created ${fmtShortDate(p.created_at)}`}
                    {p.valid_until ? ` · valid until ${fmtShortDate(p.valid_until)}` : ''}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${PROPOSAL_STATUS_TONE[p.status]}`}
                >
                  {PROPOSAL_STATUS_LABEL[p.status]}
                </span>
                <Link
                  href={`/proposals/${p.public_id}`}
                  className="shrink-0 text-xs font-medium text-mulberry hover:underline"
                >
                  View →
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link
          // The quote is BUILT in the conversation (#5586's tray) — this opens
          // that tool, with the proposals list only when there is no thread.
          href={
            threadId
              ? `/vendor-dashboard/messages/${threadId}#build-quote`
              : customerLandingHref('proposals')
          }
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs font-semibold text-ink/70 hover:border-terracotta/40"
        >
          <FileText aria-hidden className="h-3.5 w-3.5" /> New quote
        </Link>
      </div>

      {/* Payments */}
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          Payments
        </p>
        {!isBooked ? (
          <p className="flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm text-ink/55">
            <Wallet aria-hidden className="h-4 w-4 shrink-0 text-ink/40" /> A payment schedule
            appears once they book you and pay a first payment.
          </p>
        ) : (
          <>
            {/* Suppliers Pair 3 (2026-10-13): the Money fold — Paid · Due, the
                instalments as kind 26 rows, and each payment the couple logged
                answered HERE (Confirm received · Not received), not in chat. */}
            <CustomerMoneyFold
              eventId={eventId}
              steps={steps}
              clearedAt={planStepRows?.clearedAt ?? null}
              pending={pendingPayments}
              ledgerMoney={ledgerMoney}
              ledgerUnreadable={ledgerUnreadable}
              threadId={threadId}
              unreadableNote={<LedgerUnreadableNote />}
            />
            {/* The reservation-policy line lives on the Payment page now (`_pages/payment.tsx`, spec §9 #2); the
                flag-off card, which has no Payment page, passes the same component in here. */}
            {afterMoney}
          </>
        )}
      </div>

      {/* Ask for a payment — directly under the balance it is about. */}
      {askPanel}
    </div>
  );
}

// ===========================================================================
// SCHEDULE TAB — the entire existing timeline block + seat-plan behavior.
// ===========================================================================
function ScheduleTab(props: {
  eventId: string;
  /**
   * PR-H · TRUE at every stage that is NOT 'booked' — an accepted inquiry AND an
   * outstanding lock request. Named for what it MEANS (nothing has been agreed)
   * rather than for one of the two stages that produce it, because the previous
   * name (`isInquiry`) is exactly what would have let a third stage slip through
   * into the booked render.
   */
  preAgreement: boolean;
  brief: Brief;
  allBlocks: LiveBlock[];
  runOfShowBlocks: RunOfShowBlock[];
  /**
   * The booked COORDINATOR, and nobody else on the supplier side. Was a
   * hardcoded `canAdvance` literal until the database stopped admitting every
   * booked vendor (migration 20271227867922) — at which point a button every
   * supplier could see became a button most of them would be refused.
   */
  canAdvance: boolean;
  callTime: ReturnType<typeof deriveCallTime>;
  callTimeAlreadyRequested: boolean;
  /** 🤝 The supplier's part of the schedule (Step 4b) — their Schedule view's data, read once by the page. */
  supplierPart: Omit<ComponentProps<typeof SupplierSchedule>, 'eventId' | 'lab'>;
  handovers: HandoverRow[];
  /** false = the handover read was refused, so "none delivered" is not a fact. */
  handoversMeasured: boolean;
  eventVendorId: string | null;
  changeOrders: VendorChangeOrderRow[];
  /** false = the change-order read was refused, so "none raised" is not a fact. */
  changeOrdersMeasured: boolean;
  search: { suggest?: string; handover?: string; change_order?: string; change_order_resp?: string };
  /** Appointments, drawn right after the supplier's part (v113 Schedule order); null before booking. */
  appointments?: React.ReactNode;
}) {
  const {
    eventId,
    preAgreement,
    allBlocks,
    runOfShowBlocks,
    canAdvance,
    callTime,
    callTimeAlreadyRequested,
    supplierPart,
    handovers,
    handoversMeasured,
    eventVendorId,
    changeOrders,
    changeOrdersMeasured,
    search,
  } = props;

  // PRE-AGREEMENT (an inquiry, a shortlist row, or an outstanding ask). The
  // run-of-show itself is theirs from first contact (owner, 2026-09-20 —
  // 20271235469220), read-only off the brief. The TOOLS — call-time
  // proposals, handovers, change requests — still open on a booking.
  if (preAgreement) {
    const timeline = props.brief.timeline ?? [];
    return (
      <div className="space-y-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">Day-of timeline</p>
        {timeline.length > 0 ? (
          <ShopCard>
            <ul className="space-y-2">
              {timeline.map((b, i) => (
                <li key={`${b.start_at ?? 'tbd'}-${i}`} className="flex items-start justify-between gap-3 text-sm">
                  <span className="font-medium">{b.label}</span>
                  <span className="text-right text-ink/60">
                    {fmtTime(b.start_at) ?? 'Time to be set'}
                    {b.location ? ` · ${b.location}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </ShopCard>
        ) : (
          <p className="text-sm text-ink/55">The couple hasn&rsquo;t built their run-of-show yet.</p>
        )}
        <p className="text-sm text-ink/55">
          Proposing a call time, handovers and change requests open once this couple books you.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ShopCard>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink/70">
            <CalendarDays aria-hidden className="h-4 w-4 text-terracotta" /> Day-of timeline
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            {allBlocks.length > 0 ? (
              <SaveFileLink
                href={`/vendor-dashboard/clients/${eventId}/calendar.ics`}
                filename={`schedule-${eventId}.ics`}
                className="inline-flex items-center gap-1 text-sm font-medium text-mulberry underline"
              >
                <CalendarPlus aria-hidden className="h-4 w-4" /> Add to calendar
              </SaveFileLink>
            ) : null}
          </div>
        </div>

        {runOfShowBlocks.length > 0 ? (
          <div className="mt-3">
            <RunOfShowHeader
              eventId={eventId}
              initial={runOfShowBlocks}
              canAdvance={canAdvance}
              compact
              // RW-87: before the event's day the Now box says when it starts, never "Not started yet".
              startsOnWords={
                props.brief.event.event_date && props.brief.event.event_date.slice(0, 10) > manilaToday()
                  ? weekdayDateWithYear(props.brief.event.event_date)
                  : null
              }
            />
          </div>
        ) : null}

        {callTime && !callTimeAlreadyRequested ? (
          <div className="mt-3 rounded-xl border border-terracotta/30 bg-terracotta/5 px-3 py-2.5">
            <p className="text-sm">
              <span className="font-semibold">Suggested call time · {fmtTime(callTime.call_time)}</span>{' '}
              <span className="text-ink/65">
                — {callTime.lead_minutes / 60} hr setup before {callTime.anchor_label} (
                {fmtTime(callTime.anchor_start_at)}). A rule-of-thumb, not a booking — confirm with
                your couple.
              </span>
            </p>
            {/* The one door also answers the Schedule view's sheets in words (`quiet=1`); this form never sends that, so it
                redirects as before — the cast says only that. */}
            <form action={suggestScheduleChange as (fd: FormData) => Promise<void>} className="mt-2">
              <input type="hidden" name="event_id" value={eventId} />
              <input
                type="hidden"
                name="proposed_label"
                value={`${displayServiceLabel(callTime.category)} setup / call time`}
              />
              <input type="hidden" name="proposed_start_at" value={callTime.call_time} />
              <input type="hidden" name="proposed_end_at" value={callTime.anchor_start_at} />
              <input
                type="hidden"
                name="note"
                value={`Suggested call time ${fmtTime(callTime.call_time)} — ${
                  callTime.lead_minutes / 60
                } hr setup ahead of ${callTime.anchor_label}.`}
              />
              <SubmitButton
                pendingLabel="Requesting…"
                className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-cream"
              >
                Request this call time
              </SubmitButton>
            </form>
          </div>
        ) : null}

        {search.suggest === 'sent' ? (
          <p role="status" className="mt-3 rounded-lg bg-success-50 px-3 py-2 text-xs text-success-900">
            Request sent — the couple (or their coordinator) will review it.
          </p>
        ) : null}
        {search.suggest === 'error' ? (
          <p role="alert" className="mt-3 rounded-lg bg-warn-50 px-3 py-2 text-xs text-warn-900">
            That didn&rsquo;t send — try again.
          </p>
        ) : null}
        {search.suggest === 'notyours' ? (
          <p role="alert" className="mt-3 rounded-lg bg-warn-50 px-3 py-2 text-xs text-warn-900">
            That moment isn&rsquo;t yours, so you can only suggest a change to it, not change or
            remove it.
          </p>
        ) : null}

        {/*
          🤝 THE SUPPLIER'S PART OF THE SCHEDULE (owner 2026-11-01, "SUPPLIERS GIVE THEIR PART FROM THEIR SCHEDULE
          VIEW"). The 3 Oct forms that sat here under every moment — Change or remove · Suggest a change · Suggest a new
          timeline entry · Your requests — MOVED into the one view: their chapters, their moments (theirs open, the
          rest greyed), + My moment · My times · Suggest in the thumb row, Waiting for the host · Take back, Seen and
          Confirm my times. Not a second copy: the forms are gone from here.
        */}
        <div className="mt-4">
          <SupplierSchedule eventId={eventId} {...supplierPart} />
        </div>

        {props.appointments ?? null}

        {/* Delivery handover (Wave 4). */}
        <div className="mt-5 border-t border-ink/10 pt-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <PackageCheck aria-hidden className="h-4 w-4 text-terracotta" /> Deliver the handover
          </h3>
          <p className="mt-1 text-xs text-ink/55">
            Send the couple their finished work — an album link, a sample/proof image, or a closing
            note. They confirm receipt, which marks your booking delivered.
          </p>

          {search.handover === 'sent' ? (
            <p role="status" className="mt-3 rounded-lg bg-success-50 px-3 py-2 text-xs text-success-900">
              Handover sent — the couple will confirm receipt.
            </p>
          ) : null}
          {search.handover && search.handover !== 'sent' ? (
            <p role="alert" className="mt-3 rounded-lg bg-warn-50 px-3 py-2 text-xs text-warn-900">
              {search.handover === 'badurl'
                ? 'That album link needs to start with http(s)://.'
                : search.handover === 'nofile'
                  ? 'Choose an image to upload.'
                  : search.handover === 'empty'
                    ? 'Add a note before sending.'
                    : search.handover === 'upload'
                      ? 'That image couldn’t upload — try a PNG/JPEG under 6 MB.'
                      : 'That didn’t send — try again.'}
            </p>
          ) : null}

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <details className="rounded-xl border border-ink/10 bg-white/50 p-3">
              <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-medium">
                <Link2 aria-hidden className="h-3.5 w-3.5 text-ink/55" /> Share an album link
              </summary>
              <StayForm door="supClients.vendorPostHandover" action={vendorPostHandover} sayNote className="mt-2 grid gap-2">
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="kind" value="gallery_link" />
                <input type="text" name="label" maxLength={200} placeholder="e.g. Full wedding album" className={shopInputClass} />
                <input type="url" name="payload" required placeholder="https://…" className={shopInputClass} />
                <p className="text-[11px] text-ink/45">Big albums stay on your link (Drive, Pixieset, etc.) — we don’t re-host them.</p>
                <SubmitButton pendingLabel="Sending…" className="justify-self-start rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-cream">
                  Send link
                </SubmitButton>
              </StayForm>
            </details>

            <details className="rounded-xl border border-ink/10 bg-white/50 p-3">
              <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-medium">
                <FileText aria-hidden className="h-3.5 w-3.5 text-ink/55" /> Upload a sample/proof
              </summary>
              <StayForm door="supClients.vendorPostHandover" action={vendorPostHandover} sayNote className="mt-2 grid gap-2">
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="kind" value="file" />
                <input type="text" name="label" maxLength={200} placeholder="e.g. Edited preview" className={shopInputClass} />
                <input type="file" name="file" accept="image/png,image/jpeg,image/webp,image/gif,image/heic" required className="text-xs" />
                <p className="text-[11px] text-ink/45">A single image, max 6 MB. For full sets, share an album link instead.</p>
                <SubmitButton pendingLabel="Uploading…" className="justify-self-start rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-cream">
                  Upload
                </SubmitButton>
              </StayForm>
            </details>

            <details className="rounded-xl border border-ink/10 bg-white/50 p-3">
              <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-medium">
                <MessageSquarePlus aria-hidden className="h-3.5 w-3.5 text-ink/55" /> Leave a note
              </summary>
              <StayForm door="supClients.vendorPostHandover" action={vendorPostHandover} sayNote className="mt-2 grid gap-2">
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="kind" value="note" />
                <input type="text" name="label" maxLength={200} placeholder="Subject (optional)" className={shopInputClass} />
                <textarea name="payload" required maxLength={4000} rows={2} placeholder="e.g. Drive folder shared to your email — download within 30 days." className={shopInputClass} />
                <SubmitButton pendingLabel="Sending…" className="justify-self-start rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-cream">
                  Send note
                </SubmitButton>
              </StayForm>
            </details>

            <details className="rounded-xl border border-ink/10 bg-white/50 p-3">
              <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-medium">
                <PackageCheck aria-hidden className="h-3.5 w-3.5 text-ink/55" /> All delivered (sign-off)
              </summary>
              <StayForm door="supClients.vendorPostHandover" action={vendorPostHandover} sayNote className="mt-2 grid gap-2">
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="kind" value="signoff" />
                <textarea name="payload" maxLength={4000} rows={2} placeholder="Closing note (optional) — e.g. Everything’s been delivered. Thank you!" className={shopInputClass} />
                <SubmitButton pendingLabel="Sending…" className="justify-self-start rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-cream">
                  Mark all delivered
                </SubmitButton>
              </StayForm>
            </details>
          </div>

          {!handoversMeasured ? (
            <p role="alert" className="mt-4 text-xs text-ink/70">
              <strong className="text-ink">We couldn&rsquo;t load your handovers.</strong>{' '}
              Anything you have already delivered is still delivered — it just
              is not listed here right now.
            </p>
          ) : null}

          {handovers.length > 0 ? (
            <div className="mt-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">Your handovers</p>
              <ul className="mt-1.5 space-y-1.5">
                {handovers.map((h) => (
                  <li key={h.handover_id} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${
                        h.status === 'acknowledged'
                          ? 'bg-success-100 text-success-900'
                          : h.status === 'disputed'
                            ? 'bg-warn-100 text-warn-900'
                            : 'bg-ink/5 text-ink/60'
                      }`}
                    >
                      {h.status === 'acknowledged' ? 'received' : h.status}
                    </span>
                    <span className="text-ink/70">
                      {HANDOVER_KIND_LABEL[h.kind]}
                      {h.label ? ` — ${h.label}` : ''}
                    </span>
                    {h.kind === 'gallery_link' && h.payload ? (
                      <a href={h.payload} target="_blank" rel="noreferrer" className="text-mulberry underline">
                        open link
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </ShopCard>

      {/* Change-Order Trail (Wave 3). */}
      {eventVendorId ? (
        <ShopCard>
          <div className="mb-3 flex items-center gap-2">
            <FilePlus2 aria-hidden className="h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
            <h2 className="text-sm font-semibold text-ink">Change orders</h2>
          </div>

          {search.change_order === 'sent' || search.change_order_resp === 'ok' ? (
            <p className="mb-3 rounded-lg bg-success-50 px-3 py-2 text-xs text-success-700">
              Done — the couple has been notified.
            </p>
          ) : null}
          {search.change_order === 'error' || search.change_order_resp === 'error' ? (
            <p role="alert" className="mb-3 rounded-lg bg-warn-50 px-3 py-2 text-xs text-warn-900">
              That didn&rsquo;t go through — try again.
            </p>
          ) : null}

          <p className="mb-3 text-sm text-ink/65">
            Added or dropped something after booking? Log a change order — the couple accepts or
            declines, and an accepted change updates their budget. Setnayan never holds the money.
          </p>

          <details className="mb-4 sn-row p-3">
            <summary className="cursor-pointer text-sm font-medium text-terracotta-700">
              Propose a change
            </summary>
            <StayForm door="supClients.vendorRaiseChangeOrder" action={vendorRaiseChangeOrder} className="mt-3 space-y-3">
              <input type="hidden" name="event_id" value={eventId} />
              <div className="flex flex-wrap items-center gap-4 text-xs text-ink/70">
                <label className="inline-flex items-center gap-1.5">
                  <input type="radio" name="change_kind" value="add-on" defaultChecked />
                  Add-on (adds cost)
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input type="radio" name="change_kind" value="removal" />
                  Removal (credit back)
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-ink/70">
                  What&rsquo;s changing
                  <input
                    type="text"
                    name="title"
                    required
                    maxLength={120}
                    placeholder="e.g. Extra hour of coverage"
                    className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
                  />
                </label>
                <label className="block text-xs font-medium text-ink/70">
                  Amount (₱)
                  <input
                    type="number"
                    name="amount_php"
                    min="1"
                    step="0.01"
                    required
                    inputMode="decimal"
                    placeholder="e.g. 5000"
                    className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
                  />
                </label>
              </div>
              <label className="block text-xs font-medium text-ink/70">
                Due date <span className="text-ink/40">(optional)</span>
                <input
                  type="date"
                  name="proposed_due_date"
                  className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta sm:w-56"
                />
              </label>
              <label className="block text-xs font-medium text-ink/70">
                Details <span className="text-ink/40">(optional)</span>
                <textarea
                  name="description"
                  rows={2}
                  maxLength={2000}
                  placeholder="Anything the couple should know"
                  className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
                />
              </label>
              <SubmitButton className="button-primary" pendingLabel="Sending…">
                Send to couple
              </SubmitButton>
            </StayForm>
          </details>

          {!changeOrdersMeasured ? (
            <p role="alert" className="text-xs text-ink/70">
              <strong className="text-ink">We couldn&rsquo;t load change orders.</strong>{' '}
              If the couple has raised one, it is not shown here — reload before
              treating this as settled.
            </p>
          ) : changeOrders.length === 0 ? (
            <p className="text-xs italic text-ink/45">No change orders yet.</p>
          ) : (
            <ul className="space-y-2">
              {changeOrders.map((co) => {
                const chip = CO_STATUS[co.status];
                const isCoupleRaised = co.raised_by === 'couple';
                const isProposed = co.status === 'proposed';
                const deltaNum =
                  typeof co.delta_amount_php === 'string'
                    ? Number(co.delta_amount_php)
                    : co.delta_amount_php ?? 0;
                return (
                  <li key={co.change_order_id} className="rounded-xl border border-ink/10 bg-white px-3 py-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-ink">
                          {co.title ?? 'Change order'}
                          <span className="font-normal text-ink/40">·</span>
                          <span className={`font-mono ${deltaNum < 0 ? 'text-success-700' : 'text-ink/75'}`}>
                            {fmtDelta(co.delta_amount_php)}
                          </span>
                        </p>
                        <p className="text-[11px] text-ink/50">
                          {isCoupleRaised ? 'Couple proposed' : 'You proposed'} · {fmtCODate(co.created_at)}
                          {co.proposed_due_date ? ` · due ${fmtCODate(co.proposed_due_date)}` : ''}
                        </p>
                        {co.description ? <p className="mt-1 text-xs text-ink/60">{co.description}</p> : null}
                        {co.status === 'declined' && co.decline_reason ? (
                          <p className="mt-1 text-xs text-ink/55">Reason: {co.decline_reason}</p>
                        ) : null}
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${chip.cls}`}
                      >
                        {chip.label}
                      </span>
                    </div>

                    {isProposed && isCoupleRaised ? (
                      <div className="mt-2 flex items-center gap-2">
                        <StayForm door="supClients.vendorRespondChangeOrder" action={vendorRespondChangeOrder}>
                          <input type="hidden" name="event_id" value={eventId} />
                          <input type="hidden" name="change_order_id" value={co.change_order_id} />
                          <input type="hidden" name="decision" value="accept" />
                          <SubmitButton className="button-primary text-[11px]" pendingLabel="Accepting…">
                            Accept
                          </SubmitButton>
                        </StayForm>
                        <StayForm door="supClients.vendorRespondChangeOrder" action={vendorRespondChangeOrder}>
                          <input type="hidden" name="event_id" value={eventId} />
                          <input type="hidden" name="change_order_id" value={co.change_order_id} />
                          <input type="hidden" name="decision" value="decline" />
                          <SubmitButton
                            className="rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-[11px] font-medium text-ink/70 hover:bg-cream"
                            pendingLabel="Declining…"
                          >
                            Decline
                          </SubmitButton>
                        </StayForm>
                      </div>
                    ) : null}

                    {isProposed && !isCoupleRaised ? (
                      <StayForm door="supClients.vendorWithdrawChangeOrder" action={vendorWithdrawChangeOrder} className="mt-2">
                        <input type="hidden" name="event_id" value={eventId} />
                        <input type="hidden" name="change_order_id" value={co.change_order_id} />
                        <SubmitButton
                          className="rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-[11px] font-medium text-ink/70 hover:bg-cream"
                          pendingLabel="Withdrawing…"
                        >
                          Withdraw
                        </SubmitButton>
                      </StayForm>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </ShopCard>
      ) : null}
    </div>
  );
}

/** The booking's payments could not be read — said plainly, never as "none". */
function LedgerUnreadableNote() {
  return (
    <p
      role="status"
      className="flex items-center gap-2 rounded-lg border border-warn-300/50 bg-warn-50 px-3 py-2.5 text-sm text-warn-900"
    >
      <Wallet aria-hidden className="h-4 w-4 shrink-0" /> Some payments on this booking
      couldn&rsquo;t load. Reload the page to try again.
    </p>
  );
}
