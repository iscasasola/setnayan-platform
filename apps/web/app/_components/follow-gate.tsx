'use client';

import { useState, useTransition } from 'react';
import { Heart, MessageSquare } from 'lucide-react';
import { followVendor, unfollowVendor } from '@/lib/follow-actions';

type Props = {
  vendorProfileId: string;
  vendorName: string;
  /** Contact email used to resume / start the chat thread via startThreadByVendorEmail. */
  vendorEmail: string | null;
  /** True if the viewer is signed in as a couple/account. */
  isAuthenticated: boolean;
  /** Initial follow state — server-resolved before render. */
  initialFollowing: boolean;
  /**
   * The eventId the Message button should attribute the thread to. Null when
   * the viewer has no events yet — in that case the Message CTA links to
   * /dashboard so they pick one. Vendor profile page renders this with the
   * viewer's primary event when known.
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
  vendorEmail,
  isAuthenticated,
  initialFollowing,
  eventId,
  revalidatePath,
  variant = 'profile',
}: Props) {
  const [following, setFollowing] = useState<boolean>(initialFollowing);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  const messageDisabled = !isAuthenticated || !following || !vendorEmail;
  const messageHint = !isAuthenticated
    ? 'Sign in to message'
    : !following
      ? 'Follow to message'
      : !vendorEmail
        ? 'Vendor has no contact email yet'
        : null;

  // Single canonical message target: the couple's primary-event messages tab
  // with the vendor email prefilled. When no event yet, drop the eventId and
  // bounce to /dashboard so the user picks one.
  const messageHref =
    isAuthenticated && following && vendorEmail
      ? eventId
        ? `/dashboard/${eventId}/messages?prefill_vendor_email=${encodeURIComponent(vendorEmail)}`
        : `/dashboard?prefill_vendor_email=${encodeURIComponent(vendorEmail)}`
      : null;

  const isCard = variant === 'card';

  return (
    <div
      className={
        isCard
          ? 'flex flex-col gap-2 sm:flex-row sm:items-stretch'
          : 'flex flex-col gap-3 sm:flex-row sm:items-center'
      }
    >
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

      {messageHref ? (
        <a
          href={messageHref}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-ink bg-ink px-4 py-2 text-sm font-medium text-cream hover:bg-ink/90"
        >
          <MessageSquare aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Message
        </a>
      ) : (
        <span
          aria-disabled="true"
          title={messageHint ?? undefined}
          className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-full border border-ink/15 bg-ink/5 px-4 py-2 text-sm font-medium text-ink/40"
        >
          <MessageSquare aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          {messageHint ?? `Message ${vendorName}`}
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
