// lucide-react dropped its brand glyphs, so there is no Facebook mark to use —
// Share2 reads as "a second destination", which is exactly what this card is.
import { AlertCircle, CheckCircle2, Share2, Unlink2, Video } from 'lucide-react';

import { FACEBOOK_REPLAY_WARNING, normalizeFacebookWatchUrl } from '@/lib/facebook-watch';

import { SubmitButton } from './submit-button';

/**
 * FacebookDualStreamCard — the couple-facing "also stream to Facebook" control.
 *
 * DUAL-STREAM (owner-approved 2026-07-26). Setnayan builds NOTHING on the
 * streaming side for this: OBS already window-captures the program output, and
 * the free obs-multi-rtmp plugin pushes that same output to a second RTMP
 * destination. So the whole feature is a pasted URL plus honest instructions —
 * no Meta API, no OAuth, no app review, and no extra cost to us. What it does
 * cost is the COUPLE'S UPLOAD BANDWIDTH, which roughly doubles, so the guide
 * below leads with "test it at the venue".
 *
 * ⚠ THE 30-DAY LINE IS NOT DECORATION. Meta deletes Facebook Live replays after
 * about 30 days. A couple who thinks Facebook is their archive can lose their
 * ceremony. The warning renders unconditionally — before they save, while it is
 * saved — never behind a disclosure. (It is deliberately NOT repeated to guests:
 * the guest-facing Facebook link only exists during the LIVE window, and the
 * surfaces that outlive the day — the recap and the editorial "Watch the Film" —
 * stay YouTube-only, so no guest can ever land on a link that will rot.)
 *
 * ONE component, mounted by BOTH setup surfaces (the Wave 8 controller's
 * SetupSheet and the legacy /studio/panood/setup page), so the copy — and the
 * warning above all — can never drift between them. Each host passes its own
 * server actions, because each redirects back to its own route.
 */
export function FacebookDualStreamCard({
  eventId,
  facebookUrl,
  saveAction,
  clearAction,
  saved = false,
  error = false,
}: {
  eventId: string;
  /** The raw stored column value, or null. Re-normalized below before display. */
  facebookUrl: string | null;
  saveAction: (formData: FormData) => Promise<void>;
  clearAction: (formData: FormData) => Promise<void>;
  /** `?facebook_url_saved=1` came back from the save action. */
  saved?: boolean;
  /** `?facebook_url_error=1` — the pasted value was not a Facebook video link. */
  error?: boolean;
}) {
  // Re-normalize before showing it back. The stored value is host-PATCHable
  // (events UPDATE RLS is row-level), and the public page re-validates on read —
  // so the couple must be shown EXACTLY what a guest will get, not the raw
  // column. A value that no longer normalizes reads as "nothing saved", which is
  // also the correct recovery: paste it again.
  const savedUrl = facebookUrl ? normalizeFacebookWatchUrl(facebookUrl) : null;
  return (
    <div className="rounded-lg border border-ink/10 bg-cream/60 p-4">
      <p className="sn-eye">
        <Share2 aria-hidden strokeWidth={1.75} />
        Also stream to Facebook
      </p>

      {saved ? (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-success-300/70 bg-success-50 px-2.5 py-1 text-xs font-medium text-success-800">
          <CheckCircle2 aria-hidden className="h-3.5 w-3.5" /> Saved — your event page shows
          both doors on the day.
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-terracotta/30 bg-terracotta/10 px-2.5 py-1 text-xs text-terracotta-700">
          <AlertCircle aria-hidden className="h-3.5 w-3.5" /> That doesn&rsquo;t look like a
          Facebook video link — open your live video on Facebook, tap Share &rarr; Copy link,
          and paste that.
        </p>
      ) : null}

      {savedUrl ? (
        <>
          <p className="mt-1 break-all font-mono text-sm text-ink/85">{savedUrl}</p>
          <p className="mt-1 text-xs text-ink/55">
            During the live window your event page shows the YouTube player with a{' '}
            <span className="font-medium">Watch on Facebook</span> link beside it, so guests
            can watch wherever they already are.
          </p>
          <form action={clearAction} className="mt-3">
            <input type="hidden" name="event_id" value={eventId} />
            <SubmitButton
              pendingLabel="Removing…"
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-burgundy/40 hover:text-burgundy"
            >
              <Unlink2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Remove Facebook link
            </SubmitButton>
          </form>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink/60">
            Many guests live on Facebook. Go live there at the same time as YouTube, paste
            the Facebook video link here, and your event page offers both.
          </p>
          <form action={saveAction} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input type="hidden" name="event_id" value={eventId} />
            <input
              type="url"
              name="facebook_url"
              required
              placeholder="Paste your Facebook live link — facebook.com/… or fb.watch/…"
              className="min-h-[44px] flex-1 rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none"
            />
            <SubmitButton
              pendingLabel="Saving…"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-burgundy/20 bg-burgundy px-4 text-sm font-semibold text-cream transition-colors hover:bg-burgundy/90"
            >
              <Video aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Save Facebook link
            </SubmitButton>
          </form>
        </>
      )}

      {/* ⚠ Always on screen. See the component note. */}
      <p className="mt-3 flex items-start gap-1.5 rounded-md border border-terracotta/25 bg-terracotta/5 px-2.5 py-2 text-xs text-ink/70">
        <AlertCircle
          aria-hidden
          className="mt-px h-3.5 w-3.5 shrink-0 text-terracotta"
          strokeWidth={2}
        />
        <span>{FACEBOOK_REPLAY_WARNING}</span>
      </p>

      <details className="mt-3 rounded-md border border-ink/10 bg-white/60 px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold text-ink/70">
          How to send one broadcast to both (OBS)
        </summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs text-ink/65">
          <li>
            Install the free <span className="font-mono">obs-multi-rtmp</span> plugin, then
            open it from <span className="font-medium">Docks &rarr; Multiple Output</span>.
          </li>
          <li>
            Leave YouTube exactly where it is — your normal{' '}
            <span className="font-medium">Settings &rarr; Stream</span>.
          </li>
          <li>
            In Facebook&rsquo;s Live Producer, start a new live video and copy its{' '}
            <span className="font-medium">server URL</span> and{' '}
            <span className="font-medium">stream key</span>. Paste them into a new target in
            the plugin.
          </li>
          <li>
            Press <span className="font-medium">Start Streaming</span> for YouTube and{' '}
            <span className="font-medium">Start</span> on the Facebook target. One capture,
            two destinations.
          </li>
          <li>
            Your laptop now uploads twice, so plan for roughly double the upload speed —{' '}
            <span className="font-medium">do a full test at the venue, on the venue&rsquo;s
            connection</span>, before the day. If it can only carry one, keep YouTube.
          </li>
        </ol>
      </details>
    </div>
  );
}
