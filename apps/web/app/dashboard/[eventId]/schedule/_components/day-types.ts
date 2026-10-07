import type { ScheduleBlockType } from '@/lib/schedule';

/**
 * The shapes the server page hands the Event Day rail (Schedule rebuild,
 * slice 1). Plain objects only — they cross the server→client boundary, so a
 * `Map` (the shape `fetchBlockRosMeta` returns) is flattened onto each moment.
 */

export type DayMoment = {
  block_id: string;
  label: string;
  block_type: ScheduleBlockType;
  start_at: string;
  end_at: string | null;
  location: string | null;
  notes: string | null;
  is_public: boolean;
  parent_block_id: string | null;
  run_state: 'upcoming' | 'live' | 'done';
  /** A coordinator's unreleased moment — only the coordinator sees it. */
  staged: boolean;
  responsible_party: string | null;
  responsible_vendor_ids: string[];
  /** 👥 For ▾ — who this moment is for; NULL/absent = Everyone (`lib/schedule-audience.ts`). */
  audience?: string | null;
};

export type DayRequest = {
  suggestion_id: string;
  block_id: string | null;
  /** add · change (or, with no proposed fields, a suggestion in words) · delete. */
  kind: 'adjust' | 'new' | 'remove';
  by: string;
  proposed_label: string | null;
  proposed_start_at: string | null;
  proposed_end_at: string | null;
  proposed_location: string | null;
  note: string;
};

export type DaySupplier = { vendor_id: string; vendor_name: string };

export type DayTemplate = {
  id: string;
  label: string;
  description: string;
  count: number;
};

/** Who is looking — decides every edit control on the page. */
export type DayRole = 'host' | 'coordinator' | 'view';

/**
 * The writes the rail may make — the EXISTING server actions in `../actions`,
 * handed down by the page rather than imported here. Two reasons: the page is
 * where "which actions" is decided (one place to read), and a render test can
 * mount the rail without pulling the whole server module graph (`server-only`,
 * the admin client) into node. A server action is a serialisable reference, so
 * passing it as a prop is the documented Next.js path, not a workaround.
 */
export type DayActions = {
  updateScheduleBlock: (fd: FormData) => Promise<unknown>;
  bulkRetimeScheduleBlocks: (fd: FormData) => Promise<unknown>;
  createScheduleBlock: (fd: FormData) => Promise<unknown>;
  deleteScheduleBlock: (fd: FormData) => Promise<unknown>;
  toggleBlockVisibility: (fd: FormData) => Promise<unknown>;
  setBlockResponsibleParty: (fd: FormData) => Promise<unknown>;
  setBlockPrepVisibility: (fd: FormData) => Promise<unknown>;
  loadScheduleTemplate: (fd: FormData) => Promise<unknown>;
  /** Used as a `<form action>`, so it keeps the form-action shape. */
  resolveScheduleSuggestion: (fd: FormData) => Promise<void>;
};
