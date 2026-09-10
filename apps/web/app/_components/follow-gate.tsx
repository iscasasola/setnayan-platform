'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Heart, MessageSquare } from 'lucide-react';
import { followVendor, unfollowVendor } from '@/lib/follow-actions';
import { ContactShortlistVendorButton } from '@/app/dashboard/[eventId]/vendors/_components/contact-shortlist-vendor-button';

type Props = {
  vendorProfileId: string;
  vendorName: string;
  /** True if the viewer is signed in as a couple/account. */
  isAuthenticated: boolean;
  /** Initial follow state — server-resolved before render. */
  initialFollowing: boolean;
  /**
   * The eventId the Message button should attribute the thread to. Null when
   * the viewer has no events yet — in that case Message becomes an honest
   * "Start an event to message" doorway to /dashboard (same shape as
   * SaveVendorButton's `needs_event` state, owner 2026-09-08) rather than
   * silently discarding which vendor they meant. Vendor profile page renders
   * this with the viewer's primary event when known.
   */
  eventId: string | null;
  /** Path to revalidate after toggle. Pass the current page to refresh in-place. */
  revalidatePath?: string;
  /** Visual variant. Default is the full pill row used on /v/[slug]; "card" packs tighter for vendor cards. */
  variant?: 'profile' | 'card';
};

export function FollowGate({
  vendorProfileId,
  vendorName,
  isAuthenticated,
  initialFollowing,
  eventId,
  revalidatePath,
  variant = 'profile',
}: Props) {
  const [following, setFollowing] = useState<boolean>(initialFollowing);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isCard = variant === 'card';

  const onToggle = () => {
    if (!isAuthenticated) {
      // Bounce to login with returnTo back to this page.
      const back = typeof window !== 'undefined' ? window.location.pathname : '/';
      window.location.href = `/login?next=${encodeURIComponent(back)}`;
      return;
    }
    setError(null);
    const next = !following;
    setFollowing(next); // optimistic
    startTransition(async () => {
      const result = next
        ? await followVendor(vendorProfileId, revalidatePath)
        : await unfollowVendor(vendorProfileId, revalidatePath);
      if (!result.ok) {
        setFollowing(!next); // rollback
        setError(result.message);
      }
    });
  };

  /**
   * ── FOLLOWING IS NO LONGER A PRECONDITION THE COUPLE HAS TO SOLVE ─────────
   * Owner 2026-09-08: *"message can message even if not followed."*
   *
   * The Iteration 0019 gate is real and still enforced — a restrictive INSERT
   * policy on `chat_threads` — but `startThreadByVendorEmail` now RECORDS the
   * follow when the couple presses Message instead of bouncing them back to
   * press a heart first. That is what `app/v/[slug]/inquiry-actions.ts` has
   * always done ("…2. follow the vendor (satisfies the iteration 0019
   * follow-gate RLS)"); the two doors simply disagreed, and this was the odd one.
   *
   * 🔑 THE OLD STATE WAS A PUZZLE WHOSE ANSWER WAS A DIFFERENT BUTTON. A greyed
   * "Follow to message" sat beside a bookmark that means something else
   * entirely, and the couple had to guess that a HEART was the key to CHAT.
   */
  /*
    🔴 "MESSAGE" USED TO LINK TO A FORM, NOT A CONVERSATION (2026-09-09). It
    used to build an href to the messages LIST with the vendor's email
    pre-filled into a "start a new thread" form that still needed submitting —
    and when `eventId` was null, that href pointed at
    `/dashboard?prefill_vendor_email=…`, a param `(launcher)/page.tsx` never
    reads and never forwards into create-event's `next` carry-through, so the
    address was silently dropped the moment the couple made their first event.

    `vendorProfileId` is always a real marketplace `vendor_profiles` id here
    (this component only ever renders for one) — there is no "off-platform"
    case to fall back past, so the only real branch is whether an event
    exists yet to open the thread against.
  */
  const canOpenThread = isAuthenticated && eventId != null;

  return (
    <div
      className={
        isCard
          ? 'flex flex-col gap-2 sm:flex-row sm:items-stretch'
          : 'flex flex-col gap-3 sm:flex-row sm:items-center'
      }
    >
      {/* ── NO FOLLOW BUTTON ON A SEARCH RESULT (owner 2026-09-08) ──────────
          Four controls sat on the explore card — Follow, "Follow to message",
          Save, View vendor — and two of them read as "keep this vendor" while
          doing unrelated things. Follow is the one that earns its place least:
          it produces a number NO vendor surface displays (the shop page's
          "couples saved you" counts SAVES), and the thread gate it used to
          protect is now satisfied by pressing Message.

          The relation itself stays — RLS, `unlock-category` and the inquiry
          path all read it. What goes is asking the couple to perform it as a
          separate step. The profile variant keeps the button: on a vendor's own
          page "follow this shop" is a real, unambiguous action. */}
      {isCard ? null : (
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={following}
        aria-busy={pending}
        disabled={pending}
        data-state={following ? 'following' : 'follow'}
        className={
          (following
            ? 'border-terracotta/40 bg-terracotta/10 text-terracotta-700 hover:bg-terracotta/15'
            : 'border-ink/20 bg-cream text-ink hover:bg-ink/5') +
          ' inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition disabled:cursor-wait'
        }
      >
        <Heart
          aria-hidden
          className="h-4 w-4"
          strokeWidth={1.75}
          fill={following ? 'currentColor' : 'none'}
        />
        <span>
          {following
            ? `Following${pending ? '…' : ''}`
            : `Follow${pending ? '…' : ''}`}
        </span>
      </button>
      )}

      {canOpenThread ? (
        <ContactShortlistVendorButton
          eventId={eventId!}
          vendorProfileId={vendorProfileId}
          label="Message"
          pendingLabel="Opening…"
          ariaLabel={`Message ${vendorName}`}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-ink bg-ink px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-ink/90 disabled:opacity-60"
          wrapperClassName=""
        />
      ) : isAuthenticated ? (
        // Signed in, nothing to open a thread INTO yet — the same honest
        // doorway SaveVendorButton's `needs_event` state uses (owner
        // 2026-09-08: "this is a search result outside an event"). The
        // vendor isn't lost: pressing this and then making an event is one
        // more step, not a dead end — never a silently dropped address.
        <Link
          href="/dashboard"
          title="Start an event, then message suppliers"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-terracotta/40 bg-cream px-4 py-2 text-sm font-medium text-terracotta-700 hover:border-terracotta"
        >
          <MessageSquare aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Start an event to message
        </Link>
      ) : (
        <span
          aria-disabled="true"
          title="Sign in to message"
          className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-full border border-ink/15 bg-ink/5 px-4 py-2 text-sm font-medium text-ink/40"
        >
          <MessageSquare aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Sign in to message
        </span>
      )}

      {error ? (
        <span role="alert" className="text-xs text-terracotta-700 sm:ml-2">
          {error}
        </span>
      ) : null}
    </div>
  );
}
