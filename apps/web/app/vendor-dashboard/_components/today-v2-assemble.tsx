import type { ReactNode } from 'react';
import { BookingFeeBills } from '@/app/_components/booking-fee-notice';
import { nextHref } from './supplier-today-first-screen';
import { TodayGrow, TodayNextBadge, TodayRecommended, TodayTrending, TodayV2Needs, TodayV2Sub } from './today-v2';
import {
  doneTodayRows,
  doneTodayTotal,
  growStage,
  nextBadgeWords,
  roomToGrowRows,
  billsSlot,
  billsUrgency,
  splitTodayNeeds,
  todayProgress,
  trendingLines,
  type TodayBadgeTag,
} from '@/lib/supplier-today-v2';
import { asideKeys, gotItToday, type TodayAside } from '@/lib/today-aside';
import { activePutOffs } from '@/lib/today-put-off';
import { INSPIRATION_LIBRARY_HREF, INSPIRATION_LIBRARY_ROW } from '@/lib/inspiration-library-entry';
import { shelfBadge } from '@/lib/shop-badge-shelf';
import type { BadgeRewardFacts } from '@/lib/badge-rewards';
import type { FeeDisclosure } from '@/lib/booking-fee-disclosure';
import type { PayoutReadiness } from '@/lib/deposit-pay-step';
import type { TodayRowIcon } from '@/lib/supplier-today';
import type { SupplierTodayView } from '@/lib/supplier-today-view';
import type { TodayV2Reads } from '@/lib/supplier-today-v2.server';
import type { WhatsNewCard } from '@/lib/vendor-overview';
import type { WrapUpFacts } from '@/lib/today-wrap-up';

/**
 * 📋 TODAY v2, ASSEMBLED — ONE builder, so the Today page (its reads) and the dev lab (`/dev/supplier-lab?easy=…`, its
 * fixtures) can never draw two different Todays (the same rule `assembleSupplierToday` keeps for the shipped view).
 *
 * The shipped `view.needs`, split: quick rows answered on the row · rows that open ONE focused screen · the shop's own
 * gaps (recommended, never counted) — plus Done today, the Next badge card, the grow stage and What's trending. The
 * count the cover and the pinned heading show is the REAL to-dos only (pick 2); an unread desk shows none (null).
 * 🔒 app/vendor-dashboard/_components/today-is-one-task.test.ts · lib/supplier-today-v2.test.ts
 */
export type TodayV2Input = {
  view: SupplierTodayView;
  needsAnswer: readonly WhatsNewCard[];
  closed: readonly WhatsNewCard[];
  deskIncomplete: boolean;
  reads: TodayV2Reads | null;
  aside: TodayAside;
  feeForecasts: Record<string, FeeDisclosure | null>;
  payoutReadiness: PayoutReadiness;
  setupDrawn: boolean;
  verified: boolean;
  findable: boolean;
  findableHref: string | null;
  views: number | null;
  inquiries28: number | null;
  bookedThisMonth: number | null;
  todayIso: string;
  /**
   * 💸 The booking-fee bills could NOT be read (`FEE_BILLS_UNREADABLE`). A supplier may owe a fee we cannot see, so
   * Today is never "done" and says the fees could not be loaded — never an empty list that reads as "nothing owed".
   */
  billsUnread: boolean;
  /** v3: the clock the deadlines are read against (a date change's `dueAt`) — the page's render clock. */
  now: number;
  /** ✓ v3 part 3 — the finished events' wrap-up facts (`readWrapUpFacts`), keyed by desk card id. */
  wrapUps?: Record<string, WrapUpFacts | null>;
  /** 🌱🖼 The shop's trades supply a part (`moodboardLibraryAccessForProfile`) — the library row is a task. */
  library: boolean;
};

const REC_BUTTON: Readonly<Record<string, string>> = {
  renewal: 'Upload',
  'door-payout': 'Add',
  'door-findable': 'Ask us',
  'door-credit': 'Use it',
  'door-gift': 'See plan',
  'door-setup': 'Continue',
};

export function buildTodayV2(i: TodayV2Input): {
  view: SupplierTodayView;
  v2: { sub: ReactNode; nextBadge: ReactNode; needsRows: ReactNode; grow: ReactNode };
} {
  const r = i.reads;
  const deskCards = [...i.needsAnswer, ...i.closed];
  const tile = r && r.completedBookings !== null ? shelfBadge('completed_bookings', { counts: { completedBookings: r.completedBookings } as BadgeRewardFacts, verified: null, granted: null }) : null;
  const nextBadge = nextBadgeWords(tile?.nextShort ?? null);
  const split = splitTodayNeeds({ needs: i.view.needs, cards: deskCards, completedToGo: nextBadge?.toGo ?? null, aside: asideKeys(i.aside), now: i.now, putOff: activePutOffs(r?.putOffs ?? null, i.todayIso), soonAskHours: r?.cutoffs.soonAskHours ?? null });
  const deskKeys = deskCards.map((c) => c.id);
  const gotIt = gotItToday(i.aside, new Set(deskKeys));
  const doneCount = doneTodayTotal(r?.done ?? null, gotIt);
  const left = i.deskIncomplete ? null : split.quick.length + split.screen.length + i.view.bills.length;
  const progress = todayProgress(left, doneCount, { billsUnread: i.billsUnread });
  const stage = growStage({
    setupDrawn: i.setupDrawn,
    verified: i.verified,
    findable: i.findable,
    findableHref: i.findableHref,
    noCover: r?.noCover ?? null,
    // The cards were not read (or no Today v2 read came back at all): stage 2 cannot be judged.
    coversUnread: r ? r.coversUnread : true,
    views: i.views,
    inquiries28: i.inquiries28,
    bookedThisMonth: i.bookedThisMonth,
    cutoffs: r?.cutoffs ?? { fewInquiries: null, fewBookings: null },
    hasQuoteDraft: i.needsAnswer.some((c) => c.kind === 'quote_draft'),
    payoutNone: i.payoutReadiness === 'none',
    hasMarkComplete: i.needsAnswer.some((c) => c.kind === 'mark_complete'),
    permitDue: i.view.needs.some((n) => n.key === 'renewal'),
    completedToGo: nextBadge?.toGo ?? null,
  });
  // A gap the grow stage already shows as a move is not said twice.
  const inStage = new Set(stage?.moves.map((m) => m.key) ?? []);
  const recommended: Array<{ key: string; label: string; line: string; icon: TodayRowIcon; tag: TodayBadgeTag | null; href: string; button: string; notNow: boolean }> = [
    ...split.recommended
      .filter((n) => !(n.key === 'door-findable' && inStage.has('g-find')))
      .map((n) => ({ key: n.key, label: n.label, line: n.line, icon: n.icon, tag: n.tag, href: nextHref(n.target), button: REC_BUTTON[n.key] ?? 'Open', notNow: n.key === 'door-credit' || n.key === 'door-gift' })),
    ...(r?.noCover && i.verified && !inStage.has('g-cover')
      ? [{ key: `cover-${r.noCover.serviceId}`, label: `${r.noCover.title} has no cover photo`, line: 'Couples see your initials, not a photo', icon: 'image' as const, tag: { word: 'Your page', page: true }, href: `/vendor-dashboard/services/${r.noCover.serviceId}`, button: 'Add photo', notNow: false }]
      : []),
    // 🌱🖼 + ▦ The shop's own room to grow (owner 18 Nov: "tasks on inspiration library … deplete their cards"),
    // each set aside for the day with "Not now" like the other gaps.
    ...roomToGrowRows({
      library: { open: i.library, photos: r?.inspirationPhotos ?? null, href: INSPIRATION_LIBRARY_HREF, label: INSPIRATION_LIBRARY_ROW.label },
      cards: { allowed: r?.cardRoom?.allowed ?? null, live: r?.cardRoom?.live ?? null, hidden: r?.cardRoom?.hidden ?? null },
    })
      .filter((g) => !asideKeys(i.aside).has(g.key))
      .map((g) => ({ ...g, tag: { word: 'Your page', page: true }, notNow: true })),
  ];
  return {
    view: { ...i.view, needsCount: left },
    v2: {
      sub: <TodayV2Sub tasks={progress.tasks} progress={progress.progress} allDone={progress.allDone} left={left} pips={progress.pips} />,
      nextBadge: nextBadge ? (
        <TodayNextBadge tile={{ src: tile?.src ?? null, title: nextBadge.title, toGo: nextBadge.toGo, locked: tile?.state === 'locked', how: tile?.how ?? '' }} />
      ) : null,
      needsRows: (
        <TodayV2Needs
          split={split}
          answers={{ payoutReadiness: i.payoutReadiness, feeForecasts: i.feeForecasts, wrapUps: i.wrapUps ?? {} }}
          todayIso={i.todayIso}
          onDesk={deskKeys}
          billCount={i.view.bills.length}
          billsUnread={i.billsUnread}
          billsLevel={billsSlot(billsUrgency(i.view.bills, i.todayIso))}
          doneUnread={doneCount === null}
          bills={<BookingFeeBills today bills={i.view.bills} copyFor={i.view.billCopy} />}
          done={doneTodayRows(r?.done ?? null, gotIt)}
          allDone={progress.allDone}
        />
      ),
      grow: (
        <>
          <TodayGrow stage={stage} />
          <TodayRecommended rows={recommended} todayIso={i.todayIso} onDesk={deskKeys} />
          <TodayTrending lines={trendingLines(r?.radar ?? null, r?.trendingCard ?? null)} />
        </>
      ),
    },
  };
}
