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
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScheduleDay } from '@/app/dashboard/[eventId]/schedule/_components/schedule-lazy';
import type { DayActions, DayMoment } from '@/app/dashboard/[eventId]/schedule/_components/day-types';
import { DETAILS_SCHEDULE_INSPECTOR_SLOT } from '@/lib/maker-details-items';
import { fromDatetimeLocalValue } from '@/lib/schedule-datetime-local';
import { scheduleAudienceForWrite } from '@/lib/schedule-audience';
import { LiveLoveStoryBook, editLoveStory, liveStoryOf } from '@/app/dashboard/[eventId]/website/our-story/_components/love-story-live';
import { SlotsUploadStandIn } from '@/app/dashboard/[eventId]/website/our-story/_components/moment-order-cards';
import { MomentNotKept } from '@/app/dashboard/[eventId]/website/our-story/_components/moment-sheet';
import { applyMomentIntent } from '@/lib/love-story-moment-intent';
import { readMomentMedia, resolveMoments } from '@/lib/love-story-moments';
import type { OtherEvent } from '@/app/dashboard/[eventId]/website/our-story/_components/pick-from-our-events';
import { labUploadStandIn } from './lab-upload-stand-in';
import { LAB_LOVE_STORY, LAB_PHOTOS } from './love-story-fixture';
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

/* maria-and-jose's Love Story and its two stand-in pictures live in `love-story-fixture.ts` — a plain file, so the
   lab's Details words panel (drawn by a server file) is handed the SAME story as this list. */
const STORY = LAB_LOVE_STORY;

/** No draft leaves the lab: every save "lands". */
const labDraftAction = async (): Promise<HubDraftActionResult> => ({ ok: true, intent: 'save', applied: 0, held: [] });

/**
 * 🧪 THE PAIR'S OTHER EVENTS, for "Pick from our events" — two, as the page can meet them: one they host that shows
 * photos (four of maria-and-jose's demo pictures stand in for its gallery), and one that is someone else's (listed,
 * and it lends nothing). Each photo's ref sits under ITS event's folder, exactly as a stored one does — that folder
 * is how a picked photo is known to have come from another event.
 */
const ENGAGEMENT = '11111111-1111-4111-8111-111111111111';
const LAB_OTHER_EVENTS: OtherEvent[] = [
  {
    eventId: ENGAGEMENT,
    name: 'Maria & Jose — the engagement',
    date: '2025-06-21',
    hosted: true,
    photos: [2, 3, 4, 5].map((n) => ({ ref: `r2://setnayan-media/events/${ENGAGEMENT}/our-photos/wall-${n}.webp`, url: `/demo/maria-jose/wall-${n}.webp` })),
  },
  { eventId: '22222222-2222-4222-8222-222222222222', name: 'Ana & Luis', date: '2024-02-10', hosted: false, photos: [] },
];
const LAB_OFFERED = LAB_OTHER_EVENTS.flatMap((e) => e.photos);
/** Every picture the lab can draw from the start: the fixture's two and the other event's four. */
const LAB_PICTURES: Record<string, string> = { ...LAB_PHOTOS, ...Object.fromEntries(LAB_OFFERED.map((ph) => [ph.ref, ph.url])) };
/** Where each offered photo is from — what the page works out from a stored ref and one read of the event's name. */
const LAB_PHOTO_FROM: Record<string, string> = Object.fromEntries(LAB_OTHER_EVENTS.flatMap((e) => e.photos.map((ph) => [ph.ref, e.name])));

/**
 * 🧪 WHAT ONLY THE SERVER MAY DECIDE, DECIDED IN MEMORY. In the Maker a change that brings a NEW photo goes to the
 * server action (it screens the photo, then keeps the moment in the draft). The lab has no server: the SAME moment
 * form is applied to the fixture with the server's own function (`applyMomentIntent`) and kept through the instant
 * book's own door (`editLoveStory`) — so the row, its square and its count are the shipped ones. Nothing is screened.
 */
async function labMomentAction(fd: FormData): Promise<void> {
  const now = liveStoryOf(STORY);
  const before = resolveMoments(now);
  const intent = String(fd.get('intent'));
  const keep = (moments: typeof before) => editLoveStory({ eventId: EVENT, next: { ...now, moments }, server: STORY, what: 'That moment', draftAction: labDraftAction as never });
  /* The one question the action answers — after a beat, so the loading rows can be seen. */
  if (intent === 'offer') {
    await new Promise((r) => setTimeout(r, 600));
    return { offer: LAB_OTHER_EVENTS } as unknown as void;
  }
  /* A pick, as the action decides it: only photos the offer holds, added after the moment's own, capped as stored. */
  if (intent === 'pick') {
    const prior = before.find((m) => m.id === String(fd.get('id')));
    if (!prior) throw new MomentNotKept('Choose the moment to add these to.');
    const allowed = readMomentMedia(fd.getAll('media')).filter((ref) => LAB_OFFERED.some((ph) => ph.ref === ref));
    const media = readMomentMedia([...(prior.media ?? []), ...allowed]);
    await keep(before.map((m) => (m.id === prior.id ? { ...m, ...(media.length ? { media } : {}) } : m)));
    return;
  }
  if (intent !== 'add' && intent !== 'edit') throw new Error('The lab cannot do that one — open this in the Maker.');
  const r = applyMomentIntent(before, intent, fd);
  if (!r.ok) throw new MomentNotKept(r.error);
  await keep(r.after);
}

/** Studio › Love Story on fixtures — the instant scrapbook the Maker draws, its writes kept in memory. */
export function LabStudioLoveStory() {
  /* The pictures the lab can draw: the fixture's two, plus every photo picked here (held in the browser's memory). */
  const [urls, setUrls] = useState<Record<string, string>>(LAB_PICTURES);
  const held = useRef<string[]>([]);
  const standIn = useMemo(
    () =>
      labUploadStandIn((ref, url) => {
        held.current.push(url);
        setUrls((all) => ({ ...all, [ref]: url }));
      }),
    [],
  );
  /* Leaving the lab lets the browser forget them. */
  useEffect(
    () => () => {
      for (const url of held.current.splice(0)) URL.revokeObjectURL(url);
    },
    [],
  );
  return (
    <SlotsUploadStandIn.Provider value={standIn}>
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
        /* Photos on, so the picture square and its slots can be seen. */
        ownsPro
        storeShell={false}
        proHref={`/dashboard/${EVENT}/studio/website-pro`}
        proPrice={null}
        refused={null}
        sectionHidden={false}
        mediaUrls={urls}
        photoFrom={LAB_PHOTO_FROM}
        action={labMomentAction}
        pickSlot={null}
      />
    </SlotsUploadStandIn.Provider>
  );
}
