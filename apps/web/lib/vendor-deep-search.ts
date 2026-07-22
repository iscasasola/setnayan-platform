import Anthropic from '@anthropic-ai/sdk';

/**
 * Vendor deep-search analytics (owner 2026-07-03).
 *
 * Given a vendor's website + social link + shop name + location, run a live
 * web research pass (Claude + the web_search server tool) and produce a
 * structured due-diligence dossier for the admin verification review:
 *
 *   • what the business is (summary)
 *   • what services it advertises online
 *   • price signals found on the open web, each with a source URL
 *   • where else it lives online (site, FB/IG page, directories, reviews)
 *   • consistency flags vs. what the vendor claimed on Setnayan
 *
 * Facebook/Instagram POST content is login-walled — the dossier reads what is
 * publicly reachable and the admin card pairs it with deterministic deep links
 * into Meta Ad Library + Google Ads Transparency Center (both public, both
 * show every ad a page/advertiser runs — the legitimate "search their ads"
 * path; see adTransparencyLinks below).
 *
 * Results are stored in vendor_web_dossiers (admin-only RLS). This module is
 * imported by server code only (admin actions + the admin verify page).
 */

// ---------------------------------------------------------------------------
// Dossier shape (stored as vendor_web_dossiers.dossier)
// ---------------------------------------------------------------------------

export type DossierPriceSignal = {
  label: string;
  price: string;
  source_url: string | null;
};

export type DossierPresence = {
  platform: string;
  url: string | null;
  note: string | null;
};

export type VendorDossier = {
  business_summary: string;
  detected_services: string[];
  price_signals: DossierPriceSignal[];
  web_presence: DossierPresence[];
  ads_findings: string | null;
  consistency_flags: string[];
  category_match: 'match' | 'partial' | 'mismatch' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
};

export type DeepSearchInputs = {
  business_name: string;
  website: string | null;
  social_url: string | null;
  location_city: string | null;
  claimed_services: string[];
};

export type DossierRow = {
  id: number;
  vendor_profile_id: string;
  application_id: string | null;
  status: 'running' | 'complete' | 'failed';
  inputs: DeepSearchInputs;
  dossier: VendorDossier | null;
  error: string | null;
  model: string | null;
  created_at: string;
  completed_at: string | null;
};

// ---------------------------------------------------------------------------
// Deterministic ad-transparency deep links (no AI involved)
// ---------------------------------------------------------------------------

/**
 * Public, login-free surfaces that list every ad a business is running.
 * Meta Ad Library covers Facebook + Instagram ads; Google's Ads Transparency
 * Center covers Search/YouTube/Display. Both accept a plain search query.
 */
export function adTransparencyLinks(businessName: string): Array<{ label: string; href: string }> {
  const q = encodeURIComponent(businessName.trim());
  return [
    {
      label: 'Meta Ad Library (FB + IG ads)',
      href: `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=PH&q=${q}&search_type=keyword_unordered`,
    },
    {
      label: 'Google Ads Transparency',
      href: `https://adstransparency.google.com/?region=PH&query=${q}`,
    },
  ];
}

// ---------------------------------------------------------------------------
// The research run
// ---------------------------------------------------------------------------

// Owner 2026-07-03: the paid AI dossier defaults to Haiku (~₱9/run) not Opus
// (~₱28/run) — this is a due-diligence glance, not a critical call. Swap here to
// change the model everywhere. The Lite (keyless) mode below needs no model.
export const DEEP_SEARCH_MODEL = 'claude-haiku-4-5-20251001';

/** Marker stored in vendor_web_dossiers.model for a keyless Lite (no-AI) run. */
export const DEEP_SEARCH_LITE_MODEL = 'lite';

const MAX_CONTINUATIONS = 4;

/** Marker stored in vendor_web_dossiers.model for a dossier pasted back from a free AI chat. */
export const DEEP_SEARCH_CHAT_MODEL = 'manual-chat';

/**
 * The exact JSON shape both the API dossier AND the copy-paste chat prompt ask
 * for — ONE source so parseDossierText can read either result back. Shared by
 * SYSTEM_PROMPT and buildDeepSearchChatPrompt so the two can never drift.
 */
export const DOSSIER_JSON_SCHEMA_BLOCK = `\`\`\`json
{
  "business_summary": "2-4 sentence plain-English summary of what this business is",
  "detected_services": ["service the web says they offer", "..."],
  "price_signals": [{"label": "what is priced", "price": "₱ amount or range exactly as published", "source_url": "https://…"}],
  "web_presence": [{"platform": "Website | Facebook | Instagram | TikTok | Google Maps | Directory | Review site", "url": "https://… or null", "note": "one line on what's there"}],
  "ads_findings": "what you could determine about their advertising, or null",
  "consistency_flags": ["specific mismatch or concern, one per entry — empty array if clean"],
  "category_match": "match | partial | mismatch | unknown",
  "confidence": "high | medium | low"
}
\`\`\``;

const SYSTEM_PROMPT = `You are a due-diligence researcher for Setnayan, a Philippines events-vendor marketplace. An admin is verifying a vendor's application and needs an honest picture of the vendor's real-world business footprint.

Research the vendor on the live web using web search. Prioritize: their own website, their public Facebook/Instagram pages (read what is publicly visible without logging in), Google results, PH wedding/event directories, and review sites. Look specifically for: what the business actually does, the services it advertises, ANY published prices or package rates (quote them exactly and keep the source URL), other places it exists online, and anything inconsistent with what they claimed on Setnayan (different business name, different services, dead links, signs the business is inactive or that the website belongs to someone else).

Be factual and cite-driven — only report what you actually found; never invent prices or pages. If Facebook/Instagram content is login-walled, say so rather than guessing.

End your reply with EXACTLY one fenced json block matching this shape (no prose after it):

${DOSSIER_JSON_SCHEMA_BLOCK}`;

/**
 * A fully self-contained research prompt the admin can COPY and paste into any
 * web-browsing AI chat (Gemini, ChatGPT, Copilot, etc.) to get the dossier for
 * FREE — no API key, no per-run cost. The vendor's facts are baked in, the
 * ad-library links are included, and it ends with the exact JSON schema so the
 * chat's answer pastes straight back into "Save pasted result" (parseDossierText
 * reads the fenced json block). This is the third, zero-cost research tier
 * alongside Lite (keyless fetch) and the AI dossier (paid API).
 */
export function buildDeepSearchChatPrompt(inputs: DeepSearchInputs): string {
  const ads = adTransparencyLinks(inputs.business_name || 'this vendor');
  return [
    'You are a due-diligence researcher helping verify an events vendor in the Philippines. Use web search / browsing to research the business below and give an honest picture of its real footprint.',
    '',
    'VENDOR (as claimed on our platform):',
    `• Business name: ${inputs.business_name || '(none given)'}`,
    `• Claimed services: ${inputs.claimed_services.length > 0 ? inputs.claimed_services.join(', ') : '(none listed)'}`,
    `• Location: ${inputs.location_city ?? '(not given)'}`,
    `• Website: ${inputs.website ?? '(not given)'}`,
    `• Social link: ${inputs.social_url ?? '(not given)'}`,
    '',
    'Research their own website, public Facebook/Instagram pages (only what is visible without logging in), Google results, Philippine wedding/event directories, and review sites. Find: what the business actually does, the services it advertises, ANY published prices or package rates (quote them exactly and keep the source URL), other places it exists online, and anything inconsistent with the claim above (different name or services, dead links, signs the business is inactive or the website belongs to someone else). Only report what you actually find — never invent prices or pages. If Facebook/Instagram content is login-walled, say so.',
    '',
    'You can also check their ads directly (public, no login needed):',
    ...ads.map((a) => `• ${a.label}: ${a.href}`),
    '',
    'End your reply with EXACTLY one fenced json block in this shape and nothing after it:',
    '',
    DOSSIER_JSON_SCHEMA_BLOCK,
  ].join('\n');
}

/**
 * A staff-facing "study this vendor before the interview" prompt (owner
 * 2026-07-03). Distinct from the verification dossier: this is for the Setnayan
 * team to judge whether a vendor is a good FIT to onboard and to walk into the
 * interview prepared. Copy → paste into any web-browsing AI chat (free), read
 * the brief. No JSON, no paste-back — it's prep to read, not a record to store.
 * Vendors are public businesses (never private individuals), so open-web
 * research here is proportionate.
 */
export function buildVendorStudyPrompt(inputs: DeepSearchInputs): string {
  const ads = adTransparencyLinks(inputs.business_name || 'this vendor');
  return [
    'You are helping the Setnayan team — a premium Philippines events & wedding marketplace — study a vendor BEFORE an interview, to judge whether they are a good fit to onboard and to prepare sharp, specific interview questions. Use web search / browsing to research them.',
    '',
    'VENDOR:',
    `• Business name: ${inputs.business_name || '(none given)'}`,
    `• Services they offer: ${inputs.claimed_services.length > 0 ? inputs.claimed_services.join(', ') : '(none listed)'}`,
    `• Location: ${inputs.location_city ?? '(not given)'}`,
    `• Website: ${inputs.website ?? '(not given)'}`,
    `• Social link: ${inputs.social_url ?? '(not given)'}`,
    '',
    'Research their website, public Facebook/Instagram, Google results, Philippine wedding/event directories, and review sites. Then write a study brief for the team with these sections:',
    '',
    '1. WHAT THEY ARE — a plain 2–4 sentence picture of the business: how established they look, how long they seem to have operated, and their apparent price tier (budget / mid / premium).',
    '2. QUALITY & REPUTATION SIGNALS — portfolio quality, review sentiment (quote one or two real snippets with the source), notable clients or press, how consistent and professional their brand is.',
    '3. STRENGTHS — the concrete reasons they could be a strong addition to a premium marketplace.',
    '4. CONCERNS / RED FLAGS — anything that argues against a fit: thin or dated portfolio, poor reviews, inactive pages, unclear pricing, unprofessional presence, or signs they resell others’ work or are not who they claim.',
    '5. FIT VERDICT — one line: Strong fit / Possible fit / Weak fit — plus the single biggest reason.',
    '6. INTERVIEW QUESTIONS — 6–8 specific questions to ask THIS vendor, drawn from what you found: probe the concerns, confirm capacity and availability, clarify pricing, and verify the work shown is genuinely theirs.',
    '',
    'Be factual and cite-driven — only report what you actually find; never invent reviews, clients, or prices. If their social content is login-walled, say so. You can also check their ads directly (public, no login needed):',
    ...ads.map((a) => `• ${a.label}: ${a.href}`),
  ].join('\n');
}

function buildUserPrompt(inputs: DeepSearchInputs): string {
  const lines = [
    `Vendor claimed on Setnayan:`,
    `• Business name: ${inputs.business_name}`,
    `• Claimed services: ${inputs.claimed_services.length > 0 ? inputs.claimed_services.join(', ') : '(none listed)'}`,
    `• Location: ${inputs.location_city ?? '(not given)'}`,
    `• Website: ${inputs.website ?? '(not given)'}`,
    `• Social link: ${inputs.social_url ?? '(not given)'}`,
    ``,
    `Research this vendor now and produce the dossier.`,
  ];
  return lines.join('\n');
}

/** Extract the trailing fenced JSON block (or the last {...} span) and parse it. */
export function parseDossierText(text: string): VendorDossier | null {
  const fenced = [...text.matchAll(/```json\s*([\s\S]*?)```/g)];
  const candidates: string[] = [];
  const lastFence = fenced[fenced.length - 1]?.[1];
  if (typeof lastFence === 'string') candidates.push(lastFence);
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1));

  for (const raw of candidates) {
    try {
      const parsed = JSON.parse(raw) as Partial<VendorDossier>;
      if (typeof parsed.business_summary !== 'string') continue;
      return {
        business_summary: parsed.business_summary,
        detected_services: Array.isArray(parsed.detected_services)
          ? parsed.detected_services.filter((s): s is string => typeof s === 'string')
          : [],
        price_signals: Array.isArray(parsed.price_signals)
          ? parsed.price_signals
              .filter((p): p is DossierPriceSignal => !!p && typeof p === 'object')
              .map((p) => ({
                label: String(p.label ?? ''),
                price: String(p.price ?? ''),
                source_url: typeof p.source_url === 'string' ? p.source_url : null,
              }))
          : [],
        web_presence: Array.isArray(parsed.web_presence)
          ? parsed.web_presence
              .filter((w): w is DossierPresence => !!w && typeof w === 'object')
              .map((w) => ({
                platform: String(w.platform ?? ''),
                url: typeof w.url === 'string' ? w.url : null,
                note: typeof w.note === 'string' ? w.note : null,
              }))
          : [],
        ads_findings: typeof parsed.ads_findings === 'string' ? parsed.ads_findings : null,
        consistency_flags: Array.isArray(parsed.consistency_flags)
          ? parsed.consistency_flags.filter((s): s is string => typeof s === 'string')
          : [],
        category_match:
          parsed.category_match === 'match' ||
          parsed.category_match === 'partial' ||
          parsed.category_match === 'mismatch'
            ? parsed.category_match
            : 'unknown',
        confidence:
          parsed.confidence === 'high' || parsed.confidence === 'medium' ? parsed.confidence : 'low',
      };
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/**
 * Run the live research pass. Throws with a human-readable message on any
 * failure (missing key, API error, unparseable result) — the caller stores it
 * on the dossier row's `error` column.
 */
export async function runDeepSearch(inputs: DeepSearchInputs): Promise<VendorDossier> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY is not configured — add it to the Vercel environment to enable deep search.',
    );
  }

  const client = new Anthropic();
  const userPrompt = buildUserPrompt(inputs);

  let messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }];
  let finalText = '';

  // Server-tool loop: web_search runs server-side; stop_reason 'pause_turn'
  // means the server-side search loop hit its iteration cap — resume by
  // re-sending the assistant turn (per the tool-use docs).
  for (let i = 0; i <= MAX_CONTINUATIONS; i += 1) {
    const stream = client.messages.stream({
      model: DEEP_SEARCH_MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system: SYSTEM_PROMPT,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 8 }],
      messages,
    });
    const response = await stream.finalMessage();

    if (response.stop_reason === 'pause_turn' && i < MAX_CONTINUATIONS) {
      messages = [
        { role: 'user', content: userPrompt },
        { role: 'assistant', content: response.content },
      ];
      continue;
    }

    finalText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    break;
  }

  const dossier = parseDossierText(finalText);
  if (!dossier) {
    throw new Error('Deep search finished but returned an unreadable result — try re-running.');
  }
  return dossier;
}

// ---------------------------------------------------------------------------
// Lite (keyless) mode — the free, no-AI, ₱0 default (owner 2026-07-03)
// ---------------------------------------------------------------------------
//
// When ANTHROPIC_API_KEY isn't configured, deep search still does something
// useful: fetch the vendor's own website and pull out what's deterministically
// visible — page title + meta description, any ₱ price signals on the page, and
// the known presence links — with NO AI and NO cost. The admin reads and judges
// (category_match/confidence stay 'unknown'/'low' — no machine verdict). Pairs
// with the always-on ad-transparency deep links (adTransparencyLinks). When the
// key IS present, the AI dossier (runDeepSearch) is the richer upgrade.

/** Add a scheme if the vendor typed a bare host; return null for junk. */
export function normalizeSiteUrl(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** First <title>…</title>, collapsed + trimmed. */
export function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1] ?? '').replace(/\s+/g, ' ').trim().slice(0, 200) : '';
}

/** <meta name/property="description|og:description" content="…">. */
export function extractMetaDescription(html: string): string {
  const patterns = [
    /<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]*content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["'](?:description|og:description)["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return decodeEntities(m[1] ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
  }
  return '';
}

/** Strip tags + script/style so price regex runs over visible-ish text. */
export function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

/**
 * Pull ₱ / PHP / Php price mentions out of page text, each with a little
 * surrounding context as the label. Deduped, capped. Deterministic — no AI.
 */
export function extractPesoSignals(text: string): Array<{ label: string; price: string }> {
  const clean = decodeEntities(text).replace(/\s+/g, ' ');
  // ₱ or PHP/Php, an amount (with optional thousands + decimals), optional range.
  const re = /(?:₱|php\s?|php)\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?(?:\s?[–\-to]{1,3}\s?(?:₱|php\s?)?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)?/gi;
  const seen = new Set<string>();
  const out: Array<{ label: string; price: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(clean)) !== null && out.length < 20) {
    const price = match[0].replace(/\s+/g, ' ').trim();
    const key = price.toLowerCase().replace(/\s/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    const start = Math.max(0, match.index - 40);
    const end = Math.min(clean.length, match.index + match[0].length + 40);
    const label = clean.slice(start, end).trim();
    out.push({ label, price });
  }
  return out;
}

/** Fetch a vendor site (best-effort, timed out, HTML only) and parse it. */
async function fetchSiteFacts(
  rawUrl: string,
): Promise<{ url: string; title: string; description: string; prices: Array<{ label: string; price: string }> } | null> {
  const url = normalizeSiteUrl(rawUrl);
  if (!url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        // A plain, honest UA — some hosts 403 an empty one.
        'user-agent': 'Mozilla/5.0 (compatible; SetnayanVerify/1.0; +https://www.setnayan.com)',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('html') && !ct.includes('text')) return null;
    // Cap the body so a huge page can't blow memory.
    const html = (await res.text()).slice(0, 500_000);
    return {
      url,
      title: extractTitle(html),
      description: extractMetaDescription(html),
      prices: extractPesoSignals(stripTags(html)),
    };
  } catch {
    return null; // dead link, DNS fail, timeout, TLS error — all "couldn't read"
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The free, keyless due-diligence pass. NEVER throws for a normal miss (a dead
 * or blocked website just yields an empty-but-honest dossier); the admin still
 * gets the ad-transparency links and the raw facts to judge.
 */
export async function runLiteDeepSearch(inputs: DeepSearchInputs): Promise<VendorDossier> {
  const web_presence: DossierPresence[] = [];
  const price_signals: DossierPriceSignal[] = [];
  let read = '';

  if (inputs.social_url) {
    web_presence.push({
      platform: 'Social',
      url: inputs.social_url,
      note: 'Claimed social link — open to review (posts may be login-walled).',
    });
  }

  if (inputs.website) {
    const facts = await fetchSiteFacts(inputs.website);
    if (facts) {
      read = [facts.title, facts.description].filter(Boolean).join(' — ');
      web_presence.unshift({
        platform: 'Website',
        url: facts.url,
        note: facts.title || 'Reachable',
      });
      for (const p of facts.prices) {
        price_signals.push({ label: p.label, price: p.price, source_url: facts.url });
      }
    } else {
      web_presence.unshift({
        platform: 'Website',
        url: normalizeSiteUrl(inputs.website),
        note: 'Could not fetch — dead link, blocked, or timed out. Open it manually.',
      });
    }
  }

  const business_summary = read
    ? `Lite result (no AI) — read directly from the website: ${read}`.slice(0, 600)
    : `Lite result (no AI). ${
        inputs.website
          ? "Couldn't read the website automatically."
          : 'No website was given to read.'
      } Use the ad-transparency links and open the pages to verify this vendor.`;

  return {
    business_summary,
    detected_services: [],
    price_signals,
    web_presence,
    ads_findings: null,
    consistency_flags: [],
    category_match: 'unknown',
    confidence: 'low',
  };
}

/**
 * Is the AI research engine configured (ANTHROPIC_API_KEY present)? When FALSE,
 * runDeepSearchOrLite silently falls back to the free keyless Lite pass — which
 * is FINE for a free run, but a PAID (₱500) Deep Search must NOT be sold, because
 * the buyer would be charged for the same result the free tier already gets. The
 * paid buy action gates on this. Server-only env read.
 */
export function deepSearchAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Run deep search the best way available: the AI dossier when ANTHROPIC_API_KEY
 * is set (Haiku by default), otherwise the free keyless Lite pass. Returns the
 * dossier plus the model marker to store on the row so the admin sees which ran.
 */
export async function runDeepSearchOrLite(
  inputs: DeepSearchInputs,
): Promise<{ dossier: VendorDossier; model: string }> {
  if (process.env.ANTHROPIC_API_KEY) {
    return { dossier: await runDeepSearch(inputs), model: DEEP_SEARCH_MODEL };
  }
  return { dossier: await runLiteDeepSearch(inputs), model: DEEP_SEARCH_LITE_MODEL };
}

// Minimal HTML entity decode for the handful that show up in titles/prices.
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8369;|&#x20b1;/gi, '₱')
    .replace(/&#(\d+);/g, (_, d) => {
      const n = Number(d);
      return Number.isFinite(n) && n > 0 && n < 0x10ffff ? String.fromCodePoint(n) : _;
    });
}
