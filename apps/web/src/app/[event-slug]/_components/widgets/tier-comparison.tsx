import type { Guest } from "@/lib/db/types";

interface TierItemProps {
  text: string;
  highlight?: boolean;
}

interface Props {
  isRegistered: boolean;
  /** 0002 v2 — Limited +1: render both cards in disabled state with the explainer banner. */
  isLimitedPlusOne?: boolean;
  host?: Guest | null;
}

export function TierComparison({ isRegistered, isLimitedPlusOne = false, host = null }: Props) {
  if (isLimitedPlusOne) {
    return <LimitedExplainer host={host} />;
  }

  return (
    <section>
      <p className="meta-label mb-1">Two ways to celebrate with us</p>
      <h2 className="font-serif text-[28px] font-medium leading-tight text-ink lg:text-[32px]">
        Public &middot; or &middot; with Tayo
      </h2>

      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
        {/* Public card */}
        <article className="flex flex-col rounded-2xl border border-rule bg-surface p-6">
          <p className="meta-label mb-2">Public · As you are now</p>
          <h3 className="font-serif text-[22px] font-medium leading-tight text-ink">
            No sign-up needed
          </h3>
          <p className="mt-1 text-[12px] text-ink-soft">Free · works in any browser</p>
          <ul className="mt-5 flex flex-col gap-2.5">
            <Item text="View this invitation" />
            <Item text="RSVP for the wedding" />
            <Item text="See tagged photos for 3 days only" />
            <Item text="Save QR to your phone" />
          </ul>
          <p className="mt-5 rounded-md bg-page-bg-soft px-3 py-2 text-[11px] italic text-ink-soft">
            Photos delete from your view after 3 days unless you sign up. The couple keeps their
            full archive — only your access is time-limited.
          </p>
        </article>

        {/* Registered card */}
        <article
          className="relative flex flex-col rounded-2xl p-6 text-white shadow-tayo-md"
          style={{
            background: "linear-gradient(135deg, var(--accent), var(--accent-deep))",
          }}
        >
          <p className="meta-label mb-2 text-white/85">With Tayo account</p>
          <h3 className="font-serif text-[22px] font-medium leading-tight">
            Free · everything below
          </h3>
          <p className="mt-1 text-[12px] text-white/80">One-tap sign-up</p>
          <ul className="mt-5 flex flex-col gap-2.5">
            <Item text="Everything in Public" highlight />
            <Item text="Shutter — capture & tag photos as a guest" highlight />
            <Item text="Selfie Camera with the couple's frame" highlight />
            <Item text="Photo & Video Challenges during the event" highlight />
            <Item text="Saved Forever — photos kept permanently" highlight />
            <Item text="Souvenir reel builder" highlight />
          </ul>
          <button
            type="button"
            disabled={isRegistered}
            className="mt-6 inline-flex items-center justify-center gap-1.5 self-start rounded-full bg-white px-5 py-3 text-[13px] font-semibold tracking-label-tight text-accent-deep disabled:opacity-70"
            title={isRegistered ? "You're already in" : "Tayo native app ships Phase 2"}
          >
            {isRegistered ? "You're in" : "Sign up free →"}
          </button>
        </article>
      </div>
    </section>
  );
}

/**
 * Locked tier widget shown to a Limited +1. Both cards render in a disabled
 * (dashed border, low opacity) visual state with an explainer banner above and
 * a `Learn more about Tayo` link replacing the wedding-specific signup CTA.
 */
function LimitedExplainer({ host }: { host: Guest | null }) {
  const hostName = host
    ? `${host.first_name}${host.last_name ? ` ${host.last_name}` : ""}`
    : "your inviter";
  return (
    <section>
      <p className="meta-label mb-1">Your invitation</p>
      <h2 className="font-serif text-[28px] font-medium leading-tight text-ink lg:text-[32px]">
        You're a +1 to {hostName}
      </h2>

      <div className="mt-4 rounded-2xl border border-dashed border-rule-strong bg-page-bg-soft px-5 py-4 text-[13px] leading-relaxed text-ink-soft">
        Your photos will appear in {hostName}'s gallery — ask them to show you. Want full access?
        You can register your own Tayo account anytime — but for this wedding, you're invited as{" "}
        {hostName}'s +1.
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 opacity-60 lg:grid-cols-2 lg:gap-4">
        <article className="flex flex-col rounded-2xl border-2 border-dashed border-rule-strong bg-surface p-6">
          <p className="meta-label mb-2">Public</p>
          <h3 className="font-serif text-[22px] font-medium leading-tight text-ink">
            What you have today
          </h3>
          <ul className="mt-5 flex flex-col gap-2.5">
            <Item text="View this invitation" />
            <Item text="RSVP for the wedding" />
            <Item text={`Tagged photos appear in ${hostName}'s gallery`} />
            <Item text="Save QR to your phone" />
          </ul>
        </article>
        <article className="flex flex-col rounded-2xl border-2 border-dashed border-rule-strong bg-surface p-6">
          <p className="meta-label mb-2">With Tayo account</p>
          <h3 className="font-serif text-[22px] font-medium leading-tight text-ink">
            Locked for this wedding
          </h3>
          <ul className="mt-5 flex flex-col gap-2.5">
            <Item text="Shutter (in-app camera)" />
            <Item text="Selfie Camera with couple's frame" />
            <Item text="Photo &amp; Video Challenges" />
            <Item text="Saved Forever / reel builder" />
          </ul>
        </article>
      </div>

      <div className="mt-5 flex justify-start">
        <a
          href="https://tayo.app"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-default text-[12px]"
        >
          Learn more about Tayo →
        </a>
      </div>
    </section>
  );
}

function Item({ text, highlight }: TierItemProps) {
  const glyph = "✓";
  return (
    <li className="flex items-start gap-3 text-[13px] leading-snug">
      <span
        aria-hidden
        className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px]"
        style={{
          background: highlight ? "rgba(255,255,255,0.18)" : "var(--page-bg-soft)",
          color: highlight ? "#fff" : "var(--ink)",
        }}
      >
        {glyph}
      </span>
      <span>{text}</span>
    </li>
  );
}
