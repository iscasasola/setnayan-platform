'use server';

import { createClient } from '@/lib/supabase/server';
import { captureEvent } from '@/lib/analytics';
import type { WebrtcSurface } from '@/lib/webrtc-telemetry';

/**
 * WebRTC connection telemetry — "how often does TURN actually kick in?"
 *
 * Fired once per peer connection (from lib/webrtc-telemetry.ts) when it reaches
 * `connected`, tagged by surface (demo · panood · panood-guest · call) with whether
 * the winning ICE candidate pair was a RELAY (TURN) or DIRECT (host/STUN). Lets the
 * owner build a PostHog insight for the relay rate + spot which surface spends the
 * 1,000 GB/mo TURN budget — the app-side companion to Cloudflare's GB dashboard.
 *
 * `panood-guest` (Wave 10) is the one that MATTERS FOR THE BILL. Guest-pick was
 * chosen on the understanding that peer-to-peer is ₱0, which is true only while
 * connections stay DIRECT; every relayed guest-viewer-hour is ~0.27 GB of billed
 * Cloudflare TURN. This tag is how "what share actually relays?" gets answered with
 * data instead of a guess.
 *
 * NO PII: only the surface + candidate-type + a relayed boolean. distinctId is
 * the user id when signed in, else a fixed anon marker (the demo is no-auth).
 * Rides `captureEvent`, which is a hard no-op when PostHog env isn't set and
 * swallows all errors — telemetry must NEVER break a call.
 */
export async function reportWebrtcConnection(args: {
  surface: WebrtcSurface;
  connectionType: string; // e.g. "srflx/relay" (local/remote candidateType)
  relayed: boolean; // did the winning pair use a TURN relay?
}): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await captureEvent({
      distinctId: user?.id ?? 'anon-webrtc',
      event: 'webrtc_connection',
      properties: {
        surface: args.surface,
        connection_type: args.connectionType,
        relayed: args.relayed,
      },
    });
  } catch {
    // Telemetry must never surface to the caller.
  }
}
