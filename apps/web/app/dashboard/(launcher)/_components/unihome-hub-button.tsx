'use client';

import { Eye } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { openEventHub } from '@/lib/open-external';

/**
 * The event card's "Event Hub" button (Unihome v5). Drawn only when guests can open the hub (Public, or Unlisted with
 * its link — the shipped rule, read once by Home). It opens the way the board's ⋯ "View Event Hub" always did
 * (`openEventHub`): the in-app browser sheet in the app, a new tab on the web.
 */
export function UnihomeHubButton({ href, eventName, small = false }: { href: string; eventName: string; small?: boolean }) {
  return (
    <ActionButton
      tone="neutral"
      quiet={!small}
      icon={Eye}
      label="Event Hub"
      name={`Event Hub for ${eventName}`}
      href={href}
      target="_blank"
      data-unihome-hub=""
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        openEventHub(href);
      }}
    />
  );
}
