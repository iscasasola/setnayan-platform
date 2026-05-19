import Link from 'next/link';
import { HelpCircle, MessageSquare, Mail } from 'lucide-react';
import { HELP_TOPICS } from '@/lib/help';
import { createClient } from '@/lib/supabase/server';
import { SubmitButton } from '@/app/_components/submit-button';
import { Logo } from '@/app/_components/logo';
import { submitHelpMessage } from './actions';

export const metadata = {
  title: 'Help & support',
  description:
    'Step-by-step guides for couples and vendors using Setnayan. Reach a human via the contact form below.',
};

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
  searchParams: Promise<{ submitted?: string; error?: string }>;
};

export default async function HelpPage({ searchParams }: Props) {
  const search = await searchParams;

  // Pre-fill the contact form with the signed-in user's email if available.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const prefilledEmail = user?.email ?? '';

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }}
      />
      <main className="min-h-dvh bg-cream">
      <header className="border-b border-ink/5">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center text-ink">
            <Logo height={32} withWordmark title="Setnayan · Help" />
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href={user ? '/dashboard' : '/login'}
              className="hidden text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline sm:inline"
            >
              {user ? 'Open dashboard' : 'Sign in'}
            </Link>
            <Link href="/signup" className="button-primary h-10 px-5 text-sm">
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="max-w-2xl space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Help &amp; support
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            How can we help?
          </h1>
          <p className="text-base text-ink/65">
            Step-by-step guides for everything Setnayan ships today. Don&rsquo;t see what
            you&rsquo;re looking for? Send us a message at the bottom of the page —
            we&rsquo;ll reach back within one business day.
          </p>
        </div>

        {search.submitted ? (
          <p
            role="status"
            className="mt-6 rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          >
            Thanks — we got your message (ref{' '}
            <span className="font-mono">{search.submitted}</span>). We&rsquo;ll get back to
            you via email.
          </p>
        ) : null}
        {search.error ? (
          <p
            role="alert"
            className="mt-6 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
          >
            {decodeURIComponent(search.error)}
          </p>
        ) : null}

        <section
          aria-label="Help topics"
          className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]"
        >
          <nav className="sticky top-4 self-start space-y-1 rounded-xl border border-ink/10 bg-cream p-3 lg:max-h-[calc(100dvh-4rem)] lg:overflow-y-auto">
            <p className="px-2 pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
              Topics
            </p>
            {HELP_TOPICS.map((t) => (
              <a
                key={t.key}
                href={`#${t.key}`}
                className="block rounded-md px-2 py-1.5 text-sm text-ink/75 hover:bg-terracotta/10 hover:text-terracotta-700"
              >
                {t.label}
              </a>
            ))}
            <a
              href="#contact"
              className="mt-2 block rounded-md bg-terracotta/10 px-2 py-1.5 text-sm font-medium text-terracotta-700 hover:bg-terracotta/20"
            >
              Contact support →
            </a>
          </nav>

          <div className="space-y-10">
            {HELP_TOPICS.map((topic) => (
              <section key={topic.key} id={topic.key} className="scroll-mt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <HelpCircle
                    aria-hidden
                    className="h-4 w-4 text-terracotta"
                    strokeWidth={1.75}
                  />
                  <h2 className="text-xl font-semibold tracking-tight">{topic.label}</h2>
                </div>
                <ul className="space-y-3">
                  {topic.articles.map((a) => (
                    <li
                      key={a.slug}
                      id={a.slug}
                      className="scroll-mt-6 rounded-xl border border-ink/10 bg-cream p-4"
                    >
                      <h3 className="text-base font-semibold text-ink">{a.title}</h3>
                      <p className="mt-1 text-sm text-ink/70">{a.body}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <section id="contact" className="scroll-mt-6 space-y-4">
              <div className="flex items-center gap-2">
                <MessageSquare
                  aria-hidden
                  className="h-4 w-4 text-terracotta"
                  strokeWidth={1.75}
                />
                <h2 className="text-xl font-semibold tracking-tight">Reach the team</h2>
              </div>
              <p className="max-w-2xl text-sm text-ink/70">
                Send us a note and we&rsquo;ll reply to the email you provide. Useful for
                anything not covered above — billing questions, vendor onboarding, custom
                quotes, bug reports.
              </p>

              <form
                action={submitHelpMessage}
                className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Your email" htmlFor="sender_email">
                    <input
                      id="sender_email"
                      name="sender_email"
                      type="email"
                      required
                      defaultValue={prefilledEmail}
                      placeholder="you@example.com"
                      className="input-field"
                    />
                  </Field>
                  <Field label="Your name (optional)" htmlFor="sender_name">
                    <input
                      id="sender_name"
                      name="sender_name"
                      maxLength={128}
                      className="input-field"
                    />
                  </Field>
                </div>

                <Field label="Topic" htmlFor="topic">
                  <select
                    id="topic"
                    name="topic"
                    defaultValue=""
                    className="input-field"
                  >
                    <option value="">Choose one (optional)</option>
                    <option value="couple">I&rsquo;m a couple planning an event</option>
                    <option value="vendor">I&rsquo;m a vendor</option>
                    <option value="billing">Billing or payments</option>
                    <option value="bug">Bug report</option>
                    <option value="feature">Feature request</option>
                    <option value="other">Other</option>
                  </select>
                </Field>

                <Field label="Subject" htmlFor="subject">
                  <input
                    id="subject"
                    name="subject"
                    required
                    maxLength={160}
                    placeholder="One sentence about what's up"
                    className="input-field"
                  />
                </Field>

                <Field label="Message" htmlFor="body">
                  <textarea
                    id="body"
                    name="body"
                    required
                    rows={6}
                    maxLength={4000}
                    placeholder="Anything that helps us help you — event ID, exact URL you were on, what you expected vs. what happened."
                    className="input-field min-h-[140px] py-2"
                  />
                </Field>

                <SubmitButton
                  className="button-primary inline-flex items-center gap-2"
                  pendingLabel="Sending…"
                >
                  <Mail aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  Send message
                </SubmitButton>
              </form>
            </section>
          </div>
        </section>
      </div>

      <footer className="border-t border-ink/5">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-ink/55 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-ink">
            <Logo height={24} />
            <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
              Setnayan · setnayan.com
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <Link href="/" className="hover:text-ink">
              Home
            </Link>
            <Link href="/help" className="hover:text-ink">
              Help
            </Link>
            <Link href={user ? '/dashboard' : '/login'} className="hover:text-ink">
              {user ? 'Dashboard' : 'Sign in'}
            </Link>
          </div>
        </div>
      </footer>
    </main>
    </>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block space-y-1">
      <span className="block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}
