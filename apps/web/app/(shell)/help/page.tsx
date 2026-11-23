import { getCurrentUser } from '@/lib/auth';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { HELP_TOPICS, helpTopicsFor } from '@/lib/help';
import { isStoreShellRequest } from '@/lib/request-platform';
import { topicsForCoverage, type HelpCoverage } from '@/lib/help-ask-core';
import { AnswerRows, AnswerWays, BestAnswer, NoAnswer, type AnswerCtx } from '@/app/_components/help-ask/help-ask-view';
import { helpDoorFor } from '@/app/_components/help-ask/help-ask-places';
import { HelpStart } from '@/app/_components/help-ask/help-start';
import { MessageUs } from '@/app/_components/help-ask/message-us';
import { guideForTopic } from '@/lib/help/guides';
import { helpKeep, helpPlace, inHelp } from '@/lib/help/help-place';
import { routes } from '@/lib/routes';
import { getSelfPersonalization } from '@/lib/self-personalization';
import { SubmitButton } from '@/app/_components/submit-button';
import { Field } from '@/app/_components/forms/field';
import { submitHelpMessage } from '@/app/help/actions';
import { HowSearchField, HowSearchResults } from '@/app/_components/how-search/how-search';
import { runHowSearch } from '@/lib/how-search';
import type { HowHit } from '@/lib/how-search-core';
import { isReferralProgramEnabled } from '@/lib/platform-settings';


/*
  ⚠ `dynamic` IS DECLARED ONCE, ON `app/(shell)/layout.tsx`, NOT HERE.
  The shared shell reads the session, so every route in this group must be
  dynamic — and a layout's `dynamic` DOES cover its children (measured: with
  the pages declaring nothing, `force-dynamic` on the group layout alone moved
  them from `○ Static` to `ƒ Dynamic` in the build table). This file used to
  carry its own copy, along with a docblock asserting a layout could not do
  this. That assertion was false. Twenty copies of one rule is twenty places
  for it to disagree with itself — do not re-add it here.
*/

const HELP_METADATA = {
  title: 'Help & support',
  description:
    'Ask anything about Setnayan — in English or Tagalog. Answers for couples, hosts, guests and suppliers, or send us a message.',
  alternates: { canonical: '/help' },
  openGraph: {
    type: 'website',
    url: '/help',
    title: 'Help & support · Setnayan',
    description:
      'Ask anything about Setnayan — in English or Tagalog. Answers for couples, hosts, guests and suppliers, or send us a message.',
    siteName: 'Setnayan',
    locale: 'en_PH',
    images: [{ url: '/brand/og-card-2026-11.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Help & support · Setnayan',
    description:
      'Ask anything about Setnayan — in English or Tagalog. Answers for couples, hosts, guests and suppliers, or send us a message.',
    images: ['/brand/og-card-2026-11.png'],
  },
};

/**
 * 🔎 A SEARCH IS NOT A PAGE FOR GOOGLE. `/help?q=…` draws results in place;
 * indexed, every typed phrase would be a thin duplicate of /help. So a
 * search address is `noindex, follow` (its links still count) and keeps the
 * `/help` canonical. The bare /help is unchanged.
 */
export async function generateMetadata({ searchParams }: Props) {
  const { q } = await searchParams;
  return q?.trim() ? { ...HELP_METADATA, robots: { index: false, follow: true } } : HELP_METADATA;
}

const FAQ_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: HELP_TOPICS.flatMap((topic) =>
    topic.articles.map((article) => ({
      '@type': 'Question',
      name: article.title,
      acceptedAnswer: {
        '@type': 'Answer',
        text: article.body,
      },
    })),
  ),
};

type Props = {
  searchParams: Promise<{ submitted?: string; error?: string; role?: string; for?: string; q?: string; refer?: string; subject?: string; body?: string; topic?: string }>;
};

/**
 * ❓ HELP — ASK FIRST (owner "help approved", 13 Nov 2026; prototype
 * `Setnayan-specs/prototypes/approved_2026-11-13/help-page-fable.html` v5; DECISION_LOG 2026-11-13 "Help page
 * approved" · "Help coverage = active account" · "Three helps" · "User help includes guest questions" · "Help — no AI
 * answers yet" · "No programmer labels").
 *
 * COVERAGE = THE ACTIVE ACCOUNT, NO PICKER. The account sheet that opened Help says which account is active: a shop's
 * sheet opens `/help?for=shop` (the shop's help), an invite opens `/help?for=guest` (guest answers, no account
 * switch), anything else signed in is the user account (host AND guest answers). Signed out, no invite: About
 * Setnayan only, and the door to sign in. The team's help is inside Setnayan HQ (`app/admin/help/guides`), never here.
 * The old role tiles are gone; an old `?role=` address lands on the same coverage it used to narrow to.
 *
 * 📘 GUIDE & HELP (owner "Approved" 21 Nov 2026, re-confirmed 22 Nov; corpus `prototypes/guide_help_2026-11-20/index.html`
 * screen 1): Help · Ask anything · Start here (the first three guides of this help, `lib/help/guides.ts`) · Topics (three
 * rows + All N, `/help/topics`) · Message us (one row; the form opens in a Sheet). The 13 Nov People ask chips, the topic
 * tiles, the on-page form and the topic lines are gone (the drawing's four removals). Coverage is read once, by
 * `lib/help/help-place.ts`, so every Help page keeps the same account.
 */

const ACCOUNT_LINE: Record<HelpCoverage, string> = {
  user: 'Answers for your account',
  supplier: 'Answers for your shop',
  guest: 'Answers for guests',
  public: 'Answers about Setnayan',
};

const CONTACT_TOPIC: Record<HelpCoverage, string> = { user: 'couple', supplier: 'vendor', guest: 'guest', public: '' };

export default async function HelpPage({ searchParams }: Props) {
  const search = await searchParams;
  // ✍ A door that already knows what the note is about opens it prefilled (the Card Maker's "Need your own form?" row:
  // "Custom form request · [card] · [category]:"). Plain text, capped to the fields' own limits; the person still sends.
  const prefillSubject = typeof search.subject === 'string' ? search.subject.slice(0, 160) : '';
  const prefillBody = typeof search.body === 'string' ? search.body.slice(0, 4000) : '';
  const prefillTopic = ['couple', 'vendor', 'guest', 'billing', 'bug', 'feature', 'other'].includes(search.topic ?? '') ? search.topic! : null;

  const user = await getCurrentUser();
  const signedIn = Boolean(user && !user.is_anonymous);
  const place = helpPlace(search, signedIn);
  const { coverage, forParam, referEvent } = place;
  const keep = helpKeep(place);
  const here = inHelp(routes.help.index(), place);

  // Pre-fill the contact form with the signed-in user's email and their own name (owner 2026-11-08).
  const prefilledEmail = user?.email ?? '';
  const prefilledName = user ? (await getSelfPersonalization()).displayName ?? '' : '';

  // 🍎 In the iPhone app every answer is the app's own (no price, no purchase, no pointer to the web) and a question
  // about a part the app does not include is left out of the topics — the switch the list always used, read once
  // here. (The ASK keeps that question, with the app's own line: lib/help-ask-core.ts `askTopicsFor`.)
  const storeShell = await isStoreShellRequest();
  const covered = topicsForCoverage(helpTopicsFor(HELP_TOPICS, storeShell), coverage);

  const q = (search.q ?? '').trim().slice(0, 120);
  const found = q ? await runHowSearch(q, { coverage }) : null;
  const ask = found?.ask ?? null;
  // What we could not answer is kept (§ 09) — but by the ASK, not by this render: the box POSTs to the help's action
  // (`intent=ask`, app/help/actions.ts), which writes the row and redirects here. A GET of `?q=` writes nothing.

  const ctx: AnswerCtx = {
    words: q,
    coverage,
    askAgainHref: `${here}#ask`,
    messageHref: '#contact',
    doorFor: (topicKey) => helpDoorFor(place.account, topicKey, { eventId: referEvent, eventName: referEvent ? 'your event' : null }),
    guideFor: (topicKey) => {
      const g = guideForTopic(topicKey, coverage);
      return g ? inHelp(routes.help.guide(g.key), place) : null;
    },
  };

  // Feature pages and guides — the one search's own rows, under the help's answers.
  const featureRows: HowHit[] = (found?.hits ?? []).filter((h) => h.kind !== 'help').slice(0, 3);
  const shown = ask?.best ? [ask.best, ...ask.more].map((h) => h.title).join(' · ') : '';

  const contact = (
    <MessageUs title={q ? 'Still stuck?' : 'Message us'} startOpen={Boolean(prefillSubject || prefillBody || prefillTopic || search.error)}>
      <form action={submitHelpMessage} className="space-y-4">
        {forParam ? <input type="hidden" name="for" value={forParam} /> : null}
        {q ? <input type="hidden" name="asked" value={q} /> : null}
        {shown ? <input type="hidden" name="shown" value={shown.slice(0, 600)} /> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your email" htmlFor="sender_email">
            <input autoComplete="email" id="sender_email" name="sender_email" type="email" required defaultValue={prefilledEmail} placeholder="you@example.com" className="input-field" />
          </Field>
          <Field label="Your name (optional)" htmlFor="sender_name">
            <input autoComplete="name" id="sender_name" name="sender_name" maxLength={128} defaultValue={prefilledName} className="input-field" />
          </Field>
        </div>
        <Field label="Topic" htmlFor="topic">
          <select id="topic" name="topic" defaultValue={prefillTopic ?? CONTACT_TOPIC[coverage]} className="input-field">
            <option value="">Choose one (optional)</option>
            <option value="couple">I&rsquo;m a couple planning an event</option>
            <option value="vendor">I&rsquo;m a supplier</option>
            <option value="guest">I&rsquo;m a guest invited to an event</option>
            <option value="billing">Billing or payments</option>
            <option value="bug">Bug report</option>
            <option value="feature">Feature request</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Subject" htmlFor="subject">
          <input id="subject" name="subject" required maxLength={160} defaultValue={prefillSubject || q} placeholder="One sentence about what's up" className="input-field" />
        </Field>
        <Field label="Message" htmlFor="body">
          <textarea id="body" name="body" required rows={5} maxLength={4000} defaultValue={prefillBody} placeholder="Anything that helps us help you — event ID, exact URL you were on, what you expected vs. what happened." className="input-field min-h-[120px] py-2" />
        </Field>
        {q ? (
          <p className="text-xs text-ink/60">
            {shown ? 'Sent with it: your question and the answers we showed.' : 'Sent with it: your question, and that we had no answer.'}
          </p>
        ) : null}
        <SubmitButton className="button-primary inline-flex items-center gap-2" pendingLabel="Sending…">
          <Mail aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Send message
        </SubmitButton>
      </form>
    </MessageUs>
  );

  return (
    /*
      🔑 THE SHARED SHELL IS NOT MOUNTED HERE — it lives in `app/(shell)/layout.tsx`, one mount for the whole public
      group. ⏭ THE /help/<slug> ARTICLES ARE DELIBERATELY OUTSIDE THIS GROUP (prerendered; see app/help/[slug]).
    */
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }} />
      <main className="min-h-dvh bg-page pb-24 lg:pb-0">
        <div className="mx-auto w-full max-w-xl px-4 pb-12 pt-6 sm:px-6 sm:pt-10" data-help-coverage={coverage}>
          <h1 className="text-sn-title text-ink">Help</h1>
          {q ? null : <p className="mt-1 text-sn-lg text-ink/65">Ask it your way. English or Tagalog.</p>}

          <div className="mt-4">
            <HowSearchField q={q} action="/help" keep={keep} at="top" clearHref={here} ask={{ action: submitHelpMessage, coverage }} />
          </div>
          <p className="mt-2 text-sm text-ink/60" data-help-account="">
            {ACCOUNT_LINE[coverage]}
            {coverage === 'public' ? (
              <>
                {/* The link wraps to its own line on a phone; the dot only joins the two on one line. */}
                <span className="hidden sm:inline">{' · '}</span>
                <Link href="/login?next=/help" className="flex min-h-11 w-fit items-center sm:inline-flex font-medium text-terracotta underline-offset-2 hover:underline">
                  Sign in for your own event or shop
                </Link>
              </>
            ) : null}
          </p>

          {search.submitted ? (
            <p role="status" className="mt-4 rounded-md border border-success-300/60 bg-success-50 px-4 py-3 text-sm text-success-900">
              Thanks — we got your message (ref <span className="font-mono">{search.submitted}</span>). We&rsquo;ll get back to you
              via email.
            </p>
          ) : null}
          {search.error ? (
            <p role="alert" className="mt-4 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700">
              {decodeURIComponent(search.error)}
            </p>
          ) : null}

          {found && ask ? (
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
                <section aria-label="More answers" data-help-more="">
                  <h2 className="text-sn-xl font-semibold text-ink">More answers</h2>
                  <div className="sn-frame mt-2 px-4 py-1">
                    <AnswerRows hits={ask.more} group="help-more" ctx={ctx} />
                  </div>
                </section>
              ) : null}
              <HowSearchResults q={q} hits={featureRows} storiesFailed={found.storiesFailed} clearHref={here} askHref="#contact" title="Features" />
              {contact}
            </div>
          ) : (
            <div className="mt-2">
              <HelpStart place={place} topics={covered} />

              {contact}

              {/* ✍ YOUR STORY — its door moved here from the account sheet, whose tiles are Help · Show me around · Sign out
                  (DECISION_LOG 2026-11-07 "Account sheet tiles"; THE ONE BUILD §9 #5: "their destinations stay reachable
                  inside Help"). Signed-in only — the Storyteller chapters are an account's own. */}
              {user && !user.is_anonymous ? (
                <p className="mt-6 text-sm text-ink/65" data-help-your-story="">
                  <Link href="/dashboard/creator" className="font-medium text-terracotta underline-offset-2 hover:underline">
                    Your Story ›
                  </Link>{' '}
                  — the chapters you write about your events.
                </p>
              ) : null}
              {/* 🤝 Refer a couple — only from an event's sheet (`?refer=<event>`), only while the programme is on; the
                  refer page checks the viewer itself. */}
              {user && !user.is_anonymous && referEvent && (await isReferralProgramEnabled().catch(() => false)) ? (
                <p className="mt-2 text-sm text-ink/65" data-help-refer="">
                  <Link href={`/dashboard/${referEvent}/refer`} className="font-medium text-terracotta underline-offset-2 hover:underline">
                    Refer a couple ›
                  </Link>{' '}
                  — share Setnayan with a couple you know.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
