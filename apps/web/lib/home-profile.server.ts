/**
 * home-profile.server.ts — the few numbers and words Home's profile header and pinned rows need that no shipped read
 * already hands them (owner 11 Nov 2026, "One profile page approve" — v3 rows 7 and the header).
 *
 *   · the board's shelf counts — computed from the SAME cached membership reads the board makes
 *     (`fetchUserEventsOrReconnect`, React `cache()`d, one trip for the three shelves), through the SAME shelf rules
 *     (`lib/event-board.ts`), so "2 planning · 1 celebrated" can never disagree with the board under it. ZERO extra trips.
 *   · the handle — `users.slug` and whether the public profile is on: ONE small read.
 *   · the shop's service cards and how many are Online (`vendor_services.is_active`): ONE count read, owners only.
 *
 * Every read fails soft to `null` = "not measured", which the callers draw as no number (never a 0 over a refusal).
 */
import 'server-only';

import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchUserEventsOrReconnect, userEventsReadRefused } from '@/lib/events';
import {
  boardFinished,
  manilaTodayISO,
  mergeBoardMemberships,
  splitEventBoard,
  splitPlanningShelves,
} from '@/lib/event-board';
import { logQueryError } from '@/lib/supabase/error-detect';

export type HomeEventCounts = { planning: number; celebrated: number };

/** Planning (today's included) and Celebrated — the board's own shelves, counted. null = a read refused. */
export async function readHomeEventCounts(userId: string): Promise<HomeEventCounts | null> {
  try {
    const supabase = await createClient();
    const kinds = ['couple', 'guest', 'coordinator'] as const;
    const refused = await Promise.all(kinds.map((m) => userEventsReadRefused(supabase, userId, m).catch(() => true)));
    if (refused.some(Boolean)) return null;
    const [organiser, invited, helping] = await Promise.all(kinds.map((m) => fetchUserEventsOrReconnect(supabase, userId, m)));
    const today = manilaTodayISO();
    const { comingUp, finished } = splitEventBoard(mergeBoardMemberships(organiser!, invited!, helping!), today);
    const { happeningNow, planning } = splitPlanningShelves(comingUp, finished, today);
    return { planning: happeningNow.length + planning.length, celebrated: boardFinished(finished).length };
  } catch {
    return null;
  }
}

export type HomeHandle = {
  slug: string | null;
  publicOn: boolean | null;
  /**
   * 🔗 THE ADDRESS MOVE (owner 2026-11-15: "a username is made automatically from the person's name and shown once,
   * changeable"). True on the ONE Home render that first shows a username Setnayan made (`users.username_minted_at`
   * set, `username_minted_seen_at` not yet) — that render stamps it seen, after the response, so the line is said once.
   */
  justMade?: boolean;
};

/** The @handle and whether the public twin is switched on. */
export async function readHomeHandle(userId: string): Promise<HomeHandle> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('users')
      .select('slug, public_profile_enabled, username_minted_at, username_minted_seen_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) {
      if (error) logQueryError('Home.readHomeHandle', error, {}, 'graceful_degrade');
      return { slug: null, publicOn: null };
    }
    const row = data as {
      slug: string | null;
      public_profile_enabled: boolean | null;
      username_minted_at?: string | null;
      username_minted_seen_at?: string | null;
    };
    const justMade = Boolean(row.slug && row.username_minted_at && !row.username_minted_seen_at);
    if (justMade) {
      // Said once: stamped after this response is on its way (the person's own row, their own session).
      after(async () => {
        try {
          const db = await createClient();
          await db
            .from('users')
            .update({ username_minted_seen_at: new Date().toISOString() })
            .eq('user_id', userId)
            .is('username_minted_seen_at', null);
        } catch {
          // A missed stamp shows the line once more — never an error.
        }
      });
    }
    return { slug: row.slug ?? null, publicOn: row.public_profile_enabled ?? null, justMade };
  } catch {
    return { slug: null, publicOn: null };
  }
}

export type HomeCardCounts = { cards: number; online: number };

/** The shop's service cards and how many are Online. null = refused. */
export async function readHomeCardCounts(vendorProfileId: string): Promise<HomeCardCounts | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('vendor_services').select('is_active').eq('vendor_profile_id', vendorProfileId);
    if (error) {
      logQueryError('Home.readHomeCardCounts', error, {}, 'graceful_degrade');
      return null;
    }
    const rows = (data ?? []) as { is_active: boolean | null }[];
    return { cards: rows.length, online: rows.filter((r) => r.is_active !== false).length };
  } catch {
    return null;
  }
}
