# Tayo Feature Backlog

Ideas captured during planning. Each entry includes scope, target version, and rough cost/feasibility analysis.

---

## Magazine-style personalized invitation pages (PRIMARY PREMIUM PLAY)

**Target version:** V1.5 (Premium / Pro Event tier add-on, but very low marginal cost — could be free in Premium)

**Why this is the right premium feature, not the AI video below:**

Per-guest AI video costs $0.70–2.20 each (200-guest wedding = $200–600 in provider fees). The magazine approach delivers equal or better "wow" with **near-zero marginal cost per guest** — the work is upfront design, then it scales infinitely.

**Concept:** Each guest's QR scan opens a personalized scrolling editorial page at `tayo.app/[slug]/invite/[token]` — feels like a NYTimes feature article custom-made for them.

**Shared across all guests (recorded/written once by the couple):**
- 20–30 sec phone-recorded greeting video (same for everyone)
- Love story prose, 3–4 chapters
- Couple's photos / videos
- Venue info, schedule, logistics
- Royalty-free ambient music

**Personalized per guest (pure data substitution, $0):**
- Name in the salutation: "Dear Tita Linda"
- Role: "You will be our principal sponsor / ninang / groomsman / etc."
- +1 logic — variant A: "you can bring a +1" / variant B: "we have reserved a seat just for you"
- Reserved seat number (if assigned)
- Surfaced photos that already include them (from the event gallery, when applicable)

**"Premium-feeling" elements with ~$0 cost:**

| Element | Tech | Per-guest cost |
|---|---|---|
| Choreographed scroll animations | GSAP / Framer Motion | $0 |
| Personalized monogram fusion (guest's initials interlocked with couple's) | Deterministic SVG algorithm | $0 |
| 3D parallax photo cards | Three.js or pure CSS transforms | $0 |
| Lottie animations (falling petals, calligraphy strokes) | Free Lottie library | $0 |
| Ambient music | Royalty-free track | $0 |
| One-time TTS voice greeting saying their name | Neural TTS (Google Cloud) | ~$0.001 |

**Optional "original art per guest" element:**

- **Free path:** Generative pattern art deterministically derived from the guest's name letters. Each guest gets a unique abstract signature; algorithm runs in milliseconds. $0 forever.
- **Rounding-error path:** Single AI-generated stylized illustration per guest via FLUX 2 Pro on Replicate (~$0.04/image). 200-guest wedding = $8 total. Practically free; can be absorbed in base tier without raising prices.

**Total per-guest cost:** $0 (free path) or ~$0.04–0.05 (with AI art).

**For a 200-guest wedding:** $0–$10 in provider fees vs. $200–600 for the per-guest video approach. **20–60× cheaper, equal or higher perceived value.**

**V1.5 build dependencies:**

- Editorial scrolling layout component (one design, reused per guest)
- Per-guest token routing (`/[slug]/invite/[token]`) with role + name + +1 status + seat number resolution
- GSAP / Framer Motion + Lottie integration
- Deterministic monogram-fusion SVG generator (pure function from initials)
- Optional FLUX 2 Pro illustration generation pipeline (one-shot per guest at signup, cached forever)
- Royalty-free music asset library
- Optional one-time TTS voice greeting (cached per guest)

**Why this beats the AI video:**

- Scales to any guest count at fixed cost
- Page is asynchronous: guests can scroll, share with family, return to it
- Mobile-native (most guests open on phone)
- Lower abandon rate than a 30-sec video (people scan, scroll, see their name, are hooked)
- Far easier to update if event details change post-send

---

## AI-personalized video invitations

**Target version:** Considered, deferred. The Magazine approach above is the primary premium play. Revisit only if user feedback specifically asks for video.

**Concept:** Each guest receives a short video where the couple (in their own voice and on screen) addresses the guest by name and tailors the message to that guest's role and status (+1 allowed, or specifically reserved seat).

**Script template (per guest, ~30–45 sec):**

1. "Hi [GUEST NAME]"
2. Couple's intro: how we first met / a memorable shared experience / our family connection (shared across all guests)
3. +1 logic — variant A: "And you can bring your own plus one but you have to confirm." / variant B: "I want this to be my closest people, so I have specifically reserved a seat for you."
4. "On my special day, [DATE], it would mean the world to me if you could come."
5. "You will be my [ROLE]" (e.g., ninang, ninong, groomsman, bridesmaid)
6. Logistics (shared): "The wedding ceremony will be at [CEREMONY VENUE]. The reception will be at [RECEPTION VENUE]. I hope you can arrive by [CALL TIME]."
7. CTA: "Can you make it? Yes or No?"
8. If Yes: "Great — log in your email here so we can connect you."

**Variables per guest:** GUEST NAME, +1 variant (A vs B), ROLE. Everything else is shared.

**Tech approach (lipsync + voice clone, NOT full text-to-video):**

- Couple records one master video on phone (~30 sec) and provides a 1-min voice sample.
- Voice cloning: ElevenLabs (or equivalent). Generates per-guest audio with the cloned voice using the script template.
- Lipsync: Hedra / D-ID / Sync.so. Re-syncs the master video's mouth to each per-guest audio track.
- Output: one personalized video per guest, ~30 sec, MP4 hosted on Cloudflare R2, link delivered via the guest's QR / SMS / email.

**Cost model (rough, 2025/2026 pricing):**

| Component | Per-guest cost |
|---|---|
| Voice cloning (ElevenLabs subscription amortized) | ~$0.05 |
| TTS synthesis (~500 chars per script) | ~$0.15 |
| Lipsync (Hedra / D-ID, ~30 sec) | $0.50–2.00 |
| Storage (R2, ~10 MB per video, 6-mo retention) | < $0.01 |
| **Total per guest** | **~$0.70–2.20** |

**Pricing (PHP, illustrative):**

- 100-guest wedding → cost ₱4,000–12,000 → charge as **₱9,999** Premium add-on
- 200-guest wedding → cost ₱8,000–25,000 → charge as **₱14,999–19,999** Premium add-on

**Why this is the right approach (vs. full T2V):**

Full text-to-video (Sora / Veo) at $5–50 per 30-sec video would cost $1,000–10,000 for a 200-guest wedding — not viable. Lipsync + voice clone keeps the magic of "the couple is talking to me by name, in their actual voice" while keeping per-guest cost in cents/dollars rather than tens of dollars.

**V1.5 build dependencies:**

- Couple-side recording UI (record once, voice-sample upload)
- Variable schema on `guests` table (already partly there — `role`, `plus_one_allowed`)
- Background job queue (Inngest / Vercel Queue) for the generation pipeline
- Provider integrations: ElevenLabs API + Hedra/D-ID API
- Per-video preview-and-approve flow before send

**Why defer to V1.5 (not V1):**

- V1 needs to prove the core funnel (signup → planning → RSVP → photos) works end-to-end.
- The video feature is a "magic moment" upsell, not a foundation.
- Provider APIs change rapidly; better to integrate against a stabilized 2026 lineup than to integrate now and refactor.

---

*Add new ideas below. Each entry: concept, target version, tech approach, cost model, build dependencies.*
