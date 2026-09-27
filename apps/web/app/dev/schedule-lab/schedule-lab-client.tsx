'use client';

/**
 * The lab's client: the prototype's day (`schedule_redesign_2026-09-25.html`)
 * as fixture rows, the real `ScheduleDay`, and IN-MEMORY stand-ins for the nine
 * server actions the page normally hands it — each applies the same FormData
 * the real action would receive to the fixture, so a drag, a stepper press, an
 * eye flip or an Add survive the rail's "fresh server answer" reset exactly as
 * they would after a real save. A switch makes every write refuse, to see the
 * rail say so. Nothing here reaches a database.
 */

import { useMemo, useState } from 'react';
import { ScheduleDay } from '@/app/dashboard/[eventId]/schedule/_components/day-rail';
import { PickMenu, Switch } from '@/app/dashboard/[eventId]/schedule/_components/day-ui';
import type {
  DayActions,
  DayMoment,
  DayRequest,
  DayRole,
  DaySupplier,
} from '@/app/dashboard/[eventId]/schedule/_components/day-types';
import { RunOfShowHeader } from '@/app/_components/run-of-show-header';
import { fromDatetimeLocalValue } from '@/lib/schedule-datetime-local';
import { venueNowMs } from '@/lib/schedule';
import { wallDateKey } from '@/lib/schedule-rail';

const PLAN_DATE = '2026-12-18';

const SUPPLIERS: DaySupplier[] = [
  { vendor_id: 'v-gaia', vendor_name: 'Gaia Florals' },
  { vendor_id: 'v-kat', vendor_name: 'HMUA by Kat' },
  { vendor_id: 'v-casa', vendor_name: 'Casa Catering' },
  { vendor_id: 'v-lum', vendor_name: 'Lumière Photo' },
];

type Seed = [
  id: string,
  label: string,
  type: DayMoment['block_type'],
  start: string,
  end: string | null,
  pub: boolean,
  extra?: Partial<DayMoment>,
];

const SEEDS: Seed[] = [
  ['hmua', 'Hair & makeup', 'pre_ceremony', '08:00', '12:00', false, { responsible_vendor_ids: ['v-kat'], responsible_party: 'HMUA team', location: 'Bridal suite, Peninsula Manila', notes: 'Claire first, then the entourage. Mom at 10:30 AM.' }],
  ['ingress', 'Vendor ingress & styling', 'pre_ceremony', '10:00', '13:00', false, { responsible_vendor_ids: ['v-gaia'], location: 'San Agustin Church · Grand ballroom' }],
  ['arrive', 'Guests arrive', 'pre_ceremony', '13:30', '14:00', true, { location: 'San Agustin Church, Intramuros', notes: 'Ushers at both doors. Programs on the pews.' }],
  ['cer', 'Ceremony', 'ceremony', '14:00', '15:30', true, { responsible_party: 'Coordinator', location: 'San Agustin Church, Intramuros', notes: 'Unplugged ceremony — ushers remind at the door.' }],
  ['cer-1', 'Procession', 'ceremony', '14:00', null, true, { parent_block_id: 'cer' }],
  ['cer-2', 'Vows & rings', 'ceremony', '14:25', null, true, { parent_block_id: 'cer' }],
  ['cer-3', 'Recessional', 'ceremony', '15:15', null, true, { parent_block_id: 'cer' }],
  ['cock', 'Cocktails', 'cocktails', '16:00', '17:00', true, { responsible_vendor_ids: ['v-casa'], responsible_party: 'Casa Catering', location: 'Garden terrace' }],
  ['rec', 'Reception & dinner', 'reception', '17:00', '19:30', true, { location: 'Grand ballroom' }],
  ['prog', 'Program', 'program', '19:30', '21:00', true, { responsible_party: 'Host / MC' }],
  ['dance', 'First dance', 'dancing', '21:00', '21:20', false, { notes: 'Song: "Ikaw" — band has the arrangement.' }],
  ['send', 'Send-off', 'send_off', '22:00', '22:30', true, { responsible_party: 'Coordinator', location: 'Driveway, main entrance' }],
];

function seedMoments(dateKey: string, nowMin: number | null): DayMoment[] {
  return SEEDS.map(([id, label, type, start, end, pub, extra]) => {
    const startAt = `${dateKey}T${start}:00.000Z`;
    const endAt = end ? `${dateKey}T${end}:00.000Z` : null;
    const s = Number(start.slice(0, 2)) * 60 + Number(start.slice(3));
    const e = end ? Number(end.slice(0, 2)) * 60 + Number(end.slice(3)) : s + 30;
    const run_state: DayMoment['run_state'] =
      nowMin === null ? 'upcoming' : e <= nowMin ? 'done' : s <= nowMin ? 'live' : 'upcoming';
    return {
      block_id: id,
      label,
      block_type: type,
      start_at: startAt,
      end_at: endAt,
      location: null,
      notes: null,
      is_public: pub,
      parent_block_id: null,
      run_state,
      staged: false,
      responsible_party: null,
      responsible_vendor_ids: [],
      ...extra,
    };
  });
}

function seedRequests(dateKey: string): DayRequest[] {
  return [
    {
      suggestion_id: 'r1',
      block_id: 'ingress',
      kind: 'adjust',
      by: 'Gaia Florals',
      proposed_label: null,
      proposed_start_at: `${dateKey}T09:30:00.000Z`,
      proposed_end_at: `${dateKey}T13:00:00.000Z`,
      proposed_location: null,
      note: 'Need 30 more minutes for the arch.',
    },
    {
      suggestion_id: 'r3',
      block_id: null,
      kind: 'new',
      by: 'Lumière Photo',
      proposed_label: 'Post-ceremony photos',
      proposed_start_at: `${dateKey}T15:30:00.000Z`,
      proposed_end_at: `${dateKey}T16:00:00.000Z`,
      proposed_location: 'Church steps, then the garden',
      note: 'Family portraits before cocktails, while the light is good.',
    },
    {
      suggestion_id: 'r2',
      block_id: null,
      kind: 'new',
      by: 'Casa Catering',
      proposed_label: 'Cake cutting',
      proposed_start_at: `${dateKey}T21:20:00.000Z`,
      proposed_end_at: `${dateKey}T21:40:00.000Z`,
      proposed_location: null,
      note: 'The cake needs 20 minutes at room temperature — right after the first dance works.',
    },
  ];
}

const str = (fd: FormData, k: string): string | null => {
  const v = fd.get(k);
  return typeof v === 'string' ? v : null;
};

export default function ScheduleLabClient() {
  const [role, setRole] = useState<DayRole>('host');
  const [when, setWhen] = useState<'plan' | 'live'>('plan');
  const [refuse, setRefuse] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const venueNow = new Date(venueNowMs());
  const todayKey = wallDateKey(venueNow.toISOString());
  const nowMin = venueNow.getUTCHours() * 60 + venueNow.getUTCMinutes();
  const dateKey = when === 'live' ? todayKey : PLAN_DATE;

  const [byMode, setByMode] = useState<Record<string, DayMoment[]>>({});
  const moments = byMode[dateKey] ?? seedMoments(dateKey, when === 'live' ? nowMin : null);
  const setMoments = (fn: (m: DayMoment[]) => DayMoment[]) =>
    setByMode((b) => ({ ...b, [dateKey]: fn(b[dateKey] ?? seedMoments(dateKey, when === 'live' ? nowMin : null)) }));
  const [requests, setRequests] = useState<DayRequest[] | null>(null);
  const reqs = requests ?? seedRequests(dateKey);

  const actions = useMemo<DayActions>(() => {
    const say = (line: string) => setLog((l) => [line, ...l].slice(0, 8));
    const gate = async (name: string, fd: FormData) => {
      await new Promise((r) => setTimeout(r, 250));
      const shown = [...fd.entries()]
        .filter(([k]) => k !== 'event_id')
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(' · ');
      if (refuse) {
        say(`✗ ${name} refused · ${shown}`);
        throw new Error('refused by the lab');
      }
      say(`✓ ${name} · ${shown}`);
    };
    return {
      async updateScheduleBlock(fd) {
        await gate('updateScheduleBlock', fd);
        const id = str(fd, 'block_id');
        setMoments((ms) =>
          ms.map((m) => {
            if (m.block_id !== id) return m;
            const next = { ...m };
            const s = str(fd, 'start_at');
            const e = str(fd, 'end_at');
            if (s) next.start_at = fromDatetimeLocalValue(s) ?? m.start_at;
            if (e) next.end_at = fromDatetimeLocalValue(e);
            for (const k of ['label', 'location', 'notes'] as const) {
              const v = str(fd, k);
              if (v !== null) next[k] = (v.trim() || null) as never;
            }
            const t = str(fd, 'block_type');
            if (t) next.block_type = t as DayMoment['block_type'];
            return next;
          }),
        );
      },
      async bulkRetimeScheduleBlocks(fd) {
        await gate('bulkRetimeScheduleBlocks', fd);
        const from = str(fd, 'from_block_id');
        const to = str(fd, 'to_block_id') || null;
        const delta = Number(str(fd, 'delta_minutes') ?? 0) * 60_000;
        setMoments((ms) => {
          const top = ms.filter((m) => m.parent_block_id === null).sort((a, b) => (a.start_at < b.start_at ? -1 : 1));
          const i = top.findIndex((m) => m.block_id === from);
          const j = to ? top.findIndex((m) => m.block_id === to) : top.length - 1;
          const ids = new Set(top.slice(i, j + 1).map((m) => m.block_id));
          return ms.map((m) => {
            const hit = ids.has(m.block_id) || (m.parent_block_id !== null && ids.has(m.parent_block_id));
            if (!hit) return m;
            return {
              ...m,
              start_at: new Date(new Date(m.start_at).getTime() + delta).toISOString(),
              end_at: m.end_at ? new Date(new Date(m.end_at).getTime() + delta).toISOString() : null,
            };
          });
        });
      },
      async createScheduleBlock(fd) {
        await gate('createScheduleBlock', fd);
        const start = fromDatetimeLocalValue(str(fd, 'start_at') ?? '') ?? `${dateKey}T14:00:00.000Z`;
        const end = fromDatetimeLocalValue(str(fd, 'end_at') ?? '');
        setMoments((ms) => [
          ...ms,
          {
            block_id: `new-${Date.now()}`,
            label: str(fd, 'label') ?? 'New moment',
            block_type: (str(fd, 'block_type') ?? 'custom') as DayMoment['block_type'],
            start_at: start,
            end_at: end,
            location: str(fd, 'location')?.trim() || null,
            notes: null,
            is_public: str(fd, 'is_public') === 'on',
            parent_block_id: str(fd, 'parent_block_id'),
            run_state: 'upcoming',
            staged: str(fd, 'prep') === 'on',
            responsible_party: null,
            responsible_vendor_ids: [],
          },
        ]);
      },
      async deleteScheduleBlock(fd) {
        await gate('deleteScheduleBlock', fd);
        const id = str(fd, 'block_id');
        setMoments((ms) => ms.filter((m) => m.block_id !== id && m.parent_block_id !== id));
      },
      async toggleBlockVisibility(fd) {
        await gate('toggleBlockVisibility', fd);
        const id = str(fd, 'block_id');
        const desired = str(fd, 'desired') === 'true';
        setMoments((ms) => ms.map((m) => (m.block_id === id ? { ...m, is_public: desired } : m)));
      },
      async setBlockResponsibleParty(fd) {
        await gate('setBlockResponsibleParty', fd);
        const id = str(fd, 'block_id');
        const party = str(fd, 'responsible_party') ?? '';
        const ids = fd.getAll('responsible_vendor_ids').map(String);
        setMoments((ms) =>
          ms.map((m) => (m.block_id === id ? { ...m, responsible_party: party.trim() || null, responsible_vendor_ids: ids } : m)),
        );
      },
      async setBlockPrepVisibility(fd) {
        await gate('setBlockPrepVisibility', fd);
        const id = str(fd, 'block_id');
        setMoments((ms) => ms.map((m) => (m.block_id === id ? { ...m, staged: false } : m)));
      },
      async loadScheduleTemplate(fd) {
        await gate('loadScheduleTemplate', fd);
      },
      async resolveScheduleSuggestion(fd) {
        await gate('resolveScheduleSuggestion', fd);
        const id = str(fd, 'suggestion_id');
        setRequests((r) => (r ?? seedRequests(dateKey)).filter((x) => x.suggestion_id !== id));
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refuse, dateKey]);

  const strip = moments
    .filter((m) => m.parent_block_id === null)
    .map((m) => ({
      block_id: m.block_id,
      label: m.label,
      start_at: m.start_at,
      end_at: m.end_at,
      location: m.location,
      run_state: m.run_state,
      actual_start_at: null,
    }));

  return (
    <main className="sn-col space-y-5 pb-24">
      <header className="flex flex-wrap items-center gap-2 pt-4">
        <p className="mr-auto text-sm text-ink/60">
          <b className="font-semibold text-ink">Schedule lab</b> · fixtures, no database
        </p>
        <PickMenu
          label="Signed in as"
          value={role}
          dataAttr="data-lab-role"
          options={[
            { key: 'host', label: 'Host' },
            { key: 'coordinator', label: 'Coordinator (approved)' },
            { key: 'view', label: 'View only' },
          ]}
          onPick={(k) => setRole(k as DayRole)}
        />
        <PickMenu
          label="When"
          value={when}
          dataAttr="data-lab-when"
          options={[
            { key: 'plan', label: 'Planning · 18 Dec' },
            { key: 'live', label: 'Event day · now' },
          ]}
          onPick={(k) => setWhen(k as 'plan' | 'live')}
        />
        <span className="w-40">
          <Switch on={refuse} onChange={setRefuse} label="Refuse every write" />
        </span>
      </header>

      {when === 'live' ? <RunOfShowHeader eventId="lab" initial={strip} canAdvance={false} variant="strip" /> : null}

      <ScheduleDay
        key={`${role}-${when}`}
        actions={actions}
        eventId="lab"
        eventType="wedding"
        eventDateKey={dateKey}
        moments={moments}
        requests={reqs}
        suppliers={SUPPLIERS}
        role={role}
        canStage={role === 'coordinator'}
        rosEnabled
        templates={[]}
        isEventDay={when === 'live'}
        daysToGo={when === 'live' ? 0 : 81}
        emcee={null}
        hostPanel={<p className="text-[13px] text-ink/60">Your booked host&rsquo;s segments, questions and a note to them sit here.</p>}
      />

      {log.length > 0 ? (
        <ol className="space-y-0.5 font-mono text-[11px] text-ink/55">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ol>
      ) : null}
    </main>
  );
}
