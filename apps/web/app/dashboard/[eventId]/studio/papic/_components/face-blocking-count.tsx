import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { InfoTip } from '@/app/_components/info-tip';
import { faceBlockingWords } from '@/lib/face-blocking-words';

/**
 * FACE BLOCKING, READ-ONLY, IN THE PAPIC CARD (owner ruling 2026-10-24, verbatim: *"Face blocking: no event switch.
 * Show 'Face blocking · N guests blurred' on the Papic card; each guest's wish is always honoured."*).
 *
 * ONE row, NO switch: the number of active guests (`deleted_at is null`) who asked to be blurred (`faceblock_enabled`,
 * the guest card's own column — the wall, the pool and the recap bake from it). Each guest chooses on their guest card,
 * and nothing here can override it. A read that fails says so — it never shows 0 (`faceBlockingWords`).
 * Guard: `lib/face-blocking-is-read-only.test.ts`.
 */
export async function FaceBlockingCount({ eventId }: { eventId: string }) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('guests')
    .select('guest_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .eq('faceblock_enabled', true);
  if (error) logQueryError('FaceBlockingCount', error, { event_id: eventId }, 'graceful_degrade');
  return (
    <div className="flex items-center gap-3 py-3" data-papic-setting="face-blocking">
      <span className="min-w-0 flex-1">
        <InfoTip label="Face blocking" labelClassName="text-[15px] font-semibold text-ink" align="start">
          Each guest chooses on their own guest card whether their face is blurred on Memory lane and in shared photos.
          Their choice is always honoured — nothing here can change it.
        </InfoTip>
        <span className="block text-[12.5px] text-ink/60" data-papic-face-blocking-count="">
          {faceBlockingWords(error ? null : (count ?? null))}
        </span>
      </span>
    </div>
  );
}
