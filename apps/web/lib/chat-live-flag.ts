/**
 * chat-live-flag.ts — THE KILL SWITCH for "chat arrives instantly" (owner 2026-10-29).
 *
 * ON: a signed-in tab in view joins ONE private Realtime channel, `user:<uid>` (lib/user-live-channel.ts), and the
 * Messages envelope + the inbox follow its pings — a new message shows in about a second instead of up to a minute.
 *
 * OFF (unset, or anything but true · 1 · yes · on — lib/env-flag.ts): NO browser joins a `user:` topic, and the
 * envelope re-asks on the 60 s poll exactly as on main (`followEnvelope` returns `pollEnvelope` itself). The database
 * trigger keeps writing its few content-free pings per message; with nobody listening they are dropped with
 * realtime.messages' own daily partitions.
 *
 * ⚠ "INSTANT" OFF = one env change + one redeploy. `NEXT_PUBLIC_` is inlined into the bundle at build time, so the
 * switch takes effect on the next deploy (Vercel → Redeploy), not on the next request.
 *
 * OFF BY DEFAULT. The owner's pass bar (2026-10-29: "making chat show faster should not cause error or problems in our
 * requests that may result for the website to bug down") asks for DB load measured against a real Realtime server
 * with 200 signed-in users; the lab has no Realtime server (no Docker on the build machine), so that number is not in
 * hand — the flag stays off until it is. See the PR body's pass-bar table.
 */
import { envFlagEnabled } from './env-flag';

export function isChatLiveEnabled(): boolean {
  return envFlagEnabled(process.env.NEXT_PUBLIC_CHAT_LIVE_ENABLED);
}
