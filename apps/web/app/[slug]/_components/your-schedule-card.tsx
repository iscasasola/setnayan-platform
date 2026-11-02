import { contactLine, telHref } from '@/lib/task-contact';
import type { YourScheduleRead } from '../_lib/your-schedule.server';
import { YOUR_SCHEDULE_WORDS, yourScheduleText } from '@/lib/guest-your-schedule';
import { ShareYourSchedule } from './share-your-schedule';

/**
 * 📅 YOUR SCHEDULE — one more `.sn-hub-cards` section on Event Hub › Me, under the name and guests card (owner
 * 2026-11-01; plan §11b, samples `prototypes/schedule_chapters_2026-11-01/shots/me-*.jpg`): "Your schedule" in the
 * display face, the call time large in LINING numerals (Cormorant's default old-style figures read badly at that
 * size), then the chapters with their lines, then Print or share.
 *
 *   · before Release (and on Free, for good): the chapters this guest is invited to; a role holder's call time says
 *     Estimated;
 *   · after Release: their own full schedule and exact call time.
 * What a guest may see is decided in `lib/guest-your-schedule.ts` — this only draws it. Nothing here is live: no
 * socket, no timer (guests hold no live connection).
 *
 * 🛑 A refused read SAYS so in a sentence — never a card with no chapters.
 */
export function YourScheduleCard({ read, eventName }: { read: YourScheduleRead | null; eventName: string }) {
  if (!read) return null;
  if (read.kind === 'unread') {
    return (
      <section data-me-card="schedule" data-your-schedule="unread" className="space-y-2">
        <h2 className="font-serif text-2xl leading-tight text-ink">{YOUR_SCHEDULE_WORDS.title}</h2>
        <p role="status" className="text-sm text-ink/70">
          {YOUR_SCHEDULE_WORDS.unread}
        </p>
      </section>
    );
  }
  const s = read.schedule;
  if (s.kind === 'none') return null;
  return (
    <section data-me-card="schedule" data-your-schedule={s.stage} className="space-y-5">
      <h2 className="font-serif text-2xl leading-tight text-ink">{YOUR_SCHEDULE_WORDS.title}</h2>
      {s.call ? (
        <div data-your-call className="space-y-1">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ink/60">{s.call.label}</p>
          <p className="font-serif text-5xl leading-none text-terracotta lining-nums">{s.call.time}</p>
          {s.call.note ? <p className="pt-1 text-sm text-ink/65">{s.call.note}</p> : null}
        </div>
      ) : null}
      <ol className="divide-y divide-ink/10 border-t border-ink/10">
        {s.chapters.map((c) => (
          <li key={c.id} data-your-chapter={c.id} className="space-y-2 py-4">
            <div>
              <h3 className="font-serif text-xl leading-snug text-ink">{c.name}</h3>
              <p className="text-sm text-ink/60">{c.line}</p>
            </div>
            {c.lines.length > 0 ? (
              <ul className="space-y-2.5 pt-1">
                {c.lines.map((l) => (
                  <li key={l.id} data-your-line={l.mine ? 'mine' : 'everyone'} className="grid grid-cols-[5.5rem_1fr] gap-x-3 text-[15px]">
                    <span className="tabular-nums text-ink/60">{l.time}</span>
                    <span>
                      <span className="block text-ink">{l.title}</span>
                      {l.sub ? <span className="block text-sm text-ink/60">{l.sub}</span> : null}
                      {/* 📇 How to reach someone on their own moment — the bridal-car driver (4 additions (3)). */}
                      {(l.contacts ?? []).map((c) => (
                        <a key={`${c.name}|${c.phone}`} href={telHref(c.phone)} data-your-contact="" className="block text-sm text-ink/70 underline-offset-2 hover:underline">
                          {contactLine(c)}
                        </a>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
      {s.footnote ? <p className="text-sm text-ink/60">{s.footnote}</p> : null}
      <ShareYourSchedule text={yourScheduleText(s, eventName)} label={YOUR_SCHEDULE_WORDS.share} />
    </section>
  );
}
