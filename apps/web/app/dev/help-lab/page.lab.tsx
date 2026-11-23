/**
 * /dev/help-lab — Help's own parts as a HOST sees them (the Guide & Help drawing, owner "Approved" 21 Nov 2026), with no
 * sign-in and no database: the real views over the real help corpus, guides and tours, in the user account's help with
 * a sample event as `?refer=`. DEV-ONLY: production builds do not compile `page.lab.tsx`, and the first statement 404s
 * in production anyway. Nothing is written: a Yes / No press here posts to the help's action like the real page.
 *
 *   ?screen=home     screen 1 — Help: Ask · Start here · Topics · Message us (default)
 *   ?screen=ask      screen 2 — "paano mag add ng guest": best answer, Take me there · Full guide, More answers
 *   ?screen=topic    screen 3 — a topic (Your guest list): guides on top, answers in place (`&open=<slug>`)
 *   ?screen=guide    screens 4–5 — a guide (Make your guest list) with Take me there at the thumb (`&key=<guide>`)
 *   ?screen=topics   All topics
 * The ⓘ sheet (screen 6) is on /dev/guests-lab (`&spot=page` mounts the page's tour so Show me is drawn).
 */
import { notFound } from 'next/navigation';
import { HELP_TOPICS, helpTopicsFor } from '@/lib/help';
import { askHelp, askTopicsFor, topicsForCoverage } from '@/lib/help-ask-core';
import { findGuide, guideForTopic } from '@/lib/help/guides';
import { inHelp, type HelpPlace } from '@/lib/help/help-place';
import { routes } from '@/lib/routes';
import { HelpStart } from '@/app/_components/help-ask/help-start';
import { MessageUs } from '@/app/_components/help-ask/message-us';
import { AnswerRows, AnswerWays, BestAnswer, type AnswerCtx } from '@/app/_components/help-ask/help-ask-view';
import { helpDoorFor, tilesFor } from '@/app/_components/help-ask/help-ask-places';
import { HelpRow, HelpRows } from '@/app/_components/help-ask/help-rows';
import { HowSearchField } from '@/app/_components/how-search/how-search';
import { submitHelpMessage } from '@/app/help/actions';
import { HelpTopicView } from '@/app/(shell)/(help-pages)/help/topics/[key]/topic-view';
import { HelpGuideView } from '@/app/(shell)/(help-pages)/help/guides/[key]/guide-view';

const LAB_EVENT = 'S89EVT-LAB0000001';
const PLACE: HelpPlace = { coverage: 'user', forParam: undefined, referEvent: LAB_EVENT, account: 'user' };

function LabShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-page pb-24 lg:pb-0">
      <div className="mx-auto w-full max-w-xl px-4 pb-12 pt-6 sm:px-6 sm:pt-10" data-help-coverage="user">
        {children}
      </div>
    </main>
  );
}

const FORM_NOTE = <p className="text-sn-base text-ink/65">The real form is drawn here on /help (lab: no send).</p>;

export default async function HelpLabPage({ searchParams }: { searchParams: Promise<{ screen?: string; key?: string; open?: string; q?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { screen = 'home', key, open, q } = await searchParams;
  const covered = topicsForCoverage(helpTopicsFor(HELP_TOPICS, false), PLACE.coverage);

  if (screen === 'topic') {
    const topic = topicsForCoverage(HELP_TOPICS, PLACE.coverage).find((t) => t.key === (key ?? 'host-guest-list'));
    if (!topic) notFound();
    return <HelpTopicView place={PLACE} topic={topic} storeShell={false} open={open ?? null} />;
  }
  if (screen === 'guide') {
    const guide = findGuide(key ?? 'guests');
    if (!guide) notFound();
    return <HelpGuideView place={PLACE} guide={guide} />;
  }
  if (screen === 'topics') {
    return (
      <LabShell>
        <HelpRows data="all-topics">
          {tilesFor('user', covered).map((t) => (
            <HelpRow key={t.key} title={t.name} href={inHelp(routes.help.topic(t.key), PLACE)} data={t.key} />
          ))}
        </HelpRows>
      </LabShell>
    );
  }
  if (screen === 'ask') {
    const words = q ?? 'paano mag add ng guest';
    const ask = askHelp(words, askTopicsFor(covered, false));
    const ctx: AnswerCtx = {
      words,
      coverage: 'user',
      askAgainHref: '#ask',
      messageHref: '#contact',
      doorFor: (k) => helpDoorFor('user', k, { eventId: LAB_EVENT, eventName: 'your event' }),
      guideFor: (k) => {
        const g = guideForTopic(k, 'user');
        return g ? inHelp(routes.help.guide(g.key), PLACE) : null;
      },
    };
    return (
      <LabShell>
        <h1 className="text-sn-title text-ink">Help</h1>
        <div className="mt-4">
          <HowSearchField q={words} action="/help" keep={{ refer: LAB_EVENT }} at="top" clearHref="/dev/help-lab" ask={{ action: submitHelpMessage, coverage: 'user' }} />
        </div>
        <div className="space-y-8">
          {ask.best ? (
            <div>
              <BestAnswer hit={ask.best} ctx={ctx} />
              <AnswerWays ctx={ctx} />
            </div>
          ) : (
            <p className="mt-5 text-lg font-semibold text-ink">We don’t have an answer for that yet.</p>
          )}
          {ask.more.length > 0 ? (
            <section aria-label="More answers">
              <h2 className="text-sn-xl font-semibold text-ink">More answers</h2>
              <div className="sn-frame mt-2 px-4 py-1">
                <AnswerRows hits={ask.more} group="help-more" ctx={ctx} />
              </div>
            </section>
          ) : null}
        </div>
      </LabShell>
    );
  }
  return (
    <LabShell>
      <h1 className="text-sn-title text-ink">Help</h1>
      <p className="mt-1 text-sn-lg text-ink/65">Ask it your way. English or Tagalog.</p>
      <div className="mt-4">
        <HowSearchField q="" action="/help" keep={{ refer: LAB_EVENT }} at="top" clearHref="/dev/help-lab" ask={{ action: submitHelpMessage, coverage: 'user' }} />
      </div>
      <p className="mt-2 text-sm text-ink/60">Answers for your account</p>
      <div className="mt-2">
        <HelpStart place={PLACE} topics={covered} />
        <MessageUs title="Message us">{FORM_NOTE}</MessageUs>
      </div>
    </LabShell>
  );
}
