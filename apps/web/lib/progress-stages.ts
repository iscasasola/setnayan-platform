/**
 * progress-stages.ts — pure journey-stage builder for the couple's
 * Decisions & Progress page (/dashboard/[eventId]/progress).
 *
 * Turns already-loaded event data (event fields, guest stats, vendor lock
 * counts, seat assignments, paperwork summary, order counts) into the six
 * planning stages the journey rail renders:
 *
 *   Dreaming → Booking → Inviting → Finalizing → Wedding day → After
 *
 * Each stage carries a completion percentage plus Done / Still-to-do item
 * lists derived from real data — no fixtures, no I/O, no clock reads beyond
 * the caller-supplied `daysOut`. The current-stage resolution mirrors the
 * Overview's `currentStage` logic exactly so the two surfaces never disagree
 * about where the couple is.
 *
 * Deterministic + unit-testable — see progress-stages.test.ts.
 */

export type ProgressStageKey =
  | 'dreaming'
  | 'booking'
  | 'inviting'
  | 'finalizing'
  | 'wedding'
  | 'after';

export type ProgressStageItem = {
  /** Short human line ("Wedding date chosen"). */
  label: string;
  /** Optional data annotation ("Dec 12, 2026", "87 of 142"). */
  detail?: string;
};

export type ProgressStage = {
  key: ProgressStageKey;
  label: string;
  /** 0–100, clamped. */
  pct: number;
  done: ProgressStageItem[];
  todo: ProgressStageItem[];
  /** Deterministic one-liner for the AI-active panel note (no model calls). */
  aiNote: string | null;
};

export type ProgressStagesInput = {
  /** events.event_type — labels the endowed "set up" item ('wedding' etc.). */
  eventType: string | null;
  /** events.ceremony_type — onboarding sets it at creation; null tolerated. */
  ceremonyType: string | null;
  /** events.event_date (ISO date) — null when unset. */
  eventDate: string | null;
  /** events.event_date_precision — countdown math only applies at 'day'. */
  datePrecision: string;
  /** Days until the event at 'day' precision (negative = past), else null. */
  daysOut: number | null;
  venueName: string | null;
  paletteFinalizedAt: string | null;
  budgetTargetCentavos: number | null;
  guestsTotal: number;
  guestsAttending: number;
  /** Guests who answered in any direction (attending + declined + maybe). */
  guestsResponded: number;
  lockedVendorCount: number;
  totalLockableCategories: number;
  /** Seat-plan assignments recorded so far. */
  seatedGuests: number;
  /** Paperwork pipeline counts (lib/paperwork summarize()). */
  paperworkTotal: number;
  paperworkReceived: number;
  /** Orders sitting in pending_payment for this event. */
  pendingPaymentCount: number;
  /** Paid / fulfilled Setnayan service orders for this event. */
  activeServiceCount: number;
};

export type ProgressStagesResult = {
  stages: ProgressStage[];
  currentKey: ProgressStageKey;
};

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Done-count ÷ item-count percentage for item-driven stages. */
function itemPct(done: ProgressStageItem[], todo: ProgressStageItem[]): number {
  const total = done.length + todo.length;
  if (total === 0) return 0;
  return clampPct((done.length / total) * 100);
}

/**
 * Mirror of the Overview's `currentStage` resolution (page.tsx) — keep in
 * lock-step so Home and Progress agree on where the couple is.
 */
export function resolveCurrentStage(
  daysOut: number | null,
  guestCount: number,
): ProgressStageKey {
  if (daysOut === null) return 'dreaming';
  if (daysOut < 0) return 'after';
  if (daysOut === 0) return 'wedding';
  if (daysOut <= 30) return 'finalizing';
  if (guestCount > 0) return 'inviting';
  if (daysOut <= 180) return 'booking';
  return 'dreaming';
}

export const PROGRESS_STAGE_LABELS: Record<ProgressStageKey, string> = {
  dreaming: 'Dreaming',
  booking: 'Booking',
  inviting: 'Inviting',
  finalizing: 'Finalizing',
  wedding: 'Wedding day',
  after: 'After',
};

/** Build all six stages + the current-stage key from already-loaded data. */
export function buildProgressStages(
  input: ProgressStagesInput,
): ProgressStagesResult {
  const {
    eventType,
    ceremonyType,
    eventDate,
    datePrecision,
    daysOut,
    venueName,
    paletteFinalizedAt,
    budgetTargetCentavos,
    guestsTotal,
    guestsAttending,
    guestsResponded,
    lockedVendorCount,
    totalLockableCategories,
    seatedGuests,
    paperworkTotal,
    paperworkReceived,
    pendingPaymentCount,
    activeServiceCount,
  } = input;

  const dateFirm = eventDate !== null && datePrecision === 'day';
  const eventPast = daysOut !== null && daysOut < 0;
  const eventToday = daysOut === 0;

  // ---- Dreaming — the three foundation choices ---------------------------
  const dreamingDone: ProgressStageItem[] = [];
  const dreamingTodo: ProgressStageItem[] = [];
  // Endowed progress (owner 2026-07-09): a brand-new event must never render
  // an all-empty journey. These 1–2 done items are real facts event creation
  // itself establishes — the event row exists, and onboarding records the
  // ceremony type — never anything the couple didn't effectively do. Dreaming
  // pct is therefore > 0 for every event.
  const eventWord =
    eventType === null || eventType === 'wedding' ? 'wedding' : 'event';
  dreamingDone.push({ label: `Your ${eventWord} is set up` });
  if (ceremonyType !== null && ceremonyType.length > 0) {
    dreamingDone.push({
      label: 'Ceremony chosen',
      detail: ceremonyType.replace(/_/g, ' '),
    });
  }
  if (dateFirm) {
    dreamingDone.push({ label: 'Wedding date chosen' });
  } else if (eventDate !== null) {
    // Month / year precision — narrowed but not locked.
    dreamingTodo.push({ label: 'Lock your exact date', detail: 'narrowed, not final' });
  } else {
    dreamingTodo.push({ label: 'Pick your wedding date' });
  }
  if (budgetTargetCentavos !== null && budgetTargetCentavos > 0) {
    dreamingDone.push({ label: 'Budget target set' });
  } else {
    dreamingTodo.push({ label: 'Set a budget target' });
  }
  if (paletteFinalizedAt !== null) {
    dreamingDone.push({ label: 'Mood board finalized' });
  } else {
    dreamingTodo.push({ label: 'Finalize your mood board' });
  }

  // ---- Booking — venue + the vendor lock ladder --------------------------
  const bookingDone: ProgressStageItem[] = [];
  const bookingTodo: ProgressStageItem[] = [];
  const openCategories = Math.max(
    0,
    totalLockableCategories - lockedVendorCount,
  );
  if (venueName !== null && venueName.length > 0) {
    bookingDone.push({ label: 'Venue named', detail: venueName });
  } else {
    bookingTodo.push({ label: 'Name your venue' });
  }
  if (lockedVendorCount > 0) {
    bookingDone.push({
      label: 'Vendor categories booked',
      detail: `${lockedVendorCount} of ${totalLockableCategories}`,
    });
  }
  if (openCategories > 0) {
    bookingTodo.push({
      label:
        openCategories === 1
          ? 'Book your last category'
          : `Book your remaining ${openCategories} categories`,
    });
  }
  const bookingPct =
    totalLockableCategories > 0
      ? clampPct((lockedVendorCount / totalLockableCategories) * 100)
      : 0;

  // ---- Inviting — guest list + RSVPs --------------------------------------
  const invitingDone: ProgressStageItem[] = [];
  const invitingTodo: ProgressStageItem[] = [];
  if (guestsTotal > 0) {
    invitingDone.push({
      label: 'Guest list built',
      detail: `${guestsTotal} invited`,
    });
  } else {
    invitingTodo.push({ label: 'Build your guest list' });
  }
  if (guestsResponded > 0) {
    invitingDone.push({
      label: 'RSVPs coming in',
      detail: `${guestsResponded} of ${guestsTotal} answered`,
    });
  } else {
    invitingTodo.push({ label: 'Start collecting RSVPs' });
  }
  // Blend: half for having a list at all, half for the response rate.
  const invitingPct =
    guestsTotal > 0
      ? clampPct(50 + (guestsResponded / guestsTotal) * 50)
      : 0;

  // ---- Finalizing — seats, paperwork, payments ----------------------------
  const finalizingDone: ProgressStageItem[] = [];
  const finalizingTodo: ProgressStageItem[] = [];
  if (seatedGuests > 0) {
    finalizingDone.push({
      label: 'Seat plan started',
      detail: `${seatedGuests} ${seatedGuests === 1 ? 'guest' : 'guests'} placed`,
    });
  } else {
    finalizingTodo.push({ label: 'Start your seat plan' });
  }
  if (paperworkTotal > 0) {
    if (paperworkReceived >= paperworkTotal) {
      finalizingDone.push({
        label: 'Paperwork complete',
        detail: `${paperworkReceived} of ${paperworkTotal}`,
      });
    } else {
      finalizingTodo.push({
        label: 'Finish your paperwork',
        detail: `${paperworkReceived} of ${paperworkTotal} received`,
      });
    }
  } else {
    finalizingTodo.push({ label: 'Track your paperwork' });
  }
  if (pendingPaymentCount > 0) {
    finalizingTodo.push({
      label:
        pendingPaymentCount === 1
          ? 'Settle 1 pending payment'
          : `Settle ${pendingPaymentCount} pending payments`,
    });
  }

  // ---- Wedding day ---------------------------------------------------------
  const weddingDone: ProgressStageItem[] = [];
  const weddingTodo: ProgressStageItem[] = [];
  if (activeServiceCount > 0) {
    weddingDone.push({
      label: 'Setnayan services active',
      detail: `${activeServiceCount} ready for the day`,
    });
  }
  if (eventPast || eventToday) {
    weddingDone.push({ label: 'Day-of mode goes live for guests' });
  } else {
    weddingTodo.push({
      label: 'Day-of mode goes live for guests',
      detail: 'switches on by itself an hour before',
    });
  }
  const weddingPct = eventPast || eventToday ? 100 : 0;

  // ---- After ----------------------------------------------------------------
  const afterDone: ProgressStageItem[] = [];
  const afterTodo: ProgressStageItem[] = [
    { label: 'Gallery review & unlock', detail: '7-day review window' },
    { label: 'Thank your vendors' },
  ];
  const afterPct = 0;

  const stages: ProgressStage[] = [
    {
      key: 'dreaming',
      label: PROGRESS_STAGE_LABELS.dreaming,
      pct: itemPct(dreamingDone, dreamingTodo),
      done: dreamingDone,
      todo: dreamingTodo,
      aiNote:
        dreamingTodo.length === 0
          ? 'Foundations set — every choice downstream now has an anchor.'
          : `${dreamingTodo.length === 1 ? 'One foundation choice' : `${dreamingTodo.length} foundation choices`} still open — these anchor everything downstream.`,
    },
    {
      key: 'booking',
      label: PROGRESS_STAGE_LABELS.booking,
      pct: bookingPct,
      done: bookingDone,
      todo: bookingTodo,
      aiNote:
        openCategories === 0
          ? 'Every category is booked — your vendor team is complete.'
          : `${lockedVendorCount} of ${totalLockableCategories} categories locked · ${openCategories} still open.`,
    },
    {
      key: 'inviting',
      label: PROGRESS_STAGE_LABELS.inviting,
      pct: invitingPct,
      done: invitingDone,
      todo: invitingTodo,
      aiNote:
        guestsTotal > 0
          ? `${guestsAttending} attending so far — RSVPs typically take about 6 weeks to settle.`
          : 'A guest list unlocks invitations, RSVPs, and the seat plan.',
    },
    {
      key: 'finalizing',
      label: PROGRESS_STAGE_LABELS.finalizing,
      pct: itemPct(finalizingDone, finalizingTodo),
      done: finalizingDone,
      todo: finalizingTodo,
      aiNote:
        pendingPaymentCount > 0
          ? 'Pending payments block activation — settle these before the final stretch.'
          : 'The last mile is lists and confirmations — small items, big calm.',
    },
    {
      key: 'wedding',
      label: PROGRESS_STAGE_LABELS.wedding,
      pct: weddingPct,
      done: weddingDone,
      todo: weddingTodo,
      aiNote:
        'Day-of mode switches on by itself an hour before the ceremony — your only job that morning is to show up.',
    },
    {
      key: 'after',
      label: PROGRESS_STAGE_LABELS.after,
      pct: afterPct,
      done: afterDone,
      todo: afterTodo,
      aiNote:
        'Your gallery opens to guests only after your 7-day review — nothing goes public without you.',
    },
  ];

  return {
    stages,
    currentKey: resolveCurrentStage(daysOut, guestsTotal),
  };
}
