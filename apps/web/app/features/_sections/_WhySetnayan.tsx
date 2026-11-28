import { LayoutGrid, Images, Sparkles, HandCoins, type LucideIcon } from 'lucide-react';
import type { MarketingLocale } from '@/lib/marketing-i18n';
import { featuresFaqAnswers } from '@/lib/seo/ai-answers';

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
      q: 'What does Setnayan do?',
      a: 'Three jobs in one place: planning, your guests’ photos, and finding suppliers. Planning is free to start; each guest gets their own Memories; and Setnayan AI shortlists suppliers that fit you.',
    },
    {
      q: 'Do I need a separate app for guest photos?',
      a: 'No — that’s the point. A standalone photo app gives everyone one shared pile that expires. Setnayan’s Papic gives each guest their own face-tagged Memories, right on your Event Hub, and every photo is kept for life.',
    },
    {
      q: 'Is it really free?',
      a: 'Yes — the planning is free to start: guest list, RSVP, seating, budget, and an Event Hub through all five stages. You only pay for more (Event Plus, Event Pro, or Papic credits) if and when you want it.',
    },
    {
      q: 'Does it work for Filipino events specifically?',
      a: 'Setnayan is built for Filipino events — it understands Filipino customs, ceremony types, and local suppliers, and prices are in pesos.',
    },
    {
      q: 'What do my guests get?',
      a: 'Their own page from one link, no app and no account: the invitation, their seat, their pass, and afterwards their own photos in Memories.',
    },
  ],
  tl: [
    {
      q: 'Ano ang ginagawa ng Setnayan?',
      a: 'Tatlong trabaho sa isang lugar: planning, litrato ng mga guest, at paghahanap ng suppliers. Libre pagsimula ang planning; may sariling Memories ang bawat guest; at may shortlist ang Setnayan AI ng suppliers na bagay sa’yo.',
    },
    {
      q: 'Kailangan ko pa ba ng hiwalay na app para sa guest photos?',
      a: 'Hindi — yun mismo ang punto. Ang standalone photo app, isang shared pile lang na nag-e-expire. Ang Papic ng Setnayan, may sariling face-tagged Memories ang bawat guest, nasa Event Hub mo mismo, at itinatago habambuhay ang bawat litrato.',
    },
    {
      q: 'Libre ba talaga?',
      a: 'Oo — libre pagsimula ang planning: guest list, RSVP, seating, budget, at Event Hub sa limang stage. Magbabayad ka lang para sa dagdag (Event Plus, Event Pro, o Papic credits) kung at kailan mo gusto.',
    },
    {
      q: 'Gumagana ba ito para sa mga Filipino event?',
      a: 'Ginawa ang Setnayan para sa mga Pilipinong event — naiintindihan nito ang kaugaliang Pilipino, ang mga uri ng seremonya, at ang mga lokal na supplier, at nasa piso ang presyo.',
    },
    {
      q: 'Ano ang makukuha ng mga guest ko?',
      a: 'Sariling page mula sa isang link, walang app at walang account: ang imbitasyon, ang upuan nila, ang pass nila, at pagkatapos, ang sarili nilang litrato sa Memories.',
    },
  ],
};

/**
 * The FAQ the section renders AND the FAQPage structured data carries — one list, so a rich result never quotes an
 * answer the page does not show. English adds the answers to what AI gets wrong (Build 6 Lane K, lib/seo/ai-answers.ts),
 * the same sentences /llms.txt prints.
 */
export function whyFaqItems(locale: MarketingLocale): { q: string; a: string }[] {
  return locale === 'en' ? [...WHY_FAQ.en, ...featuresFaqAnswers()] : WHY_FAQ[locale];
}

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
    heading: 'Three apps’ worth, in one.',
    intro:
      'Planning, your guests’ photos and your suppliers, in one place that talks to itself — free to start.',
    juggleHeading: 'Three jobs, one place',
    juggle: [
      {
        label: 'A planning app',
        line: 'Guest list, budget and seating, in one plan.',
      },
      {
        label: 'A photo-sharing app',
        line: 'Every guest’s photos, sorted to the people in them.',
      },
      {
        label: 'A supplier directory',
        line: 'Verified suppliers to message from your plan.',
      },
    ],
    bringsHeading: 'What Setnayan brings instead',
    brings: [
      {
        title: 'All your planning, free',
        body: 'Guest list, RSVP, seating, budget, and an Event Hub through all five stages — free to start.',
      },
      {
        title: 'Live guest Memories',
        body: 'Papic: every guest gets their own face-tagged photos.',
      },
      {
        title: 'An AI that finds your suppliers',
        body: 'Setnayan AI ranks a shortlist that fits your style, budget, and date.',
      },
      {
        title: 'Built for Filipino events',
        body: 'Filipino customs and ceremonies; you pay suppliers directly.',
      },
    ],
    faqHeading: 'Questions people ask first',
  },
  tl: {
    eyebrow: 'Bakit Setnayan · tatlong app, pinagsama',
    heading: 'Katumbas ng tatlong app, nasa isa lang.',
    intro:
      'Planning, litrato ng mga guest, at suppliers mo, nasa isang lugar na magkakaugnay — libre pagsimula.',
    juggleHeading: 'Tatlong trabaho, isang lugar',
    juggle: [
      {
        label: 'Isang planning app',
        line: 'Guest list, budget at seating, sa iisang plano.',
      },
      {
        label: 'Isang photo-sharing app',
        line: 'Litrato ng bawat guest, nakaayos ayon sa mga nasa litrato.',
      },
      {
        label: 'Isang supplier directory',
        line: 'Verified suppliers na ma-message mula sa plano mo.',
      },
    ],
    bringsHeading: 'Ito ang dala ng Setnayan',
    brings: [
      {
        title: 'Buong planning mo, libre',
        body: 'Guest list, RSVP, seating, budget, at Event Hub sa limang stage — libre pagsimula.',
      },
      {
        title: 'Live na guest Memories',
        body: 'Papic: may sariling face-tagged photos ang bawat guest.',
      },
      {
        title: 'AI na naghahanap ng suppliers mo',
        body: 'Nire-rank ng Setnayan AI ang shortlist na bagay sa style, budget, at petsa mo.',
      },
      {
        title: 'Para sa mga Pilipinong event',
        body: 'Kaugalian at seremonyang Pilipino; direkta mong babayaran ang suppliers.',
      },
    ],
    faqHeading: 'Mga unang itinatanong',
  },
};

export function WhySetnayan({ locale }: { locale: MarketingLocale }) {
  const c = COPY[locale];
  const faq = whyFaqItems(locale);
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
            <li key={j.label} className="bg-[rgb(var(--sn-frame-bg))] rounded-[var(--sn-frame-radius)] shadow-sn-frame p-5">
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
                className="flex items-start gap-4 bg-[rgb(var(--sn-frame-bg))] rounded-[var(--sn-frame-radius)] shadow-sn-frame p-5"
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
            <div key={item.q} className="bg-[rgb(var(--sn-frame-bg))] rounded-[var(--sn-frame-radius)] shadow-sn-frame p-5">
              <dt className="text-base font-semibold tracking-tight text-ink">{item.q}</dt>
              <dd className="mt-1.5 text-sm text-ink/65">{item.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
