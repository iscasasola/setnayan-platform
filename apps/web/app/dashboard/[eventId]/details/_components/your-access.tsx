import { InfoTip } from '@/app/_components/info-tip';
import { AREA_LEVEL_WORD } from '@/lib/delegate-areas';
import { OWN_ACCESS_TIP, accessDayLabel, askableParts, type OwnAccess } from '@/lib/people-with-access';
import { AskTheHosts } from './ask-the-hosts';

/**
 * your-access.tsx — 🪪 YOUR ACCESS — a HELPER's own seat, READ-ONLY, the first row of Home's ⚙ Event Settings (owner 2026-10-31,
 * DECISION_LOG "A HELPER SEES THEIR OWN ACCESS AS THE FIRST ROW OF HOME ⚙ EVENT SETTINGS"). The same cells the hosts'
 * row for this person draws (`ownAccessOf` → `areaCells`), as WORDS: nothing here is pressable, so nothing is framed —
 * no toggle, no pill, a divider between parts (frames only on what you press). The role (and until when) is the one
 * visible line; what View · Edit · Off mean is its ⓘ.
 *
 * Its own file, beside People with access (the hosts' editor of the same cells): it imports no action, so it draws
 * wherever a seat's own access is read — and a test can render it.
 *
 * 🪪 ASK THE HOSTS (owner 2026-10-31, "yes"): the ONE press here besides the ⓘ, under the parts ("then at the bottom") —
 * `AskTheHosts` opens its own sheet; the parts themselves stay words. Not drawn when there is nothing more to ask for.
 */
export function YourAccess({ access, eventId, askedAt = null }: { access: OwnAccess; eventId: string; askedAt?: string | null }) {
  return (
    <div data-your-access="" className="space-y-1">
      <p className="text-[12.5px] text-ink/60" data-your-access-role="">
        <InfoTip label={`${access.roleWord}${access.lastDay ? ` · until ${accessDayLabel(access.lastDay)}` : ''}`} align="start">
          {OWN_ACCESS_TIP}
        </InfoTip>
      </p>
      <ul className="divide-y divide-ink/5" data-your-access-areas="">
        {access.areas.map((cell) => (
          <li key={cell.area} className="flex min-h-11 items-center justify-between gap-3 py-1" data-area={cell.area} data-level={cell.choice}>
            <span className="min-w-0 text-[13px] text-ink/75">{cell.label}</span>
            <span className={`shrink-0 text-[13px] ${cell.choice === 'off' ? 'text-ink/45' : 'font-medium text-ink'}`}>
              {AREA_LEVEL_WORD[cell.choice]}
            </span>
          </li>
        ))}
      </ul>
      {askableParts(access.areas).length > 0 ? (
        <div className="pt-2" data-your-access-ask="">
          <AskTheHosts eventId={eventId} areas={access.areas} askedAt={askedAt} />
        </div>
      ) : null}
    </div>
  );
}
