// Mock catalog for iteration 0018 Supplies Marketplace (scaffold-level).
//
// Vendor inventory persistence is Din Phase 3 work — these listings live in
// memory for now so the surface is browsable end-to-end without a DB write.
// Prices and product types are pulled directly from the spec § "Marketplace
// categories" + § "Coordinator workflow" (Patiktok background ₱599, HDMI
// dongle ₱899, monitor rental ₱2,500, QR cards ₱1,999/100, etc.). No
// invented prices, no new SKUs — PHP only.
//
// When iteration 0018 graduates from scaffold → real, this file is replaced
// by a Supabase query against the vendor inventory table.
// TODO(0018): swap mock SUPPLY_PRODUCTS for a Supabase fetch when vendor
// inventory + listings ship in Din Phase 3.

export const SUPPLY_CATEGORIES = [
  {
    key: 'print-fulfillment',
    label: 'Print fulfillment',
    blurb: 'Backgrounds · signage · place cards · QR cards · banners · photo books',
  },
  {
    key: 'equipment-rentals',
    label: 'Equipment rentals',
    blurb: 'HDMI dongles · monitors · projectors · tripods · ring lights · AV gear',
  },
  {
    key: 'backdrop-decor',
    label: 'Backdrop + decor',
    blurb: 'Backdrops · props · lighting kits · table linens',
  },
  {
    key: 'nfc-qr-keepsakes',
    label: 'NFC + QR keepsakes',
    blurb: 'NFC pendants · NFC table cards · arras coins · save-the-date mailers',
  },
  {
    key: 'specialty-merch',
    label: 'Specialty merch',
    blurb: 'QR wristbands · custom-designed QR cards · premium keepsake materials',
  },
] as const;

export type SupplyCategoryKey = (typeof SUPPLY_CATEGORIES)[number]['key'];

export type SupplyProduct = {
  readonly slug: string;
  readonly name: string;
  readonly category: SupplyCategoryKey;
  /** Lowest unit price quoted by the vendor in PHP, pre-VAT. */
  readonly pricePhp: number;
  /** Optional upper bound for "from X to Y" pricing — bulk / tiered rentals. */
  readonly priceMaxPhp?: number;
  /** Unit suffix shown after the price (e.g. "per 100", "per day"). */
  readonly unit?: string;
  readonly vendor: string;
  /** Marketplace category take rate per spec table — display-only here. */
  readonly takeRatePct: 10 | 15;
  readonly blurb: string;
  /** Recommended-for pairing key (cross-iteration). */
  readonly pairsWith?: ReadonlyArray<'patiktok' | 'papic' | 'panood' | 'seating' | 'photo-delivery'>;
};

export const SUPPLY_PRODUCTS: ReadonlyArray<SupplyProduct> = [
  // --- Print fulfillment (10% take) ---
  {
    slug: 'patiktok-background-print',
    name: 'Patiktok background print',
    category: 'print-fulfillment',
    pricePhp: 599,
    unit: 'per backdrop',
    vendor: 'Manila Print Co.',
    takeRatePct: 10,
    blurb:
      'Custom-printed 2.4×1.8m vertical-format Patiktok backdrop. Matte vinyl finish, hemmed edges, grommets for hanging.',
    pairsWith: ['patiktok'],
  },
  {
    slug: 'place-cards-print',
    name: 'Place cards (100-pack)',
    category: 'print-fulfillment',
    pricePhp: 799,
    unit: 'per 100 cards',
    vendor: 'Heirloom Press PH',
    takeRatePct: 10,
    blurb:
      'Letterpress-finish place cards on 320gsm uncoated stock. Couple-monogram on the back, calligraphed guest name on the front.',
    pairsWith: ['seating'],
  },
  {
    slug: 'photo-book-hardcover',
    name: 'Photo book — hardcover (40 pages)',
    category: 'print-fulfillment',
    pricePhp: 4500,
    unit: 'per book',
    vendor: 'Asuncion Bookbinders',
    takeRatePct: 10,
    blurb:
      'Layflat hardcover photo book, 40 pages, archival pigment print. Pairs with Photo Delivery handoff.',
    pairsWith: ['photo-delivery'],
  },
  {
    slug: 'signage-cards-pack',
    name: 'Signage card set (welcome + menu + table numbers)',
    category: 'print-fulfillment',
    pricePhp: 1499,
    unit: 'per event set',
    vendor: 'Manila Print Co.',
    takeRatePct: 10,
    blurb:
      'Welcome board (A2) · menu cards (×20 A5) · numbered table tents (×12). Matching paper stock, mounted on foam board.',
  },

  // --- Equipment rentals (15% take) ---
  {
    slug: 'hdmi-dongle-rental',
    name: 'HDMI dongle (USB-C / Lightning)',
    category: 'equipment-rentals',
    pricePhp: 899,
    unit: 'per event',
    vendor: 'AV Pilipinas Rentals',
    takeRatePct: 15,
    blurb:
      'iOS Lightning + USB-C HDMI adapters bundled. Delivered to venue tech team, picked up next day.',
    pairsWith: ['patiktok', 'panood'],
  },
  {
    slug: 'monitor-rental-32in',
    name: '32" reception monitor',
    category: 'equipment-rentals',
    pricePhp: 2500,
    unit: 'per day',
    vendor: 'AV Pilipinas Rentals',
    takeRatePct: 15,
    blurb:
      '32" 1080p monitor + adjustable stand. For Patiktok wall, slideshow loops, or speaker support.',
    pairsWith: ['patiktok'],
  },
  {
    slug: 'tripod-mount-rental',
    name: 'Smartphone tripod + selfie ring',
    category: 'equipment-rentals',
    pricePhp: 599,
    unit: 'per day',
    vendor: 'Lensman Rentals',
    takeRatePct: 15,
    blurb:
      'Heavy-base 1.6m tripod + Bluetooth shutter + 18" ring light. The standard Papic kit.',
    pairsWith: ['papic'],
  },
  {
    slug: 'projector-rental-1080p',
    name: '1080p projector',
    category: 'equipment-rentals',
    pricePhp: 3500,
    priceMaxPhp: 4500,
    unit: 'per day',
    vendor: 'AV Pilipinas Rentals',
    takeRatePct: 15,
    blurb:
      '4500-lumen projector + HDMI + power runs. Higher tier for outdoor or large halls.',
  },

  // --- Backdrop + decor (15% take) ---
  {
    slug: 'velvet-backdrop-rental',
    name: 'Velvet draped backdrop (3×2.5m)',
    category: 'backdrop-decor',
    pricePhp: 2999,
    unit: 'per event',
    vendor: 'Mariposa Decor Studio',
    takeRatePct: 15,
    blurb:
      'Champagne, burgundy, or sage velvet drape on collapsible frame. Setup + teardown included.',
  },
  {
    slug: 'arch-floral-rental',
    name: 'Floral arch (silk + fresh combo)',
    category: 'backdrop-decor',
    pricePhp: 8500,
    priceMaxPhp: 14500,
    unit: 'per event',
    vendor: 'Bloomline Manila',
    takeRatePct: 15,
    blurb:
      'Hexagonal or oval arch dressed with silk base + fresh focal flowers. Tier pricing by florals chosen at consult.',
  },
  {
    slug: 'lighting-kit-warm',
    name: 'Warm fairy-light kit (12 strands)',
    category: 'backdrop-decor',
    pricePhp: 1899,
    unit: 'per event',
    vendor: 'Mariposa Decor Studio',
    takeRatePct: 15,
    blurb:
      '12 strands × 5m warm-white LED on copper wire. Powered by mains adapters with hidden routing.',
  },

  // --- NFC + QR keepsakes (10% take) ---
  {
    slug: 'qr-cards-100',
    name: 'QR cards (100-pack)',
    category: 'nfc-qr-keepsakes',
    pricePhp: 1999,
    unit: 'per 100 cards',
    vendor: 'Heirloom Press PH',
    takeRatePct: 10,
    blurb:
      'Premium 600gsm cards with engraved QR linking to your wedding hub. Standard size for invite envelopes.',
  },
  {
    slug: 'nfc-pendant-couple',
    name: 'NFC pendant — couple keepsake',
    category: 'nfc-qr-keepsakes',
    pricePhp: 2499,
    unit: 'per pendant',
    vendor: 'Plata Atelier',
    takeRatePct: 10,
    blurb:
      'Brass or sterling-silver pendant with embedded NFC. Tap to open the couple\'s wedding hub. Comes in a velvet box.',
  },
  {
    slug: 'nfc-table-cards',
    name: 'NFC table cards (×12)',
    category: 'nfc-qr-keepsakes',
    pricePhp: 3499,
    unit: 'per 12 cards',
    vendor: 'Plata Atelier',
    takeRatePct: 10,
    blurb:
      'Acrylic-cased NFC chips, one per table. Guests tap to RSVP follow-ups, share photos, or open the seating chart.',
    pairsWith: ['seating'],
  },
  {
    slug: 'arras-coins-qr',
    name: 'QR-engraved arras coins (set of 13)',
    category: 'nfc-qr-keepsakes',
    pricePhp: 4500,
    priceMaxPhp: 6500,
    unit: 'per set',
    vendor: 'Plata Atelier',
    takeRatePct: 10,
    blurb:
      'Traditional 13-coin arras set with a discreet QR on the presentation tray linking to the couple\'s hub.',
  },

  // --- Specialty merch (10% take) ---
  {
    slug: 'qr-wristbands-50',
    name: 'QR wristbands (50-pack)',
    category: 'specialty-merch',
    pricePhp: 1199,
    unit: 'per 50 bands',
    vendor: 'Bayan Merch',
    takeRatePct: 10,
    blurb:
      'Soft silicone wristbands embossed with QR. Useful for entourage, kids, or photo-booth pickup.',
  },
  {
    slug: 'custom-qr-cards-premium',
    name: 'Premium custom QR cards (100-pack)',
    category: 'specialty-merch',
    pricePhp: 2999,
    unit: 'per 100 cards',
    vendor: 'Heirloom Press PH',
    takeRatePct: 10,
    blurb:
      'Foil-stamped, edge-painted custom QR cards on cotton stock. Designed alongside your invite suite.',
  },
  {
    slug: 'save-the-date-mailer-print',
    name: 'Save-the-date physical mailers',
    category: 'specialty-merch',
    pricePhp: 2499,
    unit: 'per 100 mailers',
    vendor: 'Manila Print Co.',
    takeRatePct: 10,
    blurb:
      'Printed mailers paired with your Save-the-Date video QR. Includes envelopes + return-address printing.',
  },
] as const;

// TODO(0018): vendor self-input via Din Phase 3 — vendors will manage their
// own inventory rows. Today these are seeded mock listings.
// TODO(0018): payout routing + commission distribution to vendors after
// order fulfillment. Spec § "Pricing model" defines the take rate per
// category; the actual ledger entries live in 0003 Billing Rail.
// TODO(0018): PayMongo / Setnayan Pay integration on the checkout path —
// for the scaffold, all carts route to /orders/new (apply-then-pay).
