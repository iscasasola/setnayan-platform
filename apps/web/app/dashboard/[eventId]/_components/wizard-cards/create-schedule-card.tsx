/**
 * Card 15 Create Schedule · Programming tier · 2026-05-24 owner directive
 * restructure.
 *
 * Replaces the previous flat 6-block hardcoded list (Preparation · Ceremony
 * · Cocktail hour · Reception · program · First dance + open floor ·
 * Send-off) with a two-level hierarchy persisted to event_schedule_blocks
 * rows:
 *
 *   1. Ceremony           (+ parts of the ceremony · nested · per-faith seed)
 *   2. Cocktail Hour      (standalone)
 *   3. Reception          (+ parts of the reception · nested · universal Filipino seed)
 *   4. After Party        (standalone)
 *
 * Owner directive verbatim:
 *   "Ceremony - Parts of the ceremony
 *    Cocktail Hour
 *    Reception - Parts of the Reception
 *    After Party
 *    Can be rearranged, add a new schedule, Can be deleted"
 *
 * Architecture · server shell + client editor:
 *
 *   - This file is an ASYNC server component that:
 *       1. Reads existing event_schedule_blocks for the event
 *       2. If empty, fires seedDefaultScheduleBlocks (ceremony-type-aware)
 *       3. Re-reads after seed
 *       4. Groups rows into topLevel + childrenByParent via
 *          groupScheduleBlocksByParent
 *       5. Renders the client editor with the grouped payload
 *
 *   - <ScheduleEditor> is the 'use client' component that wires drag-to-
 *     reorder, add-block, delete-block, inline label/time edit, and the
 *     final "Lock the rough schedule" mark-done CTA.
 *
 * Persistence · rows in event_schedule_blocks. Edits write immediately via
 * server actions (updateScheduleBlock · createScheduleBlock · deleteScheduleBlock
 * · reorderScheduleBlocks). The /dashboard/[eventId]/schedule deep-edit
 * page reads the same table · single source of truth across both surfaces.
 *
 * Brand voice per [[feedback_setnayan_no_dev_text_post_launch]] — copy reads
 * as polite editorial Filipino, no engineering jargon.
 */

import { createClient } from '@/lib/supabase/server';
import {
  fetchScheduleBlocks,
  groupScheduleBlocksByParent,
  type SeedCeremonyType,
} from '@/lib/schedule';
import { seedDefaultScheduleBlocks } from '../../schedule/actions';
import { ScheduleEditor } from './create-schedule-editor';

type Props = {
  eventId: string;
  /** events.event_date · anchors seed defaults to the host's wedding day
   *  when present; falls back to "6 months from today" when null. The
   *  host re-edits each block's time as they refine the plan. */
  eventDate: string | null;
  /** events.ceremony_type · drives the per-faith seed of Ceremony parts
   *  (Catholic gets 12 parts, Civil gets 6, Muslim gets 5, etc.). Defaults
   *  to Catholic when null. */
  ceremonyType: SeedCeremonyType | null;
};

export async function CreateScheduleCard({
  eventId,
  eventDate,
  ceremonyType,
}: Props) {
  const supabase = await createClient();
  let blocks = await fetchScheduleBlocks(supabase, eventId);

  // First-open seed · idempotent (server action checks existing rows
  // and skips if any exist). Fires only when the event has zero blocks.
  if (blocks.length === 0) {
    try {
      await seedDefaultScheduleBlocks(eventId, ceremonyType, eventDate);
      blocks = await fetchScheduleBlocks(supabase, eventId);
    } catch {
      // Seed failure is non-fatal · the editor still renders with the
      // empty payload so the host can [+ Add block] from scratch.
    }
  }

  const grouped = groupScheduleBlocksByParent(blocks);

  return (
    <ScheduleEditor
      eventId={eventId}
      topLevel={grouped.topLevel}
      childrenByParent={grouped.childrenByParent}
    />
  );
}
