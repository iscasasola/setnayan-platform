import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { InfoTip } from '@/app/_components/info-tip';
import { formatCount } from '@/lib/format-number';
import { FaceBlockingSwitches, type FaceBlockGuest } from './face-blocking-switches';

/**
 * FACE BLOCKING — on the Papic page (owner 2026-10-23: Papic holds *"face blocking"*; approved
 * `prototypes/papic_controller_one_page_2026-10-23.html`): "Face blocking · N guests blurred", a search, and one
 * switch per guest — the column the guest card's "Blur their face on the Live Wall" writes (`faceblock_enabled`),
 * through `setGuestFaceblock`. The minor flag (never enrolled for tagging) stays on the guest card.
 * A refused read says so — never "Nobody blurred".
 */
export async function FaceBlockingList({ eventId }: { eventId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('guests')
    .select('guest_id, display_name, name_prefix, first_name, middle_name, last_name, name_suffix, role, extra_roles, faceblock_enabled')
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .order('faceblock_enabled', { ascending: false })
    .order('first_name', { ascending: true })
    .limit(2000);
  if (error) logQueryError('FaceBlockingList.guests', error, { event_id: eventId }, 'graceful_degrade');
  const guests: FaceBlockGuest[] = (data ?? []).map((g) => ({
    id: g.guest_id as string,
    name:
      ((g.display_name as string | null) ?? '').trim() ||
      [g.first_name, g.last_name].filter(Boolean).join(' ').trim() ||
      'A guest',
    role: (g.role as string | null) ?? null,
    on: g.faceblock_enabled === true,
  }));
  const blurred = guests.filter((g) => g.on).length;
  return (
    <section className="flex flex-col gap-2 py-3" data-papic-setting="face-blocking">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <InfoTip label="Face blocking" labelAs="h3" labelClassName="text-[15px] font-semibold text-ink" align="start">
            A guest who would rather not be shown: every face in any shot they are in is blurred on the photo wall and
            in what other guests see, and they are never enrolled for tagging. Set it here or on their guest card; a
            guest can ask for it themselves.
          </InfoTip>
          <span className="block text-[12.5px] text-ink/60" data-face-blocking-line="">
            {error
              ? 'Couldn’t load your guest list'
              : blurred > 0
                ? `${formatCount(blurred)} ${blurred === 1 ? 'guest' : 'guests'} blurred wherever they appear`
                : 'Nobody blurred'}
          </span>
        </span>
      </div>
      {error ? null : <FaceBlockingSwitches eventId={eventId} guests={guests} />}
    </section>
  );
}
