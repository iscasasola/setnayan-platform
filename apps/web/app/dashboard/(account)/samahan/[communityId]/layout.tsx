import type { ReactNode } from 'react';
import { MarkGroupRead } from '../_components/mark-group-read';

/**
 * The group route's layout — ONLY the read marker (owner 2026-10-28, "GROUP UNREAD": opening a group marks it read).
 * It draws nothing: the group page is `page.tsx`, untouched. A layout is where this lives so every way INTO a group
 * (People › Groups, a notification, a shared link) marks it read, without the page having to remember to.
 */
export default async function GroupLayout({ children, params }: { children: ReactNode; params: Promise<{ communityId: string }> }) {
  const { communityId } = await params;
  return (
    <>
      {children}
      <MarkGroupRead communityId={communityId} />
    </>
  );
}
