import type { ScheduleBlockType } from '@/lib/schedule';
import type { TimesMark } from '@/lib/supplier-schedule-marks';

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
  run_state: 'upcoming' | 'live' | 'done' | 'skipped';
  /** A coordinator's unreleased moment — only the coordinator sees it. */
  staged: boolean;
  responsible_party: string | null;
  responsible_vendor_ids: string[];
  /** 👥 For ▾ — who this moment is for; NULL/absent = Everyone (`lib/schedule-audience.ts`). */
  audience?: string | null;
  /** 📖 A chapter whose time is not known yet (migration 20271300482585) — listed under the rail, never drawn on it. */
  time_tba?: boolean;
};

export type DayRequest = {
  suggestion_id: string;
  block_id: string | null;
  /** add · change (or, with no proposed fields, a suggestion in words) · delete. */
  kind: 'adjust' | 'new' | 'remove' | 'hours' | 'where' | 'skip';
  by: string;
  proposed_label: string | null;
  proposed_start_at: string | null;
  proposed_end_at: string | null;
  proposed_location: string | null;
  /** Their crew on it — "Team A, Second shooter" (Step 4b, the supplier's Who on our side). */
  proposed_crew?: string[] | null;
  /** 🏛 A venue's hours (kind `hours`): setup / pack-up in minutes from the chapter's start. */
  proposed_ingress_minutes?: number | null;
  proposed_egress_minutes?: number | null;
  /** 📍 A supplier's Where pick (kind `where`, migration 20271308641275): the chapters they are on now → asked. */
  where?: { now: string; asked: string } | null;
  note: string;
};

/** A supplier an item can be given to — shop name + "Booked"/"Shortlisted" (lib/schedule-suppliers.ts). */
export type DaySupplier = { vendor_id: string; vendor_name: string; standing?: 'Booked' | 'Shortlisted'; times?: TimesMark };

/** "The Wedding Planner · Booked" — the one way an item names its supplier. */
export function supplierOnItem(s: { vendor_name: string; standing?: 'Booked' | 'Shortlisted'; times?: TimesMark }): string {
  // ✅ "· Times confirmed" / "· Seen" — the supplier's own press (`lib/supplier-schedule-marks.ts`, audit G6).
  return [s.vendor_name, s.standing, s.times].filter(Boolean).join(' · ');
}

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
  /** 🔁 Answers in words (`ScheduleRequestAnswer`, read through `requestAnswerOf`) — the sheet saves in place. */
  resolveScheduleSuggestion: (fd: FormData) => Promise<unknown>;
};
