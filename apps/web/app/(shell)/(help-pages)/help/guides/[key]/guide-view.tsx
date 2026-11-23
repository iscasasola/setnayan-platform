import Image from 'next/image';
import { ArrowRight, MessageSquare } from 'lucide-react';
import { guideDoorHref, guideShot, guideSteps, minutesLine, stepsLine, type HelpGuide } from '@/lib/help/guides';
import { inHelp, type HelpPlace } from '@/lib/help/help-place';
import { routes } from '@/lib/routes';
import { BackButton } from '@/app/_components/back-button';
import { ActionButton } from '@/components/action-button';
import { ThumbDock } from '@/components/thumb-dock';
import { AnswerFeedback } from '@/app/_components/help-ask/answer-feedback';
import { GuideMore } from '@/app/_components/help-ask/guide-more';

/** A guide, drawn (the page reads the account and the guide once — `page.tsx`; the dev lab draws the same view). */
export function HelpGuideView({ place, guide }: { place: HelpPlace; guide: HelpGuide }) {
  const steps = guideSteps(guide);
  const shot = guideShot(guide);

  const help = routes.help.index();
  const door = place.referEvent ? guideDoorHref(guide, place.referEvent) : null;
  const reportHref = inHelp(help, place, { topic: 'bug', subject: `Problem with the guide: ${guide.title}` }, 'contact');
  const askHref = inHelp(help, place, { topic: 'couple', subject: `Question about the guide: ${guide.title}` }, 'contact');

  return (
    <main className="min-h-dvh bg-page pb-32 lg:pb-0">
      <div className="mx-auto w-full max-w-xl px-4 pb-12 pt-3 sm:px-6 sm:pt-6" data-help-guide={guide.key}>
        <div className="-mx-2 flex items-center justify-between">
          <BackButton route="/help/guides/[key]" variant="chat" />
          <GuideMore reportHref={reportHref} />
        </div>

        <p className="mt-2 text-sn-sm font-semibold uppercase tracking-wide text-ink/55">Guide · {guide.audience}</p>
        <h1 className="mt-1 text-sn-title text-ink">{guide.title}</h1>
        <p className="mt-2 text-sn-lg text-ink/60">
          {stepsLine(steps.length)} · {minutesLine(steps.length)}
        </p>

        <ol className="mt-8 space-y-8" data-guide-steps="">
          {steps.map((s, i) => (
            <li key={`${i}-${s.title}`} className="flex gap-3" data-guide-step={i + 1}>
              <span aria-hidden className="grid h-8 w-8 flex-none place-items-center rounded-full bg-terracotta/10 text-sn-base font-semibold text-terracotta-700">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sn-xl font-semibold text-ink">
                  <span className="sr-only">Step {i + 1}: </span>
                  {s.title}
                </h2>
                <p className="mt-1 text-sn-lg text-ink/65">{s.body}</p>
                {i === 0 && shot ? (
                  <Image
                    src={shot.src}
                    alt={shot.alt}
                    width={460}
                    height={972}
                    sizes="(min-width: 640px) 320px, 70vw"
                    className="mt-4 h-48 w-full rounded-2xl object-cover object-top shadow-sn-frame"
                    data-guide-shot=""
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        <section aria-label="Did this help?" className="sn-frame mt-8 px-4 pb-4 pt-1" data-guide-feedback="">
          <AnswerFeedback
            slug={`guide:${guide.key}`}
            words=""
            coverage={place.coverage}
            question="Did this help?"
            askAgainHref={inHelp(help, place, {}, 'ask')}
            messageHref={askHref}
          />
        </section>

        <div className="mt-4 grid">
          <ActionButton tone="neutral" icon={<MessageSquare aria-hidden className="h-4 w-4" strokeWidth={1.75} />} label="Ask a question" href={askHref} />
        </div>
      </div>

      {door ? (
        <ThumbDock noBar>
          <div className="mx-auto grid w-full max-w-xl px-4 pb-3" data-guide-door="">
            <ActionButton tone="brand" main icon={<ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />} label="Take me there" href={door} />
          </div>
        </ThumbDock>
      ) : null}
    </main>
  );
}
