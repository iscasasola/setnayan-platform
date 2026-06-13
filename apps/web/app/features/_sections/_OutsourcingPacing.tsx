import { UserCog, Clock, CalendarRange, type LucideIcon } from 'lucide-react';
import type { MarketingLocale } from '@/lib/marketing-i18n';

// Outsourcing, pacing, scheduling — recipient of the Section 7 content
// dropped from the homepage in the 2026-05-15 Decision 4 redesign
// (per /Users/icecasasola/Documents/Claude/Projects/Setnayan/0015_main_website/0015_main_website.md
// § "Replaced wholesale on 2026-05-15"). Three columns: outsourcing
// (planner / coordinator / stylist with role-scoped access), pacing
// (auto-generated milestones per event type), scheduling (unified calendar
// across iterations 0006 / 0007 / 0001).
//
// Bilingual (EN + Taglish). ICONS is language-neutral and zips with
// COPY[locale].columns by index — keep both arrays in lockstep.

const ICONS: LucideIcon[] = [UserCog, Clock, CalendarRange];

const COPY: Record<
  MarketingLocale,
  {
    eyebrow: string;
    heading: string;
    intro: string;
    columns: { title: string; sub: string; body: string; items: string[] }[];
  }
> = {
  en: {
    eyebrow: 'Section 5 · Operating layer',
    heading: 'Outsource what you can, pace what you can’t, schedule what you must.',
    intro:
      'Setnayan is the operating layer underneath the planning surface you see. Bring in helpers safely. Let the platform pace the work for you. Keep one calendar that reflects everything with a date on it.',
    columns: [
      {
        title: 'Outsourcing',
        sub: 'Bring in your planner, coordinator, or stylist — without handing over the whole account.',
        body: 'Setnayan supports role-scoped access for the people you bring in to help. A planner sees the full plan: budget, vendors, timeline. A day-of coordinator sees just the day-of run-of-show plus the vendors on the day. A stylist sees the mood board and the venue, nothing else. Each role has its own login, its own view, its own audit trail. Add or remove access in seconds — no shared passwords, no over-exposure.',
        items: [
          'Planner — full ledger, budget, vendor contracts, timeline.',
          'Day-of coordinator — run-of-show + day-of vendors only.',
          'Stylist — mood board, palette, venue diagrams.',
          'Family helper — guest list + RSVP tracking only.',
        ],
      },
      {
        title: 'Pacing',
        sub: 'Auto-generated milestones for every event type — you can’t fall behind on a deadline you don’t know about.',
        body: 'Tell Setnayan your event date and event type. Setnayan generates a milestone schedule for you — venue lock by month -10, photographer by -8, catering tasting by -5, RSVP cutoff by -2. Each milestone has a recommended action and a due date. Mark complete as you go; we adjust downstream milestones. Three event-type templates ship at V1.',
        items: [
          'Wedding — 12-month standard timeline.',
          'Corporate launch — 6-month timeline.',
          'Birthday — 2-month timeline.',
          'Custom — build your own from scratch.',
        ],
      },
      {
        title: 'Scheduling',
        sub: 'One calendar for everything that has a date attached to it.',
        body: 'Vendor meetings, payment deadlines, RSVP cutoffs, dress fittings, food tastings, the day-of run-of-show — all rendered into a single calendar surface. Subscribe to the .ics feed; your phone’s native calendar reflects the latest at all times. Filter by what you care about (vendors, payments, family events) and the unified view re-renders.',
        items: [
          'Vendor meetings — pulled from your vendor list.',
          'Payment deadlines — pulled from your budget.',
          'RSVP cutoffs — pulled from your guest list.',
          'Day-of run-of-show — the day, minute by minute.',
        ],
      },
    ],
  },
  tl: {
    eyebrow: 'Section 5 · Operating layer',
    heading: 'I-outsource ang kaya, i-pace ang hindi, i-schedule ang dapat.',
    intro:
      'Ang Setnayan ang operating layer sa ilalim ng planning surface na nakikita mo. Magpasok ng helpers nang ligtas. Hayaan ang platform na mag-pace ng trabaho para sa’yo. Panatilihin ang isang calendar na sumasalamin sa lahat ng may petsa.',
    columns: [
      {
        title: 'Outsourcing',
        sub: 'Isama ang planner, coordinator, o stylist mo — nang hindi ibinibigay ang buong account.',
        body: 'May role-scoped access ang Setnayan para sa mga taong isasama mo para tumulong. Nakikita ng planner ang buong plano: budget, vendors, timeline. Ang day-of coordinator, nakikita lang ang day-of run-of-show plus ang vendors sa araw na ‘yun. Ang stylist, nakikita ang mood board at ang venue, wala nang iba. May sariling login, sariling view, at sariling audit trail ang bawat role. Magdagdag o mag-alis ng access sa ilang segundo — walang shared passwords, walang sobrang exposure.',
        items: [
          'Planner — buong ledger, budget, vendor contracts, timeline.',
          'Day-of coordinator — run-of-show + day-of vendors lang.',
          'Stylist — mood board, palette, venue diagrams.',
          'Family helper — guest list + RSVP tracking lang.',
        ],
      },
      {
        title: 'Pacing',
        sub: 'Auto-generated milestones para sa bawat event type — hindi ka pwedeng ma-late sa deadline na hindi mo alam.',
        body: 'Sabihin mo lang sa Setnayan ang event date at event type mo. Gagawa ang Setnayan ng milestone schedule para sa’yo — venue lock by month -10, photographer by -8, catering tasting by -5, RSVP cutoff by -2. May recommended action at due date ang bawat milestone. I-mark na complete habang umuusad; ina-adjust namin ang mga susunod na milestone. Tatlong event-type template ang ship sa V1.',
        items: [
          'Wedding — 12-month standard timeline.',
          'Corporate launch — 6-month timeline.',
          'Birthday — 2-month timeline.',
          'Custom — gawin ang sarili mo from scratch.',
        ],
      },
      {
        title: 'Scheduling',
        sub: 'Isang calendar para sa lahat ng may petsang nakakabit.',
        body: 'Vendor meetings, payment deadlines, RSVP cutoffs, dress fittings, food tastings, ang day-of run-of-show — lahat nila-render sa iisang calendar surface. I-subscribe ang .ics feed; ang native calendar ng phone mo ay laging updated. I-filter ayon sa importante sa’yo (vendors, payments, family events) at nire-render ulit ang unified view.',
        items: [
          'Vendor meetings — kinuha mula sa vendor list mo.',
          'Payment deadlines — kinuha mula sa budget mo.',
          'RSVP cutoffs — kinuha mula sa guest list mo.',
          'Day-of run-of-show — ang araw, minuto por minuto.',
        ],
      },
    ],
  },
};

export function OutsourcingPacing({ locale }: { locale: MarketingLocale }) {
  const c = COPY[locale];
  return (
    <section
      id="outsourcing-pacing"
      aria-labelledby="outsourcing-pacing-heading"
      className="scroll-mt-24 border-b border-ink/5"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <header className="mb-12 max-w-2xl space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            {c.eyebrow}
          </p>
          <h2
            id="outsourcing-pacing-heading"
            className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
          >
            {c.heading}
          </h2>
          <p className="text-base text-ink/65">{c.intro}</p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {c.columns.map((col, i) => {
            const Icon = ICONS[i]!;
            return (
              <article
                key={col.title}
                className="flex flex-col gap-4 rounded-2xl border border-ink/10 bg-cream p-6"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
                  <Icon aria-hidden className="h-6 w-6" strokeWidth={1.75} />
                </span>
                <h3 className="text-2xl font-semibold tracking-tight text-ink">
                  {col.title}
                </h3>
                <p
                  className="text-sm font-medium text-ink/80"
                  dangerouslySetInnerHTML={{ __html: col.sub }}
                />
                <p
                  className="text-sm text-ink/65"
                  dangerouslySetInnerHTML={{ __html: col.body }}
                />
                <ul className="mt-2 space-y-2 border-t border-ink/5 pt-4">
                  {col.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-xs text-ink/65"
                    >
                      <span
                        aria-hidden
                        className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta"
                      />
                      <span dangerouslySetInnerHTML={{ __html: item }} />
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
