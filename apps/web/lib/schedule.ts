import type { SupabaseClient } from '@supabase/supabase-js';

export type ScheduleBlockType =
  | 'pre_ceremony'
  | 'ceremony'
  | 'cocktails'
  | 'reception'
  | 'dinner'
  | 'program'
  | 'dancing'
  | 'send_off'
  | 'after_party'
  | 'custom';

export const SCHEDULE_BLOCK_TYPES: ReadonlyArray<ScheduleBlockType> = [
  'pre_ceremony',
  'ceremony',
  'cocktails',
  'reception',
  'dinner',
  'program',
  'dancing',
  'send_off',
  'after_party',
  'custom',
];

export const SCHEDULE_BLOCK_LABEL: Record<ScheduleBlockType, string> = {
  pre_ceremony: 'Pre-ceremony',
  ceremony: 'Ceremony',
  cocktails: 'Cocktails',
  reception: 'Reception',
  dinner: 'Dinner',
  program: 'Program',
  dancing: 'Dancing',
  send_off: 'Send-off',
  after_party: 'After-party',
  custom: 'Custom',
};

export type ScheduleBlockRow = {
  block_id: string;
  public_id: string;
  event_id: string;
  label: string;
  block_type: ScheduleBlockType;
  start_at: string;
  end_at: string | null;
  location: string | null;
  notes: string | null;
  is_public: boolean;
  sort_order: number;
  created_at: string;
};

const SELECT =
  'block_id,public_id,event_id,label,block_type,start_at,end_at,location,notes,is_public,sort_order,created_at';

export async function fetchScheduleBlocks(
  supabase: SupabaseClient,
  eventId: string,
): Promise<ScheduleBlockRow[]> {
  const { data, error } = await supabase
    .from('event_schedule_blocks')
    .select(SELECT)
    .eq('event_id', eventId)
    .order('start_at', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) throw new Error(`fetchScheduleBlocks failed: ${error.message}`);
  return (data ?? []) as ScheduleBlockRow[];
}

export async function fetchPublicScheduleBlocks(
  supabase: SupabaseClient,
  eventId: string,
): Promise<ScheduleBlockRow[]> {
  const { data, error } = await supabase
    .from('event_schedule_blocks')
    .select(SELECT)
    .eq('event_id', eventId)
    .eq('is_public', true)
    .order('start_at', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) throw new Error(`fetchPublicScheduleBlocks failed: ${error.message}`);
  return (data ?? []) as ScheduleBlockRow[];
}

export function formatBlockTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatBlockTimeRange(startIso: string, endIso: string | null): string {
  const start = new Date(startIso);
  const startStr = start.toLocaleString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  if (!endIso) return startStr;
  const end = new Date(endIso);
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  const endStr = end.toLocaleString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return sameDay ? `${startStr} – ${endStr}` : `${startStr} → ${end.toLocaleString()}`;
}
