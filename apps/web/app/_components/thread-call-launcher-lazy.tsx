'use client';

/**
 * Client-only loader for the in-thread CALL launcher (Relationship Workspace ·
 * "Call" tab). ThreadCallLauncher pulls in the WebRTC room + `lib/call-webrtc`
 * (RTCPeerConnection, getUserMedia — browser-only, no SSR value), so it's the
 * heaviest interactive tab in the workspace shell yet it's rarely the tab a
 * user opens first. Code-splitting it with `next/dynamic({ ssr: false })` keeps
 * that bundle out of the initial page JS until the Call tab actually mounts on
 * the client — mirroring the seating-lab / veil-reveal loader pattern.
 *
 * The launcher's surrounding tab content is server-rendered by the page; only
 * this leaf is client-lazy, so no server SSR is affected.
 */

import dynamic from 'next/dynamic';

const ThreadCallLauncher = dynamic(
  () => import('./thread-call-launcher').then((m) => m.ThreadCallLauncher),
  {
    ssr: false,
    loading: () => (
      <div
        className="rounded-xl border border-ink/10 bg-ink/[0.03] px-4 py-3 text-xs text-ink/55"
        role="status"
        aria-live="polite"
      >
        Loading call…
      </div>
    ),
  },
);

export function ThreadCallLauncherLazy(props: {
  threadId: string;
  currentUserId: string;
  counterpartyLabel?: string;
}) {
  return <ThreadCallLauncher {...props} />;
}
