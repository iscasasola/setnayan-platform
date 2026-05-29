import Link from 'next/link';
import { HelpCircle, MessageSquare, Mail, Heart, Briefcase, Mailbox, Shield } from 'lucide-react';
import { HELP_TOPICS, HELP_ROLES, type HelpRole } from '@/lib/help';
import { createClient } from '@/lib/supabase/server';
import { SubmitButton } from '@/app/_components/submit-button';
import { Logo } from '@/app/_components/logo';
import { submitHelpMessage } from './actions';

// SEO/GEO Bucket 8 (CLAUDE.md 2026-05-29 SEO/GEO Sprint row) — 1hr Vercel
// edge cache so static marketing routes serve Google's crawl rate-limit
// budget without origin pressure. Each page rebuilds at most once per hour.
export const revalidate = 3600;

export const metadata = {
  title: 'Help & support',
  description:
    'Step-by-step guides for couples, vendors, guests, and admins using Setnayan. Pick your role tile or send us a message.',
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

const ROLE_ICON: Record<HelpRole, typeof Heart> = {
  couple: Heart,
  vendor: Briefcase,
  guest: Mailbox,
  admin: Shield,
};

function isHelpRole(value: string | undefined): value is HelpRole {
  return value === 'couple' || value === 'vendor' || value === 'guest' || value === 'admin';
}

type Props = {
  searchParams: Promise<{ submitted?: string; error?: string; role?: string }>;
};

export default async function HelpPage({ searchParams }: Props) {
  const search = await searchParams;
  const role: HelpRole | undefined = isHelpRole(search.role) ? search.role : undefined;

  const visibleTopics = role
    ? HELP_TOPICS.filter((t) => t.roles.includes(role))
    : HELP_TOPICS;

  const activeRoleMeta = role ? HELP_ROLES.find((r) => r.key === role) : undefined;

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
              {activeRoleMeta ? `Help for ${activeRoleMeta.label.toLowerCase()}s` : 'How can we help?'}
            </h1>
            <p className="text-base text-ink/65">
              {activeRoleMeta
                ? activeRoleMeta.blurb
                : "Step-by-step guides for couples, vendors, guests, and admins. Pick your role below or scroll for everything."}
            </p>
          </div>

          {/* Role tiles — 4-way split (Couple / Vendor / Guest / Admin). The
              spec for iteration 0029 § 1 calls for four role tiles at
              /help; this is that tile bar. Tiles are real links so they
              work without JS and bookmark cleanly. */}
          <nav
            aria-label="Help by role"
            className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {HELP_ROLES.map((r) => {
              const Icon = ROLE_ICON[r.key];
              const isActive = role === r.key;
              return (
                <Link
                  key={r.key}
                  href={isActive ? '/help' : `/help?role=${r.key}`}
                  aria-current={isActive ? 'true' : undefined}
                  className={`group flex flex-col gap-2 rounded-xl border p-4 transition ${
                    isActive
                      ? 'border-terracotta bg-terracotta/10 text-terracotta-700'
                      : 'border-ink/10 bg-cream text-ink hover:border-terracotta/40 hover:bg-terracotta/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                    <span className="text-sm font-semibold">{r.label}</span>
                  </div>
                  <span className="text-xs leading-snug text-ink/60 group-hover:text-ink/75">
                    {r.blurb}
                  </span>
                </Link>
              );
            })}
          </nav>
          {activeRoleMeta ? (
            <p className="mt-3 text-xs text-ink/60">
              Showing {visibleTopics.length} topic{visibleTopics.length === 1 ? '' : 's'} for{' '}
              {activeRoleMeta.label.toLowerCase()}s.{' '}
              <Link href="/help" className="underline underline-offset-2 hover:text-terracotta">
                Show all topics
              </Link>
              .
            </p>
          ) : null}

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
              {visibleTopics.map((t) => (
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
              {visibleTopics.length === 0 ? (
                <p className="rounded-xl border border-ink/10 bg-cream p-6 text-sm text-ink/65">
                  No articles for this role yet. Send us a message below and we&rsquo;ll get back
                  to you.
                </p>
              ) : null}
              {visibleTopics.map((topic) => (
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
                      defaultValue={role ?? ''}
                      className="input-field"
                    >
                      <option value="">Choose one (optional)</option>
                      <option value="couple">I&rsquo;m a couple planning an event</option>
                      <option value="vendor">I&rsquo;m a vendor</option>
                      <option value="guest">I&rsquo;m a guest invited to an event</option>
                      <option value="admin">Admin / operations</option>
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
              <Link href="/how-it-works" className="hover:text-ink">
                How it works
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
