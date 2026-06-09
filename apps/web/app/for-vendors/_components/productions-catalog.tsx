/**
 * /for-vendors Section 4 — The Complete Offering
 *
 * Editorial catalog of (a) the 18 complimentary couple tools, (b) the 13
 * Token-Worthy Productions services, and (c) the 8 Direct Productions
 * services. Reads live from `platform_retail_catalog_v2` via
 * `fetchV2CustomerCatalog` so admin price edits propagate to /for-vendors
 * within seconds (revalidate=3600 ISR + revalidatePath fired from the
 * admin save action · see /admin/pricing/actions.ts updatePlatformRetailCatalog).
 *
 * WHY this lives in /for-vendors/_components and not as a shared /pricing
 * surface:
 *   /pricing already renders the catalog (force-dynamic · 714-line page ·
 *   reads the same lib/v2-catalog.ts helpers). This component is the
 *   editorial /for-vendors framing — Vogue/Apple register · champagne-gold
 *   rules · per-service positioning copy locked to brand voice · vendor-
 *   recommendable subtitle on Token-Worthy items. Different audience ·
 *   different visual treatment · same source data.
 *
 * Three data shapes:
 *   1. COMPLIMENTARY_TOOLS — hardcoded list of the 18 free planning tools
 *      from v2.1 brief § 4. These are NOT rows in platform_retail_catalog_v2
 *      (they're foundational features built into the platform, not SKUs).
 *      Brand-voice grouping (Plan it · Find your vendors · Trust comes free).
 *   2. POSITIONING — per-service editorial copy keyed by service_code.
 *      Sits in code, not in DB, because admin editing of brand-voice copy
 *      is a different governance concern from price editing (different
 *      review gate · different drift surface). Admin changes the DB price ·
 *      brand strategist updates the positioning copy via PR.
 *   3. Live catalog rows from lib/v2-catalog.ts — title + price + token_able
 *      flag + build_status (live/partial/not_built · honest about what
 *      actually works).
 *
 * Auto-update guarantee: admin saves a price in /admin/pricing →
 * `updatePlatformRetailCatalog` server action calls
 * `revalidatePath('/for-vendors')` → next visitor sees the new price.
 * No re-deploy required. Build status stays code-managed (admin can't
 * accidentally promote 'not_built' to 'live').
 *
 * Per CLAUDE.md tenth + eleventh 2026-05-28 rows (v2.1 brief canonical) +
 * 2026-05-29 row "Clean Editorial palette" (--m-* tokens for the visual).
 */

import { fetchV2CustomerCatalog, formatPeso, type V2CustomerSku } from '@/lib/v2-catalog';

// ─── Complimentary tools (v2.1 brief § 4 · 18 free things) ─────────────
// Plain English groupings per v2.1 § 4 sub-sections. Not in
// platform_retail_catalog_v2 because they're foundational features (free
// forever, not toggleable, not priced). If/when a free tool becomes a paid
// upgrade tier, it migrates into the V2 catalog with retail_price_php > 0
// and the "Plan it" / "Find your vendors" / "Trust comes free" sections
// here lose one entry.
const COMPLIMENTARY_TOOLS = {
  'Plan it': [
    'Guest List Maker',
    'Seat Plan',
    'Budget Tracker',
    'Scheduler',
    'Never-miss-a-thing checklist',
    'Inspiration board',
    'A basic monogram',
    'A basic wedding website at your slug',
  ],
  'Find your vendors': [
    'Couple matching',
    'Side-by-side quote comparison',
    'Unlimited bid requests',
    'Direct chat with vendors',
    "Bring your tita's florist (BYO vendor flow)",
    'Choose freely',
  ],
  'Trust comes free': [
    'Verified badge on every listing',
    'Real reviews from real Setnayan weddings',
    'Shortlist collision alert',
  ],
} as const;

// ─── Per-service editorial positioning ─────────────────────────────────
// Brand-voice one-liners per service_code. Pulled from the For Vendors copy
// deck drafted 2026-05-30 + ratified by founder. Sits in code (not DB)
// because brand-voice copy is a different governance surface from price.
// Admin editing of prices does not touch this map; brand strategist edits
// it via PR. If a service_code is missing from this map, the component
// falls back to the DB `description` field, or omits the row gracefully.
const POSITIONING: Record<string, string> = {
  // Token-Worthy services (is_token_able=TRUE in platform_retail_catalog_v2)
  ANIMATED_MONOGRAM:
    'A bespoke monogram, drawn for your union and animated for the moments it matters most.',
  PRO_WEBSITE:
    'A premium invitation, event page, and editorial archive at a custom slug.',
  PANOOD_SYSTEM:
    'Live broadcast embedded directly on your wedding page. Calendar-day pricing; multi-day weddings scale gracefully.',
  PATIKTOK_COMPILER:
    'Up to two hundred and fifty vertical clips in TikTok-native format, ready for the feed before the reception ends.',
  PAKANTA:
    'A custom AI wedding song. Royalty-free. Yours forever.',
  PAPIC_GUEST:
    'The disposable camera, reimagined. Twenty-four photographs, ten five-second videos, three months of high-resolution archive plus a Google Drive transfer.',
  PAPIC_ADDON_THANK_YOU:
    'A composed five-minute thank-you film, edited by our Papic crew.',
  SDE:
    'A three-minute Same-Day Edit, compiled and delivered before the reception dinner concludes.',
  PAPIC_SEATS:
    'Unlimited photographs and videos across five seats, five hours of coverage.',
  LIVE_WALL:
    'A live collage of guest photographs, refreshed in real time.',
  LIVE_BACKGROUND:
    'A custom LED wall design featuring your monogram, designed for the projected backdrop.',
  PAPIC_ADDON_STORIES:
    'A thirty-second story maker built around your wedding, ready for the feed.',
  CAMERA_BRIDGE:
    'Connect any DSLR to the Papic and Panood pipeline.',

  // Direct services (is_token_able=FALSE in platform_retail_catalog_v2)
  PAKULAY:
    'Cultural conflict catcher. Included with every account, woven into the planning surface.',
  CUSTOM_QR_GUEST:
    'One unique QR code per guest, up to two hundred and fifty.',
  INDOOR_BLUEPRINT:
    'From entrance to table — the floor guide your guests follow without asking.',
  CALL_TIME_ESCALATOR:
    'One SMS broadcast to every vendor when the schedule shifts.',
  PABATI:
    'Up to three hundred five-second video greetings, woven into your guest microsite.',
  HIGH_RES_ARCHIVE:
    'Annual archive of your wedding’s complete media. Cancel any time.',
};

// ─── Helper · format the price tag for a single row ────────────────────
// `retail_price_php` is in pesos NUMERIC (not centavos · the V2 catalog
// uses NUMERIC(10,2) for retail_price_php · confirmed via the original
// CREATE TABLE in migration 20260628000000). Free items render as
// "Complimentary" in brand voice. Yearly items get a "/ year" suffix
// (only High Res Archive at present). Daily items get a "/ day" suffix
// (only Panood at present).
function formatPrice(sku: V2CustomerSku): string {
  if (sku.retail_price_php === 0) return 'Complimentary';
  if (sku.service_code === 'HIGH_RES_ARCHIVE') {
    return `₱${formatPeso(sku.retail_price_php)} / year`;
  }
  if (sku.service_code === 'PANOOD_SYSTEM') {
    return `₱${formatPeso(sku.retail_price_php)} / day`;
  }
  // Pax-priced SKUs (PAPIC_GUEST · migration 20260720000000) scale with guest
  // count — no event context here, so anchor on the floor with a "from" prefix
  // (₱2,999 @ 100 pax · +₱350 / 50). Owner-locked 2026-06-02.
  if (sku.is_pax_priced) {
    return `from ₱${formatPeso(sku.retail_price_php)}`;
  }
  return `₱${formatPeso(sku.retail_price_php)}`;
}

// ─── Component ─────────────────────────────────────────────────────────
export async function ProductionsCatalog() {
  const catalog = await fetchV2CustomerCatalog();

  // Bucket the V2 catalog by token_able + free status. Pakulay (FREE +
  // not token_able) sits at the top of the Direct group with a
  // "Complimentary" badge instead of a price — it's not free planning
  // (those are above) but free Productions.
  const tokenWorthy = catalog
    .filter((sku) => sku.is_token_able && sku.retail_price_php > 0)
    .sort((a, b) => a.retail_price_php - b.retail_price_php);
  const directPaid = catalog
    .filter((sku) => !sku.is_token_able && sku.retail_price_php > 0)
    .sort((a, b) => a.retail_price_php - b.retail_price_php);
  const directFree = catalog.filter((sku) => sku.retail_price_php === 0);

  return (
    <section
      style={{
        padding: '120px 56px',
        background: 'var(--m-paper)',
        borderTop: '1px solid var(--m-orange-3)',
      }}
    >
      <div className="m-eyebrow">The complete offering</div>
      <h2
        className="m-serif"
        style={{
          fontSize: 'clamp(48px, 6vw, 76px)',
          lineHeight: 1.04,
          margin: '20px 0 24px',
          maxWidth: 1100,
          letterSpacing: '-0.02em',
          color: 'var(--m-ink)',
          fontWeight: 400,
        }}
      >
        Eighteen tools, complimentary.{' '}
        <em style={{ fontStyle: 'italic', color: 'var(--m-orange-2)' }}>
          Twenty-one productions, à la carte.
        </em>
      </h2>
      <p
        style={{
          fontSize: 17,
          color: 'var(--m-slate)',
          maxWidth: 720,
          lineHeight: 1.55,
        }}
      >
        This is where Setnayan&rsquo;s revenue comes from — not from your bookings.
        Couples plan their wedding using the complimentary tools we built to be
        free forever. When they want something beyond the foundation — a bespoke
        song, a live broadcast, a Same-Day Edit — they purchase from Setnayan
        Productions directly. As a verified vendor, you may recommend any
        Token-Worthy production to your couples and earn a bidding token when
        the service appears at their wedding.
      </p>

      {/* ─── Complimentary tools ──────────────────────────────────── */}
      <div style={{ marginTop: 72 }}>
        <div
          className="m-label-mono"
          style={{
            color: 'var(--m-orange-2)',
            paddingBottom: 16,
            borderBottom: '1px solid var(--m-orange-3)',
            marginBottom: 32,
          }}
        >
          Complimentary &mdash; for every couple, forever
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 48,
          }}
        >
          {Object.entries(COMPLIMENTARY_TOOLS).map(([group, items]) => (
            <div key={group}>
              <div
                className="m-serif"
                style={{
                  fontSize: 22,
                  fontStyle: 'italic',
                  color: 'var(--m-ink)',
                  marginBottom: 16,
                  fontWeight: 400,
                }}
              >
                {group}.
              </div>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {items.map((item) => (
                  <li
                    key={item}
                    style={{
                      fontSize: 15,
                      color: 'var(--m-slate)',
                      lineHeight: 1.5,
                    }}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Token-Worthy productions ─────────────────────────────── */}
      {tokenWorthy.length > 0 && (
        <div style={{ marginTop: 96 }}>
          <CatalogGroupHeading
            label="Productions &mdash; Token-Worthy"
            sub="Crew-delivered &middot; vendor-recommendable"
          />
          {tokenWorthy.map((sku) => (
            <CatalogRow key={sku.service_code} sku={sku} />
          ))}
        </div>
      )}

      {/* ─── Direct productions (FREE + paid) ─────────────────────── */}
      {(directFree.length + directPaid.length) > 0 && (
        <div style={{ marginTop: 80 }}>
          <CatalogGroupHeading
            label="Productions &mdash; Direct"
            sub="Setnayan-delivered &middot; automated"
          />
          {directFree.map((sku) => (
            <CatalogRow key={sku.service_code} sku={sku} />
          ))}
          {directPaid.map((sku) => (
            <CatalogRow key={sku.service_code} sku={sku} />
          ))}
        </div>
      )}

      {/* ─── Token-referral footer note ───────────────────────────── */}
      <div
        className="m-label-mono"
        style={{
          marginTop: 64,
          padding: '24px 0 0',
          borderTop: '1px solid var(--m-orange-3)',
          color: 'var(--m-slate-2)',
          maxWidth: 720,
          lineHeight: 1.6,
        }}
      >
        For verified vendors &mdash; every Token-Worthy service you recommend that
        appears at the event earns one bidding token, returned to your wallet
        within forty-eight hours of the wedding.
      </div>
    </section>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function CatalogGroupHeading({ label, sub }: { label: string; sub: string }) {
  return (
    <div
      style={{
        paddingBottom: 16,
        borderBottom: '1px solid var(--m-orange-3)',
        marginBottom: 8,
      }}
    >
      <div
        className="m-label-mono"
        style={{ color: 'var(--m-orange-2)', marginBottom: 4 }}
        dangerouslySetInnerHTML={{ __html: label }}
      />
      <div
        style={{ fontSize: 13, color: 'var(--m-slate-2)' }}
        dangerouslySetInnerHTML={{ __html: sub }}
      />
    </div>
  );
}

function CatalogRow({ sku }: { sku: V2CustomerSku }) {
  // Positioning copy lookup: prefer the curated brand-voice line; fall back
  // to DB description; fall back to nothing (heading-only row).
  const positioning = POSITIONING[sku.service_code] ?? sku.description ?? '';

  // Build-status badge: render only when partial/not_built so live items
  // stay clean. Coming-soon items get a muted chip so vendors know not to
  // promise them to couples yet.
  const showBadge = sku.build_status !== 'live';
  const badgeLabel =
    sku.build_status === 'partial' ? 'In active build' : 'Coming soon';

  return (
    <div
      style={{
        padding: '20px 0',
        borderBottom: '1px solid var(--m-orange-3)',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: 24,
        alignItems: 'baseline',
      }}
    >
      <div>
        <div
          className="m-display"
          style={{
            fontSize: 18,
            color: 'var(--m-ink)',
            lineHeight: 1.2,
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'baseline',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {sku.title}
          {showBadge && (
            <span
              className="m-label-mono"
              style={{
                fontSize: 10,
                color: 'var(--m-slate-2)',
                padding: '2px 8px',
                border: '1px solid var(--m-orange-3)',
                borderRadius: 4,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 500,
              }}
            >
              {badgeLabel}
            </span>
          )}
        </div>
        {positioning && (
          <p
            style={{
              fontSize: 15,
              color: 'var(--m-slate)',
              marginTop: 6,
              lineHeight: 1.55,
              maxWidth: 720,
            }}
          >
            {positioning}
          </p>
        )}
      </div>
      <div
        className="m-serif"
        style={{
          fontSize: 18,
          fontStyle: 'italic',
          color: 'var(--m-orange-2)',
          whiteSpace: 'nowrap',
          fontWeight: 400,
        }}
      >
        {formatPrice(sku)}
      </div>
    </div>
  );
}
