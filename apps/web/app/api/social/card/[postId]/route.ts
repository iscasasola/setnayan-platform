import { type NextRequest } from 'next/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayServiceLabel } from '@/lib/vendors';
import { resolveMonogram } from '@/lib/monogram';
import { SHARE_ARTIFACT_LABEL, type ShareArtifactType } from '@/lib/social-sharing';
import {
  renderSocialCardJpeg,
  renderFallbackCardJpeg,
  type CardContext,
  type CardFormat,
} from '@/lib/social/card';

/**
 * GET /api/social/card/[postId] — the branded social card for a social_posts
 * row, rendered on the fly (Phase B · corpus
 * `03_Strategy/Social_Sharing_Program_2026-06-12.md` § 8). `?format=story`
 * renders the 1080×1920 9:16 card (TikTok Photo Mode · Phase C); the default
 * is the 1080×1080 square (FB/IG feed). The cache key differs by URL, so the
 * immutable cache is safe for both.
 *
 * PUBLIC, no auth — by design. Facebook (/photos) and Instagram (/media) both
 * fetch this URL server-side at publish time, with no Setnayan session, so the
 * route can't gate on one. It only ever renders a card we intend to publish
 * publicly anyway, and it NEVER accepts arbitrary data: it renders strictly
 * from an existing social_posts row (404 on a missing id), reading the same
 * admin tables the dispatch reads. No PII beyond what the post already
 * publishes (couple display name / vendor business name per the program's
 * named-vs-unnamed rules) reaches the card.
 *
 * sharp + satori are native → Node runtime. Deterministic per post, so the
 * response is cached hard (immutable, 1 day).
 */
export const runtime = 'nodejs';

const CARD_HEADERS = {
  'Content-Type': 'image/jpeg',
  'Cache-Control': 'public, max-age=86400, immutable',
} as const;

/** A Buffer isn't a BodyInit; copy into a fresh Uint8Array view for Response. */
function jpegResponse(buffer: Buffer): Response {
  return new Response(new Uint8Array(buffer), { headers: CARD_HEADERS });
}

type PostRow = {
  post_id: string;
  source_type: CardContext['sourceType'];
  source_ref: string;
  title: string;
  body: string;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  // ?format=story → 1080×1920 9:16 card; anything else → 1080×1080 square.
  const format: CardFormat =
    req.nextUrl.searchParams.get('format') === 'story' ? 'story' : 'square';

  try {
    const admin = createAdminClient();

    const { data: postData, error: postErr } = await admin
      .from('social_posts')
      .select('post_id, source_type, source_ref, title, body')
      .eq('post_id', postId)
      .maybeSingle();
    if (postErr) {
      logQueryError('socialCardRoute (post lookup)', postErr, { post_id: postId });
      // A lookup error isn't a "missing post" — serve a fallback so an in-flight
      // Graph fetch never sees a broken image.
      return jpegResponse(await renderFallbackCardJpeg());
    }
    if (!postData) {
      return new Response('Not found', { status: 404 });
    }
    const post = postData as PostRow;

    const ctx = await buildCardContext(admin, post);
    const jpeg = await renderSocialCardJpeg(ctx, format);
    return jpegResponse(jpeg);
  } catch (err) {
    logQueryError('socialCardRoute (render)', err, { post_id: postId });
    // Last-ditch: a plain wordmark card. If even that throws, 500.
    try {
      return jpegResponse(await renderFallbackCardJpeg());
    } catch {
      return new Response('Card render failed', { status: 500 });
    }
  }
}

/** Resolve a post row into the per-type CardContext (secondary joins inline). */
async function buildCardContext(
  admin: ReturnType<typeof createAdminClient>,
  post: PostRow,
): Promise<CardContext> {
  switch (post.source_type) {
    case 'couple_creation':
      return coupleCreationContext(admin, post);
    case 'vendor_feature':
      return vendorFeatureContext(admin, post);
    case 'milestone':
      return milestoneContext(post);
    case 'announcement':
      return { sourceType: 'announcement', title: post.title, body: post.body };
    case 'evergreen':
      return { sourceType: 'evergreen', title: post.title, body: post.body };
    default:
      // Unknown type — render as a generic poster off title/body.
      return { sourceType: 'announcement', title: post.title, body: post.body };
  }
}

async function coupleCreationContext(
  admin: ReturnType<typeof createAdminClient>,
  post: PostRow,
): Promise<CardContext> {
  // source_ref = consent_id → consent.event_id → events(monogram + name).
  const { data: consent } = await admin
    .from('marketing_share_consents')
    .select('event_id, artifact_type')
    .eq('consent_id', post.source_ref)
    .maybeSingle();

  const artifactType = (consent?.artifact_type ?? 'monogram') as ShareArtifactType;
  const artifactLabel = SHARE_ARTIFACT_LABEL[artifactType] ?? 'Featured';

  let coupleName: string | null = null;
  let monogramText = 'S';
  let monogramColor = '#C97B4B';
  let monogramCustomSvg: string | null = null;
  let monogramStyle: string | null = null;
  let monogramFontKey: string | null = null;

  if (consent?.event_id) {
    const { data: ev } = await admin
      .from('events')
      .select(
        'display_name, monogram_custom_svg, monogram_text, monogram_color, monogram_font_key, monogram_style',
      )
      .eq('event_id', consent.event_id)
      .maybeSingle();
    if (ev) {
      coupleName = ev.display_name ?? null;
      monogramCustomSvg = ev.monogram_custom_svg ?? null;
      monogramStyle = ev.monogram_style ?? null;
      monogramFontKey = ev.monogram_font_key ?? null;
      const mono = resolveMonogram({
        display_name: ev.display_name ?? null,
        monogram_text: ev.monogram_text ?? null,
        monogram_color: ev.monogram_color ?? null,
        monogram_font_key: ev.monogram_font_key ?? null,
        monogram_style: ev.monogram_style ?? null,
      });
      monogramText = mono.text;
      monogramColor = mono.color;
    }
  }

  return {
    sourceType: 'couple_creation',
    coupleName,
    artifactLabel,
    monogramText,
    monogramColor,
    monogramCustomSvg,
    monogramStyle,
    monogramFontKey,
  };
}

async function vendorFeatureContext(
  admin: ReturnType<typeof createAdminClient>,
  post: PostRow,
): Promise<CardContext> {
  // source_ref = vendor_profile_id.
  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('business_name, services, location_city, hq_region, tier_state, tier_expires_at')
    .eq('vendor_profile_id', post.source_ref)
    .maybeSingle();

  // Pro+ derivation mirrors flush.ts / the queue page: tier_state guarded by
  // tier_expires_at (the downgrade sweep is login-driven).
  const proActive =
    (vendor?.tier_state === 'pro' || vendor?.tier_state === 'enterprise') &&
    (!vendor?.tier_expires_at || new Date(vendor.tier_expires_at).getTime() > Date.now());
  const categoryLabel = vendor?.services?.[0]
    ? displayServiceLabel(vendor.services[0])
    : 'vendor';
  const region = vendor?.hq_region ?? vendor?.location_city ?? 'the Philippines';

  return {
    sourceType: 'vendor_feature',
    named: Boolean(proActive),
    businessName: vendor?.business_name ?? '',
    categoryLabel,
    region,
  };
}

function milestoneContext(post: PostRow): CardContext {
  // The human number is already baked into the body/title (e.g. "1,000+");
  // source_ref is "metric:threshold". Prefer the threshold as the giant number.
  const [metricPart, thresholdPart] = post.source_ref.split(':');
  const metric = metricPart ?? '';
  const threshold = Number.parseInt(thresholdPart ?? '', 10);
  const number = Number.isFinite(threshold)
    ? threshold.toLocaleString('en-PH')
    : (firstNumberIn(post.title) ?? firstNumberIn(post.body) ?? '✨');

  const metricPhrase =
    MILESTONE_PHRASE[metric] ?? (metric.replace(/_/g, ' ') || 'and counting');

  return { sourceType: 'milestone', number, metricPhrase };
}

/** Human metric phrases for the giant-number milestone card. */
const MILESTONE_PHRASE: Record<string, string> = {
  events_created: 'celebrations planned on Setnayan',
  vendors_verified: 'verified vendors in the marketplace',
  guests_invited: 'guests invited through Setnayan',
};

/** First comma-formatted or plain number found in a string, e.g. "1,000". */
function firstNumberIn(text: string): string | null {
  const m = (text ?? '').match(/\d[\d,]*/);
  return m ? m[0] : null;
}
