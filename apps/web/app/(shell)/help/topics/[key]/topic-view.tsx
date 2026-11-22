import type { HelpTopic } from '@/lib/help';
import { guideSteps, guidesInTopic, stepsLine } from '@/lib/help/guides';
import { inHelp, type HelpPlace } from '@/lib/help/help-place';
import { routes } from '@/lib/routes';
import { BackButton } from '@/app/_components/back-button';
import { AnswerRows, type AnswerCtx } from '@/app/_components/help-ask/help-ask-view';
import { helpDoorFor, tilesFor } from '@/app/_components/help-ask/help-ask-places';
import { GuideRow, HelpRows, HelpSection } from '@/app/_components/help-ask/help-rows';

/**
 * A topic, drawn (the page reads the account and the topic once and hands them in — `page.tsx`; the dev lab draws the
 * same view as a host, `app/dev/help-lab`). Guides on top, answers one open at a time; `open` is the answer drawn
 * already open (a page's ⓘ links to it).
 */
export function HelpTopicView({ place, topic, open = null }: { place: HelpPlace; topic: HelpTopic; open?: string | null }) {
  const [tile] = tilesFor(place.account, [topic]);
  const guides = guidesInTopic(topic.key, place.coverage);
  const help = routes.help.index();
  const ctx: AnswerCtx = {
    words: '',
    coverage: place.coverage,
    askAgainHref: inHelp(help, place, {}, 'ask'),
    messageHref: inHelp(help, place, {}, 'contact'),
    doorFor: (topicKey) => helpDoorFor(place.account, topicKey, { eventId: place.referEvent, eventName: place.referEvent ? 'your event' : null }),
  };

  return (
    <main className="min-h-dvh bg-page pb-24 lg:pb-0">
      <div className="mx-auto w-full max-w-xl px-4 pb-12 pt-3 sm:px-6 sm:pt-6" data-help-topic={topic.key} data-help-coverage={place.coverage}>
        <BackButton route="/help/topics/[key]" variant="chat" className="-ml-2" />
        <h1 className="mt-2 text-sn-title text-ink">{tile?.name ?? topic.label}</h1>
        {tile?.line ? <p className="mt-1 text-sn-lg text-ink/65">{tile.line}</p> : null}

        {guides.length > 0 ? (
          <HelpSection title="Guides" data="guides">
            <HelpRows data="guides">
              {guides.map((g) => (
                <GuideRow key={g.key} title={g.title} steps={stepsLine(guideSteps(g).length)} href={inHelp(routes.help.guide(g.key), place)} data={g.key} />
              ))}
            </HelpRows>
          </HelpSection>
        ) : null}

        <HelpSection title="Answers" data="answers">
          <div className="sn-frame px-4 py-1">
            <AnswerRows
              group={`help-topic-${topic.key}`}
              ctx={ctx}
              tag={false}
              open={open}
              hits={topic.articles.map((a) => ({ slug: a.slug, title: a.title, body: a.body, lead: a.body, topicKey: topic.key, topicLabel: topic.label, notInApp: false }))}
            />
          </div>
        </HelpSection>
      </div>
    </main>
  );
}
