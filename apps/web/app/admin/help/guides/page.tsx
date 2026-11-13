import Link from 'next/link';
import { after } from 'next/server';
import { requireAdmin } from '@/lib/admin/require-admin';
import { ADMIN_HELP_TOPICS } from '@/lib/help-admin';
import { askHelp } from '@/lib/help-ask-core';
import { logHelpAsk, readNoAnswerYet, type HelpAskCoverage, type HelpAskOutcome } from '@/lib/help-asks.server';
import { AskBox } from '@/app/_components/help-ask/ask-box';
import { AnswerRows, BestAnswer, NoAnswer, type AnswerCtx } from '@/app/_components/help-ask/help-ask-view';
import { TopicTiles } from '@/app/_components/help-ask/topic-tiles';
import { helpDoorFor, tilesFor } from '@/app/_components/help-ask/help-ask-places';

export const metadata = { title: 'Help · Admin' };

/**
 * ❓ THE TEAM'S HELP — the same ask-first page, inside Setnayan HQ only (owner 13 Nov 2026, "Three helps: user ·
 * supplier · admin": *"so there is a help for users, suppliers and admin"*; prototype v5 § 5b "The wall around team
 * answers"). It reads "Answers for the team" and searches the team guides only (`lib/help-admin.ts` — imported from
 * `app/admin/**` alone; the public help's role type has no team value, so the wall is structural). In place of
 * Message us it shows "No answer yet": what people asked that Help could not answer, most-asked first, across all
 * three helps — so the team writes the missing article.
 *
 * Reached from Setnayan HQ's account sheet (its Help tile).
 */

type Props = { searchParams: Promise<{ q?: string }> };

const ASKED_IN: Record<HelpAskCoverage, string> = {
  user: 'Account',
  supplier: 'Shop',
  guest: 'Guest',
  public: 'Signed out',
  team: 'Team',
};

const GOT: Partial<Record<HelpAskOutcome, string>> = {
  none: 'no answer',
  near: 'only near answers',
  closest: 'closest match shown',
  no: 'answered No',
};

export default async function AdminHelpGuidesPage({ searchParams }: Props) {
  await requireAdmin();
  const { q: rawQ } = await searchParams;
  const q = (rawQ ?? '').trim().slice(0, 120);
  const ask = q ? askHelp(q, ADMIN_HELP_TOPICS) : null;
  if (q && ask) {
    after(() => logHelpAsk({ words: q, coverage: 'team', surface: 'web', outcome: ask.outcome, articleSlug: ask.best?.slug ?? null }));
  }
  const noAnswer = await readNoAnswerYet();

  const ctx: AnswerCtx = {
    words: q,
    coverage: 'team',
    askAgainHref: '/admin/help/guides#ask',
    messageHref: '#no-answer-yet',
    doorFor: (key) => helpDoorFor('team', key),
    kind: 'Team guide',
  };
  const tiles = tilesFor('team', ADMIN_HELP_TOPICS);
  const pages = Object.fromEntries(
    ADMIN_HELP_TOPICS.map((t) => [
      t.key,
      <AnswerRows
        key={t.key}
        group={`help-topic-${t.key}`}
        ctx={{ ...ctx, words: '' }}
        tag={false}
        hits={t.articles.map((a) => ({ slug: a.slug, title: a.title, body: a.body, lead: a.body, topicKey: t.key, topicLabel: t.label, notInApp: false }))}
      />,
    ]),
  );

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-16 pt-6 sm:px-6" data-help-coverage="team">
      <h1 className="sn-h1">Help</h1>
      <div className="mt-4">
        <AskBox q={q} action="/admin/help/guides" clearHref="/admin/help/guides" />
      </div>
      <p className="mt-2 text-sm text-ink/60" data-help-account="">
        Answers for the team
      </p>

      {ask ? (
        <div className="space-y-8">
          {ask.best ? (
            <BestAnswer hit={ask.best} ctx={ctx} />
          ) : (
            <NoAnswer result={ask} ctx={ctx} />
          )}
          {ask.more.length > 0 ? (
            <section aria-label="More team guides">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">More team guides</p>
              <AnswerRows hits={ask.more} group="help-more" ctx={ctx} />
            </section>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8 space-y-8">
        {ask ? null : (
          <section aria-label="Browse topics">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">Browse topics</p>
            <div className="mt-2">
              <TopicTiles topics={tiles} pages={pages} />
            </div>
          </section>
        )}

        <section id="no-answer-yet" aria-label="No answer yet" className="scroll-mt-20" data-help-no-answer-yet="">
          <h2 className="text-lg font-semibold tracking-tight">No answer yet</h2>
          <p className="text-sm text-ink/70">What people asked that Help could not answer.</p>
          {noAnswer.failed ? (
            <p role="alert" className="mt-3 text-sm text-terracotta-700">
              We couldn’t read the list just now. Nothing is lost — try again in a moment.
            </p>
          ) : noAnswer.rows.length === 0 ? (
            <p className="mt-3 text-sm text-ink/60">Nothing yet — every question so far found its answer.</p>
          ) : (
            <ul className="mt-2 divide-y divide-ink/10">
              {noAnswer.rows.map((r) => (
                <li key={`${r.coverage}:${r.words}`} className="py-3">
                  <p className="text-base font-semibold text-ink">“{r.words}”</p>
                  <p className="text-sm text-ink/65">
                    {ASKED_IN[r.coverage]} · asked {r.asked} {r.asked === 1 ? 'time' : 'times'} · {GOT[r.outcome] ?? r.outcome}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-sm">
          <Link href="/admin/help" className="font-medium text-terracotta underline-offset-2 hover:underline">
            Messages ›
          </Link>
        </p>
      </div>
    </div>
  );
}
