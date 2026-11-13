import { notFound } from 'next/navigation';
import { HELP_TOPICS, helpTopicsFor } from '@/lib/help';
import { askHelp, askTopicsFor, topicsForCoverage, type HelpCoverage } from '@/lib/help-ask-core';
import { AskBox } from '@/app/_components/help-ask/ask-box';
import { AnswerRows, AnswerWays, BestAnswer, NoAnswer, type AnswerCtx } from '@/app/_components/help-ask/help-ask-view';
import { TopicTiles } from '@/app/_components/help-ask/topic-tiles';
import { helpDoorFor, tilesFor } from '@/app/_components/help-ask/help-ask-places';

/**
 * ❓ THE HELP LAB — the ask-first Help's shipped parts (`app/_components/help-ask/*`) over the REAL answers, with no
 * database and no sign-in, so every account's screen can be seen and shot at 390 px.
 * (The team's help is not drawn here: `lib/help-admin.ts` is imported from `app/admin/**` only.)
 * `?c=user|supplier|guest|public` the account · `&q=…` a question · `&chips=1` draws two "People ask" chips
 * (the live page reads them from the log) · `&app=1` the iPhone app's words · `&event=1` a referring event (doors).
 */
export default async function HelpLabPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const c = (['user', 'supplier', 'guest', 'public'].includes(sp.c ?? '') ? sp.c : 'user') as HelpCoverage;
  const q = (sp.q ?? '').trim();
  const app = sp.app === '1';
  const account = c === 'supplier' ? 'shop' : 'user';
  const listed = topicsForCoverage(helpTopicsFor(HELP_TOPICS, app), c);
  const asked = askTopicsFor(topicsForCoverage(HELP_TOPICS, c), app);
  const ask = q ? askHelp(q, asked) : null;
  const ctx: AnswerCtx = {
    words: q,
    coverage: c,
    askAgainHref: '#ask',
    messageHref: '#contact',
    doorFor: (k) => helpDoorFor(account, k, { eventId: sp.event === '1' ? 'S89E-ABCDEFGHJK' : null, eventName: 'your event' }),
  };
  const tiles = tilesFor(account, listed);
  const pages = Object.fromEntries(
    listed.map((t) => [
      t.key,
      <AnswerRows key={t.key} group={`help-topic-${t.key}`} ctx={{ ...ctx, words: '' }} tag={false} hits={t.articles.map((a) => ({ slug: a.slug, title: a.title, body: a.body, lead: a.body, topicKey: t.key, topicLabel: t.label, notInApp: false }))} />,
    ]),
  );
  const line = { user: 'Answers for your account', supplier: 'Answers for your shop', guest: 'Answers for guests', public: 'Answers about Setnayan' }[c];
  const chips = sp.chips === '1' ? ['How do guests upload photos?', 'How to RSVP'] : [];
  return (
    <main className="min-h-dvh bg-page pb-24">
      <div className="mx-auto w-full max-w-xl px-4 pb-12 pt-6">
        <h1 className="sn-h1">{q ? 'Help' : 'Ask anything'}</h1>
        {q ? null : <p className="mt-1 text-base text-ink/65">Type it your way. English or Tagalog.</p>}
        <div className="mt-4">
          <AskBox q={q} action="/dev/help-lab" keep={{ c }} clearHref={`/dev/help-lab?c=${c}`} />
        </div>
        <p className="mt-2 text-sm text-ink/60">{line}</p>
        {ask ? (
          <div className="space-y-8">
            {ask.best ? (
              <div>
                <BestAnswer hit={ask.best} ctx={ctx} />
                <AnswerWays ctx={ctx} />
              </div>
            ) : (
              <NoAnswer result={ask} ctx={ctx} />
            )}
            {ask.more.length > 0 ? (
              <section>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">More answers</p>
                <AnswerRows hits={ask.more} group="help-more" ctx={ctx} />
              </section>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 space-y-8">
            {chips.length ? (
              <section>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">People ask</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {chips.map((w) => (
                    <li key={w}>
                      <span className="sn-press inline-flex min-h-11 items-center rounded-full border border-ink/15 bg-cream px-4 text-sm text-ink">{w}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <section>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">Browse topics</p>
              <div className="mt-2">
                <TopicTiles topics={tiles} pages={pages} />
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
