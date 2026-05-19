// Verification & onboarding — pulled from iteration 0015 § Section 8
// (vendor compatibility & verification) and iteration 0022 § 2.1c
// (vendor public-visibility state machine). Frames the 3-business-day
// SLA, the documents the Setnayan Team accepts, and the per-state
// behavior so vendors know what to expect after they submit.

const STEPS: Array<{ step: string; title: string; body: string }> = [
  {
    step: '1',
    title: 'Submit your registration',
    body: 'Business name, owner name, service category, the cities you serve, sample work, and a company logo (we accept a placeholder if you don&rsquo;t have one yet — upload the real one within 30 days).',
  },
  {
    step: '2',
    title: 'Show legitimacy — your call which doc',
    body: 'A photo of your DTI registration, SEC papers, or Mayor&rsquo;s Permit works. Solo creatives without a registered business can submit a portfolio review instead — published shoots, IG portfolio, FB page.',
  },
  {
    step: '3',
    title: 'Setnayan Team reviews',
    body: 'Average 3 business days from submission to outcome. We confirm your business name, primary contact, and one verifiable trade reference. We only ping you if something needs clarifying.',
  },
  {
    step: '4',
    title: 'You flip from Coming soon → Verified',
    body: 'Until you&rsquo;re verified, your profile shows on the directory with a muted "Coming soon" badge — read-only, no booking CTA. Once verified, the booking buttons unlock and your Verified check appears on every surface.',
  },
];

export function Verification() {
  return (
    <section className="border-b border-ink/5 bg-cream">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mb-10 max-w-2xl space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Verification &amp; onboarding
          </p>
          <h2 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">
            Three business days, on average.
          </h2>
          <p className="text-base text-ink/65">
            Verification protects couples from look-alike vendors and protects
            you from being lumped in with them. Posted SLA is 5 business days;
            we aim for 3 and ping you only if something needs a second look.
          </p>
        </div>
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {STEPS.map((s) => (
            <li
              key={s.step}
              className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-5"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta text-cream">
                <span className="font-mono text-sm font-semibold">{s.step}</span>
              </span>
              <h3 className="text-base font-semibold tracking-tight text-ink">{s.title}</h3>
              <p
                className="text-sm text-ink/65"
                dangerouslySetInnerHTML={{ __html: s.body }}
              />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
