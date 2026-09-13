import { LayoutGrid, Images, Sparkles, HandCoins, type LucideIcon } from 'lucide-react';
import type { MarketingLocale } from '@/lib/marketing-i18n';

// Why Setnayan — the differentiation frame, folded in from the standalone
// /why-setnayan page (retired 2026-09-01; that URL now 301s here).
//
// ─── WHY IT LIVES HERE NOW ──────────────────────────────────────────────────
// /why-setnayan, /how-it-works and /features were three separate explainers
// answering one question between them, and only /features had the bilingual
// dictionary architecture. Merging into this page keeps the strongest URL and
// its EN↔TL hreflang pair, and gives the differentiation frame a Taglish
// edition it never had (it was English-only).
//
// ─── THE GUARDRAILS CARRIED OVER VERBATIM FROM THE OLD PAGE ─────────────────
// They are the reason the copy reads the way it does; losing them in the move
// is how a careful public claim becomes a careless one.
//  - Non-disparaging + truthful: frames the moat as "three apps' worth in one"
//    (planning app + photo app + vendor directory), NOT a competitor scorecard.
//    Names NO competitor and makes no blanket claim about a named rival
//    (public-surface hygiene + legal safety).
//  - Benefits only; NO hardcoded prices. "0% commission" and "free to start"
//    are stated facts, not SKU amounts — amounts live on /pricing and in
//    `platform_retail_catalog_v2`, never in marketing copy.
//
// ⚠ THE WEDDING FRAMING IS DELIBERATE AND WAS LEFT ALONE. Seventeen celebration
// types are live (measured in production 2026-09-01), so "wedding" is narrower
// than the product — but this is owner-approved, SEO-tuned positioning copy and
// broadening it is a marketing decision, not a defect fix. Flagged for the
// owner rather than silently rewritten. Contrast `_HowItWorks.tsx`, where the
// wedding-only framing WAS corrected because it stated something false.
//
// Bilingual (EN + Taglish). Icons are language-neutral and zip with
// COPY[locale].brings by index — keep the arrays the same length + order.

const BRING_ICONS: LucideIcon[] = [LayoutGrid, Images, Sparkles, HandCoins];

/**
 * The FAQ is rendered here AND emitted as FAQPage JSON-LD by `_PageBody`.
 * ⚠ ONE SOURCE. `/why-setnayan` carried this markup and its schema in one file;
 * split across two here, they would drift, and a rich result quoting an answer
 * the page no longer shows is worse than no rich result. Exported for that
 * reason — the schema builder reads THIS, never a second copy.
 */
export const WHY_FAQ: Record<MarketingLocale, { q: string; a: string }[]> = {
  en: [
    {
      q: 'How is Setnayan different from other wedding apps?',
      a: 'Most tools do one job — planning, or photo-sharing, or a vendor list. Setnayan does all three in one place, free to start, and adds what the others don’t have: a live per-guest photo gallery, personal video reels, and an AI that finds the vendors that fit you.',
    },
    {
      q: 'Do I need a separate app for guest photos?',
      a: 'No — that’s the point. A standalone photo app gives everyone one shared pile that expires. Setnayan’s Papic gives each guest their own face-tagged gallery and a personal reel, right on your event site, and you keep every photo.',
    },
    {
      q: 'Is it really free?',
      a: 'Yes — the planning is free to start: guest list, RSVP, seating, budget, and a 4-in-1 Event Hub. You only pay for the premium experiences (like Papic or Setnayan AI) if and when you want them.',
    },
    {
      q: 'Does it work for Filipino celebrations specifically?',
      a: 'Setnayan is built Philippines-first — it understands Filipino customs, ceremony types, and local vendors, and books at 0% commission. It’s not a generic planner with a PHP price tag bolted on.',
    },
    {
      q: 'What does Setnayan bring that I can’t get elsewhere?',
      a: 'The media layer: every guest goes home with their own photos and a souvenir reel, and an AI shortlist of vendors that actually fit — woven into the same free platform that handles your whole plan.',
    },
  ],
  tl: [
    {
      q: 'Ano ang pinagkaiba ng Setnayan sa ibang wedding apps?',
      a: 'Karamihan ng tools, isang trabaho lang ang ginagawa — planning, o photo-sharing, o listahan ng vendor. Ang Setnayan, tatlo lahat sa isang lugar, libre pagsimula, at may dagdag pa na wala sa iba: live na per-guest photo gallery, personal na video reels, at AI na naghahanap ng vendors na bagay sa’yo.',
    },
    {
      q: 'Kailangan ko pa ba ng hiwalay na app para sa guest photos?',
      a: 'Hindi — yun mismo ang punto. Ang standalone photo app, isang shared pile lang na nag-e-expire. Ang Papic ng Setnayan, may sariling face-tagged gallery at personal reel ang bawat guest, nasa event site mo mismo, at sa’yo nananatili ang lahat ng photo.',
    },
    {
      q: 'Libre ba talaga?',
      a: 'Oo — libre pagsimula ang planning: guest list, RSVP, seating, budget, at 4-in-1 Event Hub. Magbabayad ka lang para sa mga premium experience (tulad ng Papic o Setnayan AI) kung at kailan mo gusto.',
    },
    {
      q: 'Gumagana ba ito para sa Filipino celebrations?',
      a: 'Philippines-first ang pagkakagawa ng Setnayan — naiintindihan nito ang kaugaliang Pilipino, ang mga uri ng seremonya, at ang mga lokal na vendor, at 0% commission ang booking. Hindi ito generic na planner na tinapalan lang ng presyong PHP.',
    },
    {
      q: 'Ano ang dala ng Setnayan na wala sa iba?',
      a: 'Ang media layer: bawat guest, may sariling photos at souvenir reel na iuuwi, at may AI shortlist ng vendors na talagang bagay — habol sa iisang libreng platform na humahawak sa buong plano mo.',
    },
  ],
};

const COPY: Record<
  MarketingLocale,
  {
    eyebrow: string;
    heading: string;
    intro: string;
    juggleHeading: string;
    juggle: { label: string; line: string }[];
    bringsHeading: string;
    brings: { title: string; body: string }[];
    faqHeading: string;
  }
> = {
  en: {
    eyebrow: 'Why Setnayan · three apps’ worth, in one',
    heading: 'Three apps’ worth of celebration, in one.',
    intro:
      'To do what Setnayan does, you’d normally juggle a planning app, a separate guest-photo app, and a vendor directory — none of which talk to each other. Setnayan brings them together, free to start, and adds what none of them have.',
    juggleHeading: 'What you’d otherwise juggle',
    juggle: [
      {
        label: 'A planning app',
        line: 'Guest list, budget, seating — but no live guest gallery, and no AI that finds your vendors.',
      },
      {
        label: 'A photo-sharing app',
        line: 'One shared pile of photos that expires in weeks — no per-guest galleries, no reels, and nothing to do with your plan.',
      },
      {
        label: 'A vendor directory',
        line: 'A list to scroll through yourself — no matching, and rarely 0% commission.',
      },
    ],
    bringsHeading: 'What Setnayan brings instead',
    brings: [
      {
        title: 'All your planning, free',
        body: 'Guest list, RSVP, seating, budget, and a 4-in-1 Event Hub — free to start.',
      },
      {
        title: 'A live guest photo gallery',
        body: 'Papic: every guest gets their own face-tagged photos and a personal video reel.',
      },
      {
        title: 'An AI that finds your vendors',
        body: 'Setnayan AI ranks a shortlist that fits your style, budget, and date — not a thousand listings.',
      },
      {
        title: '0% commission, Filipino-first',
        body: 'Built for Filipino celebrations and customs; book your vendors at zero commission, always.',
      },
    ],
    faqHeading: 'Questions people ask first',
  },
  tl: {
    eyebrow: 'Bakit Setnayan · tatlong app, pinagsama',
    heading: 'Katumbas ng tatlong app, nasa isa lang.',
    intro:
      'Para magawa ang ginagawa ng Setnayan, kadalasan kailangan mong hawakan ang planning app, hiwalay na guest-photo app, at vendor directory — na walang pinag-uusapan sa isa’t isa. Pinagsasama sila ng Setnayan, libre pagsimula, at may dagdag pa na wala sa kahit isa sa kanila.',
    juggleHeading: 'Ang tatlong hawak mo kung wala ito',
    juggle: [
      {
        label: 'Isang planning app',
        line: 'Guest list, budget, seating — pero walang live na guest gallery, at walang AI na maghahanap ng vendors mo.',
      },
      {
        label: 'Isang photo-sharing app',
        line: 'Isang shared pile ng litrato na nag-e-expire sa loob ng ilang linggo — walang per-guest gallery, walang reels, at walang kinalaman sa plano mo.',
      },
      {
        label: 'Isang vendor directory',
        line: 'Listahan na ikaw mismo ang mag-i-scroll — walang matching, at bihirang 0% commission.',
      },
    ],
    bringsHeading: 'Ito ang dala ng Setnayan',
    brings: [
      {
        title: 'Buong planning mo, libre',
        body: 'Guest list, RSVP, seating, budget, at 4-in-1 Event Hub — libre pagsimula.',
      },
      {
        title: 'Live na guest photo gallery',
        body: 'Papic: may sariling face-tagged photos at personal video reel ang bawat guest.',
      },
      {
        title: 'AI na naghahanap ng vendors mo',
        body: 'Nire-rank ng Setnayan AI ang shortlist na bagay sa style, budget, at petsa mo — hindi libo-libong listing.',
      },
      {
        title: '0% commission, Filipino-first',
        body: 'Ginawa para sa mga Pilipinong pagdiriwang at kaugalian; i-book ang vendors mo nang zero commission, palagi.',
      },
    ],
    faqHeading: 'Mga unang itinatanong',
  },
};

export function WhySetnayan({ locale }: { locale: MarketingLocale }) {
  const c = COPY[locale];
  const faq = WHY_FAQ[locale];
  return (
    <section
      id="why-setnayan"
      aria-labelledby="why-setnayan-heading"
      className="scroll-mt-24 border-b border-ink/5 bg-cream"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <header className="mb-10 max-w-2xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-terracotta">
            {c.eyebrow}
          </p>
          <h2
            id="why-setnayan-heading"
            className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
          >
            {c.heading}
          </h2>
          <p className="text-base text-ink/65">{c.intro}</p>
        </header>

        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink/50">
          {c.juggleHeading}
        </h3>
        <ul className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {c.juggle.map((j) => (
            <li key={j.label} className="rounded-xl border border-ink/10 bg-cream p-5">
              <h4 className="text-base font-semibold tracking-tight text-ink">{j.label}</h4>
              <p className="mt-1.5 text-sm text-ink/65">{j.line}</p>
            </li>
          ))}
        </ul>

        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink/50">
          {c.bringsHeading}
        </h3>
        <ul className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {c.brings.map((b, i) => {
            const Icon = BRING_ICONS[i]!;
            return (
              <li
                key={b.title}
                className="flex items-start gap-4 rounded-xl border border-ink/10 bg-cream p-5"
              >
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
                  <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="space-y-1.5">
                  <h4 className="text-base font-semibold tracking-tight text-ink">{b.title}</h4>
                  <p className="text-sm text-ink/65">{b.body}</p>
                </div>
              </li>
            );
          })}
        </ul>

        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink/50">
          {c.faqHeading}
        </h3>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {faq.map((item) => (
            <div key={item.q} className="rounded-xl border border-ink/10 bg-cream p-5">
              <dt className="text-base font-semibold tracking-tight text-ink">{item.q}</dt>
              <dd className="mt-1.5 text-sm text-ink/65">{item.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
