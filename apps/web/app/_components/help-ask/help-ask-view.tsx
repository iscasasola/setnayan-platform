import { ArrowRight, ChevronDown, MessageSquare, RotateCcw } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import type { AskHit, AskResult } from '@/lib/help-ask-core';
import type { HelpDoor } from './help-ask-places';
import { AnswerFeedback } from './answer-feedback';

/**
 * THE ASK-FIRST HELP — its server-drawn parts (approved prototype
 * `Setnayan-specs/prototypes/approved_2026-11-13/help-page-fable.html` v5, owner "help approved" 13 Nov 2026).
 * One set of parts for the three helps — the user's and the shop's on /help, the team's inside Setnayan HQ — so the
 * three never drift apart. The answers themselves are read from the help corpora; nothing here writes one.
 */

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="block text-xs font-semibold text-terracotta-700">{children}</span>;
}

/** "Take me there" + the line under it. No door, no button. */
function Door({ door, main }: { door: HelpDoor | null; main?: boolean }) {
  if (!door) return null;
  return (
    <div className="mt-3">
      <ActionButton
        tone="brand"
        main={main}
        icon={<ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
        label="Take me there"
        href={door.href}
      />
      <p className="mt-1 text-xs text-ink/60">Opens {door.opens}.</p>
    </div>
  );
}

export type AnswerCtx = {
  /** The question asked ('' when the answer was opened from a topic). */
  words: string;
  coverage: string;
  askAgainHref: string;
  messageHref: string;
  doorFor: (topicKey: string) => HelpDoor | null;
  /** The tag's first word — "Help" (default), "Team guide" in Setnayan HQ. */
  kind?: string;
};

/** THE BEST ANSWER — its first sentences, Take me there, the whole answer in place, Did this answer it? */
export function BestAnswer({ hit, ctx }: { hit: AskHit; ctx: AnswerCtx }) {
  const whole = hit.lead.length < hit.body.replace(/\s+/g, ' ').trim().length;
  return (
    <section aria-label="Best answer" className="mt-5 rounded-2xl bg-ink/[0.035] p-4 sm:p-5" data-help-best={hit.slug}>
      <Tag>Best answer · {ctx.kind ?? 'Help'} · {hit.topicLabel}</Tag>
      <h2 className="mt-2 text-lg font-semibold leading-snug text-ink">{hit.title}</h2>
      <p className="mt-2 whitespace-pre-line text-base text-ink/80">{hit.lead}</p>
      {hit.notInApp ? null : <Door door={ctx.doorFor(hit.topicKey)} main />}
      {whole ? (
        <details className="group mt-3">
          <summary className="cursor-pointer list-none text-sm font-semibold text-terracotta [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Read the full answer</span>
            <span className="hidden group-open:inline">Hide the full answer</span>
          </summary>
          <p className="mt-2 whitespace-pre-line text-sm text-ink/75">{hit.body}</p>
        </details>
      ) : null}
      <div className="mt-2 border-t border-ink/10 pt-1">
        <AnswerFeedback slug={hit.slug} words={ctx.words} coverage={ctx.coverage} askAgainHref={ctx.askAgainHref} messageHref={ctx.messageHref} />
      </div>
    </section>
  );
}

/** Answer rows — ONE OPEN AT A TIME (`<details name>`, no script), each with its door and Yes / No. */
export function AnswerRows({
  hits,
  group,
  ctx,
  tag = true,
}: {
  hits: ReadonlyArray<Pick<AskHit, 'slug' | 'title' | 'body' | 'lead' | 'topicKey' | 'topicLabel' | 'notInApp'>>;
  /** The accordion's name — one per list. */
  group: string;
  ctx: AnswerCtx;
  /** Draw the "Help · <topic>" tag (off inside a topic page, where the topic is the head). */
  tag?: boolean;
}) {
  return (
    <ul className="divide-y divide-ink/10">
      {hits.map((h) => (
        <li key={h.slug} id={h.slug} className="scroll-mt-20">
          <details name={group} className="group py-3" data-help-row={h.slug}>
            <summary className="flex min-h-11 cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 flex-1">
                {tag ? <Tag>{ctx.kind ?? 'Help'} · {h.topicLabel}</Tag> : null}
                <span className={`${tag ? 'mt-1 ' : ''}block text-base font-semibold text-ink`}>{h.title}</span>
                {tag ? <span className="mt-0.5 block text-sm text-ink/65 group-open:hidden">{h.lead}</span> : null}
              </span>
              <ChevronDown aria-hidden className="mt-1 h-5 w-5 flex-none text-ink/45 transition-transform group-open:rotate-180" strokeWidth={1.75} />
            </summary>
            <p className="mt-2 whitespace-pre-line text-sm text-ink/75">{h.body}</p>
            {h.notInApp ? null : <Door door={ctx.doorFor(h.topicKey)} />}
            <AnswerFeedback slug={h.slug} words={ctx.words} coverage={ctx.coverage} askAgainHref={ctx.askAgainHref} messageHref={ctx.messageHref} />
          </details>
        </li>
      ))}
    </ul>
  );
}

/** NO ANSWER YET — said plainly; the question was kept for the team. Near answers are labelled as not answers. */
export function NoAnswer({ result, ctx }: { result: AskResult; ctx: AnswerCtx }) {
  return (
    <section aria-label="No answer yet" className="mt-5" data-help-none="">
      <p className="text-lg font-semibold text-ink">We don’t have an answer for that yet.</p>
      <p className="mt-1 text-sm text-ink/70">We saved your question so we can write one.</p>
      <p className="mt-3 flex flex-wrap gap-2">
        <ActionButton tone="neutral" icon={<RotateCcw aria-hidden className="h-4 w-4" strokeWidth={1.75} />} label="Ask another way" href={ctx.askAgainHref} />
        <ActionButton tone="info" icon={<MessageSquare aria-hidden className="h-4 w-4" strokeWidth={1.75} />} label="Message us" href={ctx.messageHref} />
      </p>
      {result.near.length > 0 ? (
        <div className="mt-6" data-help-near="">
          <h2 className="text-sm font-semibold text-ink/70">Near this — not an answer</h2>
          <AnswerRows hits={result.near} group="help-near" ctx={ctx} />
        </div>
      ) : null}
    </section>
  );
}

/** "Ask another way" / "Message us" under a best answer. */
export function AnswerWays({ ctx }: { ctx: AnswerCtx }) {
  return (
    <p className="mt-4 flex flex-wrap gap-2">
      <ActionButton tone="neutral" icon={<RotateCcw aria-hidden className="h-4 w-4" strokeWidth={1.75} />} label="Ask another way" href={ctx.askAgainHref} />
      <ActionButton tone="info" icon={<MessageSquare aria-hidden className="h-4 w-4" strokeWidth={1.75} />} label="Message us" href={ctx.messageHref} />
    </p>
  );
}
