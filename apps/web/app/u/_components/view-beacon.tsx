'use client';

import { useEffect, useRef } from 'react';
import { recordChapterView, recordProfileView } from '../_actions/audience-actions';

// Fires a single, fire-and-forget view beacon when the public profile / chapter
// page mounts. Kept in a client island so the page itself stays ISR-cacheable:
// the aggregate view counter is bumped out of band (server action → atomic
// SECURITY DEFINER RPC, with first-party cookie dedup) instead of on the cached
// server render, which would otherwise only re-run once per revalidate window.
//
// Renders nothing. A ref guards React 18 StrictMode's double-mount in dev so a
// single page load never double-counts even before the cookie dedup kicks in.

type Props =
  | { kind: 'chapter'; id: string }
  | { kind: 'profile'; id: string };

export function ViewBeacon({ kind, id }: Props) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current || !id) return;
    fired.current = true;
    const run = kind === 'chapter' ? recordChapterView : recordProfileView;
    void run(id).catch(() => {});
  }, [kind, id]);
  return null;
}
