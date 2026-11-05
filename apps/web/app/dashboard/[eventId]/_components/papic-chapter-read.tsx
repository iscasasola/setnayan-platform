import { createClient } from '@/lib/supabase/server';
import { readPapicChapters } from '@/lib/papic-chapter.server';
import { PapicChapterRow } from './papic-chapter-row';

/**
 * 📷 The Papic card's chapter row, read on the server (owner 2026-11-01, "THE PAPIC CARD ON HOME SHOOTS INTO A CHAPTER"):
 * ONE call (`papic_event_chapters`) on the couple's own client, streamed behind the card's face. A failed read is handed
 * on as null, and the row says so — never "Whole event".
 */
export async function PapicChapterRead({ eventId }: { eventId: string }) {
  const supabase = await createClient();
  const read = await readPapicChapters(supabase, eventId);
  return <PapicChapterRow eventId={eventId} chapters={read.ok ? read.value : null} nowMs={Date.now()} />;
}
