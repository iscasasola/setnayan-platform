import Link from 'next/link';
import {
  ScrollText,
  CheckCircle2,
  Circle,
  HeartHandshake,
  ShieldCheck,
  Users,
  Gift,
  UserCheck,
  ArrowRight,
  Shirt,
} from 'lucide-react';
import { updateNikahDetails } from '../nikah-actions';

// The Five Essentials of your Nikah — the signature couple-facing surface of the
// Muslim wedding track. It turns the five validity pillars of an Islamic
// marriage contract into one tangible, reassuring checklist, gated to muslim
// weddings only. Free, part of the core couple tool — never paywalled.
//
// Four pillars are trackable from data the couple already enters:
//   • Wali confirmed      → a guest with the 'wali' role
//   • Two witnesses       → ≥2 guests with the 'witness' role
//   • Mahr set            → events.mahr_description filled (via the editor below)
//   • Imam / qadi booked  → a guest with the 'imam' role
// The fifth — mutual consent — is the heart of the nikah and not a data field;
// it is shown as a steady, affirmed foundation rather than a togglable task.
//
// The card also hosts the inline editor for the mahr description + the walima
// gender-separation posture (events columns from migration 20270308998862), and
// links out to the existing dress-code editor for the guest modesty note. Per the
// corpus spec, contested details are the couple's to set and should be confirmed
// with their imam — the copy says so and never prescribes a ruling.

type GuestLike = {
  role: string;
  extra_roles?: readonly string[] | null;
};

type Props = {
  eventId: string;
  eventDateSet: boolean;
  mahrDescription: string | null;
  genderSeparation: string | null;
  guests: ReadonlyArray<GuestLike>;
};

function hasRole(guests: ReadonlyArray<GuestLike>, role: string): number {
  return guests.filter(
    (g) => g.role === role || (g.extra_roles ?? []).includes(role),
  ).length;
}

export function NikahEssentialsCard({
  eventId,
  eventDateSet,
  mahrDescription,
  genderSeparation,
  guests,
}: Props) {
  const waliCount = hasRole(guests, 'wali');
  const witnessCount = hasRole(guests, 'witness');
  const imamCount = hasRole(guests, 'imam');
  const mahrSet = !!mahrDescription && mahrDescription.trim().length > 0;

  const guestsHref = `/dashboard/${eventId}/guests`;

  const items: EssentialItem[] = [
    {
      icon: HeartHandshake,
      label: 'Mutual consent',
      done: 'steady',
      help: "Both partners' free, willing agreement — the heart of every nikah.",
    },
    {
      icon: ShieldCheck,
      label: 'Wali confirmed',
      done: waliCount >= 1 ? 'done' : 'todo',
      help:
        waliCount >= 1
          ? "The bride's guardian is on your guest list."
          : "Add the bride's wali (guardian) to your guest list.",
      cta: waliCount >= 1 ? null : { href: guestsHref, label: 'Add wali' },
    },
    {
      icon: Users,
      label: 'Two witnesses',
      done: witnessCount >= 2 ? 'done' : witnessCount === 1 ? 'partial' : 'todo',
      help:
        witnessCount >= 2
          ? `${witnessCount} witnesses on your guest list.`
          : witnessCount === 1
            ? '1 of 2 witnesses added — a nikah needs at least two.'
            : 'Add at least two adult witnesses to your guest list.',
      cta:
        witnessCount >= 2 ? null : { href: guestsHref, label: 'Add witnesses' },
    },
    {
      icon: Gift,
      label: 'Mahr set',
      done: mahrSet ? 'done' : 'todo',
      help: mahrSet
        ? 'Your mahr is recorded below.'
        : "The groom's gift to the bride — set it below. It can be money, gold, or something symbolic.",
    },
    {
      icon: UserCheck,
      label: 'Imam / qadi',
      done: imamCount >= 1 ? 'done' : 'todo',
      help:
        imamCount >= 1
          ? 'Your officiant is on your guest list.'
          : 'Add the imam or qadi who will solemnize the nikah.',
      cta: imamCount >= 1 ? null : { href: guestsHref, label: 'Add imam' },
    },
  ];

  const trackedDone = items.filter(
    (i) => i.done === 'done' && i.label !== 'Mutual consent',
  ).length;

  return (
    <section aria-labelledby="nikah-essentials-heading" className="space-y-3">
      <header className="flex items-baseline gap-2">
        <ScrollText
          aria-hidden
          className="h-3.5 w-3.5 text-emerald-700"
          strokeWidth={1.75}
        />
        <h2
          id="nikah-essentials-heading"
          className="font-mono text-[11px] uppercase tracking-[0.25em] text-emerald-700"
        >
          Your Nikah
        </h2>
      </header>

      <article className="flex flex-col gap-5 rounded-2xl border-2 border-emerald-200/70 bg-emerald-50/30 p-6 sm:p-8">
        <div className="space-y-1.5">
          <h3 className="font-display text-2xl italic leading-tight text-ink sm:text-3xl">
            The five essentials of your Nikah
          </h3>
          <p className="text-sm leading-relaxed text-ink/70">
            {`${trackedDone} of 4 set.`} The rest is gentle guidance — confirm the
            details with your imam.
          </p>
        </div>

        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.label} className="flex items-start gap-3">
              <StatusIcon done={item.done} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <item.icon
                      aria-hidden
                      className="h-3.5 w-3.5 text-emerald-700"
                      strokeWidth={1.75}
                    />
                    {item.label}
                  </span>
                  {item.cta ? (
                    <Link
                      href={item.cta.href}
                      className="inline-flex items-center gap-0.5 text-xs font-medium text-mulberry hover:text-mulberry-700"
                    >
                      {item.cta.label}
                      <ArrowRight aria-hidden className="h-3 w-3" strokeWidth={2} />
                    </Link>
                  ) : null}
                </div>
                <p className="text-xs leading-relaxed text-ink/60">{item.help}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* Inline editor: mahr description + walima gender-separation posture. A
            plain server-action form — no client JS. */}
        <form
          action={updateNikahDetails.bind(null, eventId)}
          className="space-y-4 rounded-xl border border-emerald-200/60 bg-cream/60 p-4"
        >
          <div className="space-y-1.5">
            <label
              htmlFor="mahr_description"
              className="block text-xs font-semibold uppercase tracking-wide text-ink/70"
            >
              Mahr — the gift to the bride
            </label>
            <textarea
              id="mahr_description"
              name="mahr_description"
              rows={2}
              maxLength={600}
              defaultValue={mahrDescription ?? ''}
              placeholder="e.g. 5g gold, or a meaningful symbolic gift"
              className="w-full resize-y rounded-lg border border-ink/15 bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
            <p className="text-[11px] leading-relaxed text-ink/55">
              The mahr is the bride&rsquo;s alone. Setnayan never charges or
              processes it — this is just your private record.
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="gender_separation"
              className="block text-xs font-semibold uppercase tracking-wide text-ink/70"
            >
              Walima seating
            </label>
            <select
              id="gender_separation"
              name="gender_separation"
              defaultValue={genderSeparation ?? 'none'}
              className="w-full rounded-lg border border-ink/15 bg-cream px-3 py-2 text-sm text-ink focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            >
              <option value="none">Mixed seating (most common)</option>
              <option value="sections">
                Separate men&rsquo;s &amp; women&rsquo;s sections
              </option>
              <option value="separate_spaces">Separate spaces / halls</option>
            </select>
            <p className="text-[11px] leading-relaxed text-ink/55">
              Your choice — many Filipino-Muslim weddings are mixed. We never
              assume.
            </p>
          </div>

          <button
            type="submit"
            className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-mulberry px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus:ring-2 focus:ring-mulberry focus:ring-offset-2 focus:ring-offset-cream"
          >
            Save Nikah details
          </button>
        </form>

        <Link
          href={`/dashboard/${eventId}/website/dress-code`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 hover:text-emerald-900"
        >
          <Shirt aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Set a guest modesty note on your invitation
          <ArrowRight aria-hidden className="h-3 w-3" strokeWidth={2} />
        </Link>

        {!eventDateSet ? (
          <p className="text-[11px] leading-relaxed text-ink/45">
            Tip: set your wedding date so your countdown and Nikah timeline have
            an anchor.
          </p>
        ) : null}
      </article>
    </section>
  );
}

type EssentialItem = {
  icon: typeof ShieldCheck;
  label: string;
  done: 'done' | 'partial' | 'todo' | 'steady';
  help: string;
  cta?: { href: string; label: string } | null;
};

function StatusIcon({ done }: { done: EssentialItem['done'] }) {
  if (done === 'done' || done === 'steady') {
    return (
      <CheckCircle2
        aria-hidden
        className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
        strokeWidth={1.75}
      />
    );
  }
  if (done === 'partial') {
    return (
      <Circle
        aria-hidden
        className="mt-0.5 h-5 w-5 shrink-0 text-warn-500"
        strokeWidth={1.75}
      />
    );
  }
  return (
    <Circle
      aria-hidden
      className="mt-0.5 h-5 w-5 shrink-0 text-ink/25"
      strokeWidth={1.75}
    />
  );
}
