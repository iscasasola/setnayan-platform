import { AlertCircle, CheckCircle2, MonitorPlay } from 'lucide-react';
import { DESKTOP_ENCODER_READINESS_NOTICE, type ReadinessDecision } from '@/lib/live-studio-readiness';

/**
 * BROADCAST READINESS — the couple-facing "can this actually go out?" card.
 * WAVE 9 · Live_Studio_Unified_Spec_2026-07-25.md § 4h.
 *
 * ── WHY IT LIVES HERE AND NOT IN THE CONTROLLER FOLDER ─────────────────────
 * Wave 8 is restructuring `app/dashboard/[eventId]/studio/live-studio-control/**`
 * into a chrome-less, scroll-free single screen. Dropping a card into a 2,200-line
 * page mid-restructure is how a merge silently loses a feature, so Wave 9 ships
 * this as a SELF-CONTAINED server component in shared space with ZERO edits to
 * that directory. Wave 8 (or a follow-up) mounts it with two lines:
 *
 *     const readiness = await resolveLiveStudioReadiness(admin, eventId);   // -readiness-server
 *     {readiness ? <BroadcastReadiness readiness={readiness} /> : null}
 *
 * `resolveLiveStudioReadiness` returns null when the Live Studio flag is off, so
 * the mount site needs no flag check of its own.
 *
 * ── THE COPY RULE THIS COMPONENT EXISTS TO ENFORCE ─────────────────────────
 * Wave 9 lets a couple stream WITHOUT a YouTube account — a genuine removal, and
 * one that makes it tempting to render a green "You're all set". It would not be
 * true. Browsers cannot push RTMP and the native capture app was never built
 * (§ 4c), so an encoder (OBS) window-capturing the program output is still
 * REQUIRED. The green state therefore reads "Ready to broadcast — start your
 * encoder", and `encoderNotice` renders on EVERY branch, green included.
 *
 * 🚫 Never add copy implying a phone can stream to YouTube. The phones feed the
 * host's controller over WebRTC; that is all they do.
 *
 * No state, no client JS — a server component, so nothing here can be edited into
 * claiming readiness the server did not resolve.
 */
export function BroadcastReadiness({
  readiness,
  className,
}: {
  readiness: ReadinessDecision;
  className?: string;
}) {
  const ready = readiness.state === 'ready';
  const Icon = ready ? CheckCircle2 : AlertCircle;
  const skin = ready
    ? 'border-ink/15 bg-ink/[0.03]'
    : 'border-terracotta/40 bg-terracotta/[0.07]';

  return (
    <section
      className={`rounded-xl border px-3.5 py-3 text-xs leading-snug ${skin} ${className ?? ''}`}
      aria-label="Broadcast readiness"
    >
      <div className="flex items-start gap-2">
        <Icon
          aria-hidden
          className={`mt-px h-4 w-4 shrink-0 ${ready ? 'text-ink/45' : 'text-terracotta'}`}
          strokeWidth={1.75}
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{readiness.headline}</p>
          <p className="mt-0.5 text-ink/70">{readiness.detail}</p>
        </div>
      </div>

      {/* Only the failing checks are listed. A tick-list of things that are fine is
          noise on a screen someone is operating one-handed during a ceremony. */}
      {readiness.blockers.length > 1 ? (
        <ul className="mt-2 space-y-1 pl-6 text-ink/70">
          {readiness.blockers.slice(1).map((check) => (
            <li key={check.key}>{check.detail}</li>
          ))}
        </ul>
      ) : null}

      {/* ALWAYS RENDERED — see the header. This is not a warning that clears. */}
      <p className="mt-2 flex items-start gap-2 border-t border-ink/10 pt-2 text-ink/60">
        <MonitorPlay aria-hidden className="mt-px h-4 w-4 shrink-0 text-ink/40" strokeWidth={1.75} />
        <span>{readiness.encoderNotice}</span>
      </p>

      {/* S10 — the desktop app's own OS floor, mirrored from /download. A
          DIFFERENT fact than encoderNotice above (see the constant's docblock):
          which machines can run Setnayan's OWN future encoder, not which
          software sends the picture out today. */}
      <p className="mt-1.5 pl-6 text-[11px] text-ink/45">{DESKTOP_ENCODER_READINESS_NOTICE}</p>
    </section>
  );
}
