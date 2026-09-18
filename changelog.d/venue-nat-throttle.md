## 2026-09-18 · feat(guests): a venue-sized throttle on the three anonymous-session doors, OFF by default

A wedding reception is a hundred-plus guests on one NAT'd venue WiFi — one
public IP. Three server actions mint a Supabase anonymous session for someone
standing at an event: `claimPapicSeat`, `claimPanoodCamera` and
`startGuestPickSession`. Before this change, nothing in the app limited any of
them per connection. The only lock besides the token is Supabase's global
captcha, which was observed OFF on 2026-09-18. When captcha is on it is
Turnstile, and Turnstile escalates to an interactive challenge when one IP
makes many requests quickly — which is what a reception looks like.

This adds `lib/venue-door-throttle.ts`, which copies the guest-list join door's
pattern (`lib/join-door-throttle.ts`) instead of inventing a new one: the same
venue sizing (`JOIN_DOOR_LIMIT` per `JOIN_DOOR_WINDOW_SECS`), the same IP read
that prefers the platform header, a salted-digest identity and the same
two-layer limiter.

- **The claim doors** key on (door, connection). They do not key on the token,
  so an enumerating script cannot rotate tokens to dodge the bucket. The
  throttle runs before the admin-client token lookup.
- **Guest-pick** keys on (door, event, connection).
- **It fails OPEN on an unreadable limiter.** The join door fails closed. These
  doors have no shared ceiling, and a limiter outage should not lock the crew
  out on the wedding day.
- **Refusal behaviour:** a refused claim redirects to `?state=throttled`, which
  shows a retryable notice above the claim form. It never shows the terminal
  "this link isn't active" screen. A refused guest-pick goes back to the
  director's cut, the same as every other refusal on that path.

**Ships OFF** behind `VENUE_DOOR_THROTTLE_ENABLED`, which is server-only and
read in one place, `lib/venue-door-flag.ts`. It is registered in
`flag-chokepoint-scan.test.ts`. With the flag off, the throttle is never
called. `venue-door-throttle.test.ts` pins that each door asks the flag, then
throttles, then mints, in that order, exactly once, with its own bucket.

⚖ The flag stays off until the owner rules on **owner decision 2, the
seat-claim trade**. The throttle cannot exempt a door from Supabase's captcha,
because that captcha is a single global switch.

SPEC IMPACT: None. The flag ships off and there is no product-visible change
until the owner flips it. The open decision is recorded in the handoff's
`05_OWNER_DECISIONS.md` #2 and is not resolved here.
