'use client';

/**
 * 🧪 STUDIO › SCHEDULE AND STUDIO › LOVE STORY ON FIXTURES (DEV-ONLY — the Maker lab,
 * `/dev/maker-lab?studio=1`). Owner 2026-10-07, DECISION_LOG "STUDIO REDRAW ANSWERS" (1):
 * *"Schedule and Love Story get their own redraw PR (lab fixtures first)"* — before this,
 * both answered "is read from the database" in the lab, so neither could be laid beside
 * the prototype.
 *
 * The REAL components on maria-and-jose's shape: `ScheduleDay` (which draws Studio's
 * timeline in the new Maker) with six moments — one of them 4c's **For ▾ Entourage** —
 * and the instant `LiveLoveStoryBook` with three moments carrying 4c's **title** and the
 * couple's own **order**. Every write is an IN-MEMORY stand-in (the same FormData the
 * real action takes, applied to the fixture); nothing reaches a database, and no server
 * action is added (+0 `"use server"` exports).
 */
import { useMemo, useState } from 'react';
import { ScheduleDay } from '@/app/dashboard/[eventId]/schedule/_components/schedule-lazy';
import type { DayActions, DayMoment } from '@/app/dashboard/[eventId]/schedule/_components/day-types';
import { DETAILS_SCHEDULE_INSPECTOR_SLOT } from '@/lib/maker-details-items';
import { fromDatetimeLocalValue } from '@/lib/schedule-datetime-local';
import { scheduleAudienceForWrite } from '@/lib/schedule-audience';
import { LiveLoveStoryBook } from '@/app/dashboard/[eventId]/website/our-story/_components/love-story-live';
import type { LoveStoryBlob } from '@/app/dashboard/[eventId]/website/our-story/_components/story-fields';
import type { HubDraftActionResult } from '@/lib/hub-draft';

const EVENT = '00000000-0000-4000-8000-000000000000';
/** maria-and-jose's date (read-only, 2026-10-05). */
export const LAB_STUDIO_DATE = '2026-12-12';

type Seed = [id: string, label: string, start: string, end: string | null, place: string | null, audience?: string];
/** The prototype's day (`S.sched`) plus a send-off — six moments, the first For ▾ Entourage. */
const DAY: Seed[] = [
  ['m-photos', 'Entourage photos', '14:00', '14:30', 'Santuario de San Antonio', 'entourage'],
  ['m-arrive', 'Guests arrive by', '14:30', '15:00', 'Santuario de San Antonio'],
  ['m-ceremony', 'Ceremony', '15:00', '16:00', null],
  ['m-cocktails', 'Cocktails', '17:30', '18:30', 'Garden'],
  ['m-dinner', 'Dinner & dancing', '19:00', '22:00', null],
  ['m-sendoff', 'Send-off', '22:00', '22:30', 'Driveway, main entrance'],
];

function seedDay(): DayMoment[] {
  return DAY.map(([id, label, start, end, place, audience]) => ({
    block_id: id,
    label,
    block_type: 'custom',
    start_at: `${LAB_STUDIO_DATE}T${start}:00.000Z`,
    end_at: end ? `${LAB_STUDIO_DATE}T${end}:00.000Z` : null,
    location: place,
    notes: null,
    is_public: true,
    parent_block_id: null,
    run_state: 'upcoming',
    staged: false,
    responsible_party: null,
    responsible_vendor_ids: [],
    audience: audience ?? null,
  }));
}

const str = (fd: FormData, k: string): string | null => {
  const v = fd.get(k);
  return typeof v === 'string' ? v : null;
};

/** Studio › Schedule on fixtures — the real `ScheduleDay`, writes applied in memory. */
export function LabStudioSchedule() {
  const [moments, setMoments] = useState<DayMoment[]>(seedDay);
  const actions = useMemo<DayActions>(() => {
    const patch = (id: string | null, p: Partial<DayMoment>) =>
      setMoments((all) => all.map((m) => (m.block_id === id ? { ...m, ...p } : m)));
    const ok = async () => ({ ok: true });
    return {
      updateScheduleBlock: async (fd) => {
        const p: Partial<DayMoment> = {};
        const label = str(fd, 'label');
        if (label !== null) p.label = label.trim();
        const location = str(fd, 'location');
        if (location !== null) p.location = location.trim() || null;
        const start = str(fd, 'start_at');
        if (start !== null) p.start_at = fromDatetimeLocalValue(start) ?? undefined;
        const end = str(fd, 'end_at');
        if (end !== null) p.end_at = end ? fromDatetimeLocalValue(end) : null;
        const audience = str(fd, 'audience');
        if (audience !== null) {
          const stored = scheduleAudienceForWrite(audience);
          if (stored === undefined) throw new Error('Invalid audience');
          p.audience = stored;
        }
        patch(str(fd, 'block_id'), p);
        return { ok: true };
      },
      createScheduleBlock: async (fd) => {
        const start = fromDatetimeLocalValue(str(fd, 'start_at') ?? '') ?? `${LAB_STUDIO_DATE}T12:00:00.000Z`;
        const end = str(fd, 'end_at');
        setMoments((all) => [
          ...all,
          {
            /* The Studio's in-place add names its own row (`createInline`, day-rail.tsx). */
            block_id: str(fd, 'block_id') ?? `m-new-${all.length}`,
            label: str(fd, 'label') || 'New moment',
            block_type: 'custom',
            start_at: start,
            end_at: end ? fromDatetimeLocalValue(end) : null,
            location: str(fd, 'location') || null,
            notes: null,
            is_public: true,
            parent_block_id: null,
            run_state: 'upcoming',
            staged: false,
            responsible_party: null,
            responsible_vendor_ids: [],
            audience: null,
          },
        ]);
        return { ok: true };
      },
      deleteScheduleBlock: async (fd) => {
        const id = str(fd, 'block_id');
        setMoments((all) => all.filter((m) => m.block_id !== id));
        return { ok: true };
      },
      toggleBlockVisibility: async (fd) => {
        patch(str(fd, 'block_id'), { is_public: str(fd, 'desired') === 'true' });
        return { ok: true };
      },
      bulkRetimeScheduleBlocks: ok,
      setBlockResponsibleParty: ok,
      setBlockPrepVisibility: ok,
      loadScheduleTemplate: ok,
      resolveScheduleSuggestion: async () => {},
    };
  }, []);
  return (
    <ScheduleDay
      inspectorSlot={DETAILS_SCHEDULE_INSPECTOR_SLOT}
      actions={actions}
      eventId={EVENT}
      eventType="wedding"
      eventDateKey={LAB_STUDIO_DATE}
      moments={moments}
      requests={[]}
      suppliers={[]}
      role="host"
      canStage={false}
      rosEnabled={false}
      templates={[]}
      isEventDay={false}
      emcee={null}
      hostPanel={null}
    />
  );
}

/** maria-and-jose's Love Story on fixtures — three moments, each with 4c's title, in the couple's own order. */
const STORY: LoveStoryBlob = {
  moments: [
    { id: 'ls-umbrella', date: { y: 2019 }, title: 'One umbrella', line: 'A rainy Tuesday in Katipunan — one umbrella, two strangers, no bus for an hour.', anchor: 'met', order: 0, canvas: {} },
    { id: 'ls-siargao', date: { y: 2022 }, title: 'Siargao', line: 'He asked. She said yes before he finished the question.', place: 'Siargao', anchor: 'yes', order: 1, canvas: {} },
    { id: 'ls-day', date: { y: 2026, m: 12, d: 12 }, title: 'The day', line: 'And now, with you, the day itself.', order: 2, canvas: {} },
  ],
} as unknown as LoveStoryBlob;

/** No draft leaves the lab: every save "lands". */
const labDraftAction = async (): Promise<HubDraftActionResult> => ({ ok: true, intent: 'save', applied: 0, held: [] });

/** Studio › Love Story on fixtures — the instant scrapbook the Maker draws, its writes kept in memory. */
export function LabStudioLoveStory() {
  return (
    <LiveLoveStoryBook
      story={STORY}
      draftAction={labDraftAction as never}
      inMaker
      eventId={EVENT}
      names="Maria & Jose"
      partners={['Maria', 'Jose']}
      eyebrow="December 12, 2026"
      daysToTheDay={68}
      themeName="Classic"
      motionLabel="Gentle"
      makerHref={`/dashboard/${EVENT}/launch`}
      guestHref={null}
      ownsPro={false}
      storeShell={false}
      proHref={`/dashboard/${EVENT}/studio/website-pro`}
      proPrice={null}
      refused={null}
      sectionHidden={false}
      mediaUrls={{}}
      /* A change only the server may decide (a NEW photo) — the lab has no server. */
      action={async () => {
        throw new Error('Photos need the database — open this in the Maker.');
      }}
      pickSlot={null}
    />
  );
}
