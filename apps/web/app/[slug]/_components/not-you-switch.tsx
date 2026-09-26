/**
 * "NOT YOU? SWITCH" — under the guest's name, for a phone a family shares
 * (owner 2026-09-26: *"yes"* to "Not you? Switch" on a shared phone).
 *
 * It clears THIS browser's guest pass (`/{slug}/sign-out`, a POST — a link
 * would be run by a prefetch) and lands on the event page as a stranger, where
 * the one button is "Get inside: Scan your QR, Tap NFC or Sign in" — so the
 * next person in the family opens their own key.
 *
 * ⚠ It clears the GUEST PASS, not a Setnayan account sign-in: a signed-in
 * account is a different person's own session and is signed out from the
 * account menu, never from somebody's invitation.
 */
export function NotYouSwitch({ slug, className = '' }: { slug: string; className?: string }) {
  return (
    <form method="post" action={`/${slug}/sign-out`} className={`text-sm text-ink/70 ${className}`}>
      Not you?{' '}
      <button
        type="submit"
        className="min-h-[44px] font-medium text-ink underline underline-offset-4 hover:text-link"
      >
        Switch
      </button>
    </form>
  );
}
