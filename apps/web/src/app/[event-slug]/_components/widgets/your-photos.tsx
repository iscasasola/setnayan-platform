import type { Guest } from "@/lib/db/types";

interface Props {
  guest: Guest;
  /** 0002 v2 — Limited +1 sees only the profile-photo card with a "via primary's gallery" hint. */
  isLimitedPlusOne?: boolean;
  host?: Guest | null;
}

export function YourPhotos({ guest, isLimitedPlusOne = false, host = null }: Props) {
  void guest;
  const hostName = host?.first_name ?? "your inviter";

  return (
    <section>
      <p className="meta-label mb-1">All curated for you</p>
      <h2 className="font-serif text-[28px] font-medium leading-tight text-ink lg:text-[32px]">
        Your photos
      </h2>

      {/* Limited +1 sees a single profile-photo card with the "via primary's gallery" hint. */}
      {isLimitedPlusOne ? (
        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <article className="flex flex-col rounded-2xl border border-rule bg-surface p-6 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-[20px] text-accent-deep">
              ✨
            </div>
            <p className="meta-label mt-4">Profile photo</p>
            <h3 className="mt-1 font-serif text-[20px] font-medium leading-tight text-ink">
              Auto-set on the day
            </h3>
            <p className="mt-2 text-[13px] text-ink-soft">
              Make sure a shutterbug snaps you on the wedding day — your first photo becomes your
              profile picture.
            </p>
            <p className="mt-3 text-[12px] italic text-ink-soft/80">
              Your photos will be visible in {hostName}'s gallery.
            </p>
          </article>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
          {/* Empty state for tagged photos */}
          <article className="flex flex-col rounded-2xl border-2 border-dashed border-rule-strong bg-page-bg-soft p-6 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface text-[24px]">
              📸
            </div>
            <p className="meta-label mt-4">After the wedding</p>
            <h3 className="mt-1 font-serif text-[20px] font-medium leading-tight text-ink">
              All your photos will appear here
            </h3>
            <p className="mt-2 text-[13px] text-ink-soft">
              Our shutterbugs scan your QR — every photo of you lands in this card automatically.
            </p>
          </article>

          {/* Profile photo card */}
          <article className="flex flex-col rounded-2xl border border-rule bg-surface p-6 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-[20px] text-accent-deep">
              ✨
            </div>
            <p className="meta-label mt-4">Profile photo</p>
            <h3 className="mt-1 font-serif text-[20px] font-medium leading-tight text-ink">
              Auto-set on the day
            </h3>
            <p className="mt-2 text-[13px] text-ink-soft">
              Make sure a shutterbug snaps you on the wedding day — your first photo becomes your
              profile picture.
            </p>
          </article>

          {/* Add via Shutter card — hidden for limited +1s */}
          <article
            className="flex flex-col rounded-2xl p-6 text-center text-white shadow-tayo-md"
            style={{
              background: "linear-gradient(135deg, var(--accent), var(--accent-deep))",
            }}
          >
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/15 text-[22px]">
              📷
            </div>
            <p className="meta-label mt-4 text-white/85">Get Tayo</p>
            <h3 className="mt-1 font-serif text-[20px] font-medium leading-tight">
              Add more via Shutter
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-white/80">
              You can also add your own photos and videos through Shutter, our in-app camera. Tag up
              to 5 guests per post — Maria &amp; Juan are tagged for you automatically.
            </p>
            <button
              type="button"
              disabled
              className="mt-5 inline-flex items-center justify-center gap-1.5 self-center rounded-full bg-white/20 px-4 py-2 text-[12px] font-semibold uppercase tracking-label-tight backdrop-blur transition disabled:opacity-90"
              title="Tayo native app ships in Phase 2"
            >
              Get Tayo →
            </button>
          </article>
        </div>
      )}
    </section>
  );
}
