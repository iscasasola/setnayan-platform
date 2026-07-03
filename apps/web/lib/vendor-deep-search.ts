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

export const DEEP_SEARCH_MODEL = 'claude-opus-4-8';
const MAX_CONTINUATIONS = 4;

const SYSTEM_PROMPT = `You are a due-diligence researcher for Setnayan, a Philippines events-vendor marketplace. An admin is verifying a vendor's application and needs an honest picture of the vendor's real-world business footprint.

Research the vendor on the live web using web search. Prioritize: their own website, their public Facebook/Instagram pages (read what is publicly visible without logging in), Google results, PH wedding/event directories, and review sites. Look specifically for: what the business actually does, the services it advertises, ANY published prices or package rates (quote them exactly and keep the source URL), other places it exists online, and anything inconsistent with what they claimed on Setnayan (different business name, different services, dead links, signs the business is inactive or that the website belongs to someone else).

Be factual and cite-driven — only report what you actually found; never invent prices or pages. If Facebook/Instagram content is login-walled, say so rather than guessing.

End your reply with EXACTLY one fenced json block matching this shape (no prose after it):

\`\`\`json
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
