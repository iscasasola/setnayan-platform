'use client';

/**
 * The first five hub tools (DECISION_LOG 2026-11-23) on SAMPLE data, for the day lab: the SHIPPED view
 * (`HubToolPanelsView`, the one that draws all ten) handed sample rows and an in-memory saver in place of the database,
 * so every control can be pressed with no sign-in. The saver runs the dispatcher's own decision (`parseHubToolEntryOp`),
 * so a refusal here is the refusal a live write gets. Every row is a `vendor_hub_tool_entries` row (ONE home,
 * controller 23 Nov 2026). DEV-ONLY (the lab page 404s in production).
 */
import { useMemo } from 'react';
import { HubToolPanelsView, type HubToolReads } from '@/app/vendor-dashboard/on-the-day/live/[eventId]/_components/hub-tools/hub-tool-panels-view';
import { parseHubToolEntryOp, type HubToolEntry } from '@/lib/hub-tool-entries';
import type { DayOfModuleId } from '@/lib/vendor-dayof-modules';
import type { EntourageSheetSection } from '@/lib/supplier-march';

const ENTOURAGE: EntourageSheetSection[] = [
  {
    key: 'principal_sponsors',
    label: 'Principal Sponsors',
    people: [
      { key: 'p1', name: 'Atty. Ramon Dizon', initials: 'RD', role: 'Ninong' },
      { key: 'p2', name: 'Dr. Liza Dizon', initials: 'LD', role: 'Ninang' },
    ],
  },
  {
    key: 'bridesmaids_groomsmen',
    label: 'Bridesmaids & Groomsmen',
    people: [
      { key: 'b1', name: 'Maria Reyes', initials: 'MR', role: 'Maid of Honor' },
      { key: 'b2', name: 'Jose Santos', initials: 'JS', role: 'Best Man' },
      { key: 'b3', name: 'Ana Cruz', initials: 'AC', role: 'Bridesmaid' },
    ],
  },
];

const uuid = () => crypto.randomUUID();
const e = (label: string, over: Partial<HubToolEntry> = {}): HubToolEntry => ({ id: uuid(), label, note: '', done: false, qty: 0, ...over });

const ROW_TOOLS = ['queue_counter', 'paperwork_checklist', 'load_in_and_venue_access', 'delivery_and_drop_off'] as const;

function readsFor(unread: boolean): HubToolReads {
  if (unread) {
    return { entries: new Map(ROW_TOOLS.map((k) => [k, { state: 'unread' as const }])), dietary: null, setList: null, entourage: null };
  }
  return {
    entries: new Map([
      ['queue_counter', { state: 'ok' as const, entries: [e('Served', { qty: 37 })] }],
      ['paperwork_checklist', { state: 'ok' as const, entries: [e('Valid IDs', { done: true }), e('Signed forms'), e('Permits')] }],
      ['load_in_and_venue_access', { state: 'ok' as const, entries: [] }],
      ['delivery_and_drop_off', { state: 'ok' as const, entries: [e('Delivery time agreed', { done: true }), e('Who receives it')] }],
    ]),
    dietary: null,
    setList: null,
    entourage: ENTOURAGE,
  };
}

/** The dispatcher's decision, in memory: refuses what the live one refuses, saves the rest. */
async function labSave(_eventId: string, input: unknown) {
  const parsed = parseHubToolEntryOp(input);
  if (!parsed.ok) return parsed;
  await new Promise((r) => setTimeout(r, 120));
  return parsed.op.op === 'add' ? { ok: true as const, entryId: uuid() } : { ok: true as const };
}

export function HubToolsLab({
  eventId,
  coming,
  on,
  unread = false,
}: {
  eventId: string;
  coming: number | null;
  on: readonly DayOfModuleId[];
  /** Every read refused: each tool says so in its place, never an empty tool. */
  unread?: boolean;
}) {
  const reads = useMemo(() => readsFor(unread), [unread]);
  return <HubToolPanelsView eventId={eventId} modules={on} attending={coming} reads={reads} save={labSave} />;
}
