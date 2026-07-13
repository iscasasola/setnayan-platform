import 'server-only';

/**
 * Cloudflare Realtime TURN — short-lived relay credentials for the WebRTC
 * transports. Public STUN alone can't punch a path through symmetric NAT /
 * CGNAT (Philippine mobile data, client-isolated venue/guest Wi-Fi), so peers
 * on those networks need a TURN relay to connect AT ALL. This is the fix for
 * "the Live Studio demo syncs for some phones but not others" — the failures
 * are network-topology, not device: without a relay, a hard-NAT pair has
 * nowhere to meet.
 *
 * Credentials are minted server-side per connection with a short TTL and handed
 * to the browser as ICE server entries; the API token NEVER reaches the client.
 *
 * Env (owner provisions a TURN key in the Cloudflare dashboard →
 * Realtime → TURN):
 *   CLOUDFLARE_TURN_KEY_ID     — the TURN key id
 *   CLOUDFLARE_TURN_API_TOKEN  — that key's API token (server-only secret)
 *
 * Unconfigured (either var missing) OR a Cloudflare error → returns [] and the
 * caller falls back to STUN-only, i.e. exactly the pre-TURN behavior. This
 * NEVER throws: a TURN outage must degrade the demo, not break it.
 */

const TURN_KEY_ID = process.env.CLOUDFLARE_TURN_KEY_ID;
const TURN_API_TOKEN = process.env.CLOUDFLARE_TURN_API_TOKEN;

/**
 * TTL for a minted credential. Comfortably outlives the homepage demo session
 * (DEMO_SESSION_TTL_MINUTES = 20) so a credential never expires mid-demo.
 */
const DEFAULT_TTL_SECONDS = 30 * 60;

/** Cloudflare's `generate` endpoint returns a single object; be tolerant of an array too. */
type CloudflareTurnResponse = { iceServers?: RTCIceServer | RTCIceServer[] };

export function turnConfigured(): boolean {
  return Boolean(TURN_KEY_ID && TURN_API_TOKEN);
}

/**
 * Mint ICE server entries carrying a fresh Cloudflare TURN username/credential.
 * Returns [] when TURN isn't configured or Cloudflare errors — the transport
 * still connects over STUN for the majority of networks, so any failure here
 * degrades gracefully to the old STUN-only behavior.
 */
export async function mintTurnIceServers(ttlSeconds = DEFAULT_TTL_SECONDS): Promise<RTCIceServer[]> {
  if (!TURN_KEY_ID || !TURN_API_TOKEN) return [];
  try {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/credentials/generate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TURN_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: ttlSeconds }),
        cache: 'no-store',
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as CloudflareTurnResponse;
    const raw = data.iceServers;
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  } catch {
    return [];
  }
}
