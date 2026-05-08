interface TierItemProps {
  text: string;
  highlight?: boolean;
  muted?: boolean;
}

export function TierComparison({ isRegistered }: { isRegistered: boolean }) {
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
