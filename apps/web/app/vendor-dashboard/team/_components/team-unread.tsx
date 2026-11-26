import { RotateCw } from 'lucide-react';
import { ErrorState } from '@/app/_components/states/error-state';
import { ActionButton } from '@/components/action-button';

/**
 * 🪪 "Couldn't load your team" — what Team, Roles and Who gets new inquiries draw when the manager read was REFUSED
 * (`readTeamManagerContext` → 'unread'). Not the role lock (the person may well be the Shop Manager) and not a silent
 * bounce home. Final check A5-G5-07. `retryHref` is the page itself.
 */
export function TeamUnread({ retryHref }: { retryHref: string }) {
  return (
    <ErrorState
      title="Couldn’t load your team"
      broke="We couldn’t read who runs this shop just now."
      survived="Your team is still there — nothing was changed."
      todo="Try again in a moment."
      actions={
        <ActionButton
          tone="brand"
          main
          icon={<RotateCw aria-hidden className="h-4 w-4" strokeWidth={1.9} />}
          label="Try again"
          href={retryHref}
        />
      }
    />
  );
}
