/**
 * routes.ts — THE single source of truth for every URL in the Setnayan web app.
 *
 * Generated from the live route tree (327 routes). Every <Link href>, router.push,
 * redirect(), fetch() and email/QR URL should resolve through a builder here — never a
 * hardcoded string. Renaming a route = edit the one builder below (+ move the folder);
 * every caller follows automatically, and the route-integrity guard
 * (scripts/lint-routes.mjs) fails the build if a builder points at a folder that does
 * not exist (dead link) or a route folder lacks a builder (orphan).
 *
 * Paths here are the CURRENT, behavior-preserving URLs — renames land as a separate,
 * reviewed step. Builders take their dynamic segments as ordered string params.
 *
 * AUTO-GENERATED skeleton — safe to hand-edit; keep one builder per live route.
 */
export const routes = {
  index: () => `/`,
  about: () => `/about`,
  admin: {
    index: () => `/admin`,
    accountDeletions: () => `/admin/account-deletions`,
    addons: {
      index: () => `/admin/addons`,
      pricingReport: () => `/admin/addons/pricing-report`,
    },
    approvals: () => `/admin/approvals`,
    brain: () => `/admin/brain`,
    budgetPlanner: () => `/admin/budget-planner`,
    conciergeAbuse: () => `/admin/concierge-abuse`,
    connectionLogs: () => `/admin/connection-logs`,
    demoVendors: {
      index: () => `/admin/demo-vendors`,
      inquiries: {
        index: () => `/admin/demo-vendors/inquiries`,
        detail: (threadId: string) => `/admin/demo-vendors/inquiries/${threadId}`,
      },
    },
    directory: () => `/admin/directory`,
    discountCodes: {
      index: () => `/admin/discount-codes`,
      edit: (id: string) => `/admin/discount-codes/${id}/edit`,
      new: () => `/admin/discount-codes/new`,
    },
    disputes: () => `/admin/disputes`,
    eventTypes: () => `/admin/event-types`,
    events: () => `/admin/events`,
    forceMajeure: {
      index: () => `/admin/force-majeure`,
      detail: (flagId: string) => `/admin/force-majeure/${flagId}`,
    },
    funnels: () => `/admin/funnels`,
    growth: {
      index: () => `/admin/growth`,
      export: () => `/admin/growth/export`,
    },
    help: () => `/admin/help`,
    heroVideo: () => `/admin/hero-video`,
    insights: () => `/admin/insights`,
    intelligence: () => `/admin/intelligence`,
    money: () => `/admin/money`,
    moodboardLibrary: () => `/admin/moodboard-library`,
    more: () => `/admin/more`,
    notifications: () => `/admin/notifications`,
    offline: () => `/admin/offline`,
    onboarding: () => `/admin/onboarding`,
    operationsHiring: () => `/admin/operations-hiring`,
    pakanta: () => `/admin/pakanta`,
    paxChanges: () => `/admin/pax-changes`,
    paymentOptions: () => `/admin/payment-options`,
    payments: () => `/admin/payments`,
    payouts: () => `/admin/payouts`,
    pricing: () => `/admin/pricing`,
    queues: () => `/admin/queues`,
    realStories: () => `/admin/real-stories`,
    recaps: () => `/admin/recaps`,
    receipts: () => `/admin/receipts`,
    refinements: () => `/admin/refinements`,
    reviews: () => `/admin/reviews`,
    settings: {
      index: () => `/admin/settings`,
      demoMode: () => `/admin/settings/demo-mode`,
      paymentMethods: () => `/admin/settings/payment-methods`,
    },
    socialQueue: () => `/admin/social-queue`,
    songs: () => `/admin/songs`,
    subscriptions: () => `/admin/subscriptions`,
    taxonomy: () => `/admin/taxonomy`,
    tokenBands: () => `/admin/token-bands`,
    tokenPurchases: () => `/admin/token-purchases`,
    userReports: () => `/admin/user-reports`,
    users: () => `/admin/users`,
    vendors: {
      index: () => `/admin/vendors`,
      edit: (vendorProfileId: string) => `/admin/vendors/${vendorProfileId}/edit`,
      tokens: (vendorProfileId: string) => `/admin/vendors/${vendorProfileId}/tokens`,
    },
    venues: {
      index: () => `/admin/venues`,
      detail: (id: string) => `/admin/venues/${id}`,
      new: () => `/admin/venues/new`,
    },
    verify: () => `/admin/verify`,
    website: () => `/admin/website`,
    weddingTraditions: () => `/admin/wedding-traditions`,
    weddingTypes: () => `/admin/wedding-types`,
    work: () => `/admin/work`,
  },
  api: {
    admin: {
      cron: {
        disputeCounter: () => `/api/admin/cron/dispute-counter`,
      },
      demo: {
        cleanup: () => `/api/admin/demo/cleanup`,
        cleanupBatch: () => `/api/admin/demo/cleanup-batch`,
        regenerate: () => `/api/admin/demo/regenerate`,
        seed: () => `/api/admin/demo/seed`,
      },
      demoMode: {
        toggle: () => `/api/admin/demo-mode/toggle`,
      },
      sentrySmokeTest: () => `/api/admin/sentry-smoke-test`,
      smokeTest: () => `/api/admin/smoke-test`,
    },
    budget: {
      ics: (eventId: string) => `/api/budget/${eventId}/ics`,
    },
    crew: {
      registerDevice: () => `/api/crew/register-device`,
    },
    cron: {
      oauthRefresh: () => `/api/cron/oauth-refresh`,
      photoDeliveryTick: () => `/api/cron/photo-delivery-tick`,
    },
    download: {
      mac: () => `/api/download/mac`,
    },
    guestSelfie: () => `/api/guest-selfie`,
    health: {
      index: () => `/api/health`,
      deep: () => `/api/health/deep`,
    },
    internal: {
      patiktok: {
        processJob: () => `/api/internal/patiktok/process-job`,
      },
    },
    ledBackground: {
      save: () => `/api/led-background/save`,
    },
    oauth: {
      drive: {
        callback: () => `/api/oauth/drive/callback`,
        disconnect: () => `/api/oauth/drive/disconnect`,
        start: () => `/api/oauth/drive/start`,
      },
      photoDelivery: {
        callback: () => `/api/oauth/photo-delivery/callback`,
        start: () => `/api/oauth/photo-delivery/start`,
      },
      youtube: {
        callback: () => `/api/oauth/youtube/callback`,
        disconnect: () => `/api/oauth/youtube/disconnect`,
        start: () => `/api/oauth/youtube/start`,
      },
    },
    og: {
      manifesto: () => `/api/og/manifesto`,
      realstory: {
        detail: (slug: string) => `/api/og/realstory/${slug}`,
      },
      realstorySlug: {
        detail: (slug: string) => `/api/og/realstory-slug/${slug}`,
      },
      recap: {
        detail: (slug: string) => `/api/og/recap/${slug}`,
      },
    },
    papic: {
      acceptTerms: () => `/api/papic/accept-terms`,
      guestCapture: () => `/api/papic/guest-capture`,
      kwento: {
        index: () => `/api/papic/kwento`,
        delete: () => `/api/papic/kwento/delete`,
      },
    },
    photoDelivery: {
      disconnect: () => `/api/photo-delivery/disconnect`,
      status: () => `/api/photo-delivery/status`,
    },
    profile: {
      export: () => `/api/profile/export`,
    },
    seatLookup: {
      detail: (slug: string) => `/api/seat-lookup/${slug}`,
    },
    slugs: {
      check: () => `/api/slugs/check`,
    },
    social: {
      card: {
        detail: (postId: string) => `/api/social/card/${postId}`,
      },
    },
    telemetry: {
      autoResolve: () => `/api/telemetry/auto-resolve`,
      clientFault: () => `/api/telemetry/client-fault`,
    },
    tiktok: {
      auth: {
        callback: () => `/api/tiktok/auth/callback`,
        start: () => `/api/tiktok/auth/start`,
      },
    },
    upload: () => `/api/upload`,
    v1: {
      index: () => `/api/v1`,
      admin: {
        siteWidgets: {
          detail: (widgetId: string) => `/api/v1/admin/site-widgets/${widgetId}`,
          reorder: () => `/api/v1/admin/site-widgets/reorder`,
        },
      },
      billing: {
        initializeMaya: () => `/api/v1/billing/initialize-maya`,
      },
      events: {
        index: () => `/api/v1/events`,
        detail: (eventId: string) => `/api/v1/events/${eventId}`,
        guests: (eventId: string) => `/api/v1/events/${eventId}/guests`,
      },
      health: () => `/api/v1/health`,
      manpower: {
        syncDevice: () => `/api/v1/manpower/sync-device`,
        verifyTelemetry: () => `/api/v1/manpower/verify-telemetry`,
      },
      me: () => `/api/v1/me`,
      reviews: () => `/api/v1/reviews`,
      vendors: {
        index: () => `/api/v1/vendors`,
        detail: (publicId: string) => `/api/v1/vendors/${publicId}`,
      },
    },
    wall: {
      claim: () => `/api/wall/claim`,
      feed: (eventId: string) => `/api/wall/${eventId}/feed`,
    },
    webhooks: {
      persona: () => `/api/webhooks/persona`,
      tokenPurchase: () => `/api/webhooks/token-purchase`,
      veriff: () => `/api/webhooks/veriff`,
    },
    website: {
      qr: {
        detail: (slug: string) => `/api/website/qr/${slug}`,
        guest: {
          detail: (guestId: string) => `/api/website/qr/guest/${guestId}`,
        },
      },
    },
  },
  auth: {
    callback: () => `/auth/callback`,
    signOut: () => `/auth/sign-out`,
  },
  blog: {
    index: () => `/blog`,
    detail: (slug: string) => `/blog/${slug}`,
  },
  dashboard: {
    index: () => `/dashboard`,
    activity: (eventId: string) => `/dashboard/${eventId}/activity`,
    addOns: {
      index: (eventId: string) => `/dashboard/${eventId}/add-ons`,
      animatedMonogram: (eventId: string) => `/dashboard/${eventId}/add-ons/animated-monogram`,
      bundle: (eventId: string) => `/dashboard/${eventId}/add-ons/bundle`,
      customQrGuest: {
        index: (eventId: string) => `/dashboard/${eventId}/add-ons/custom-qr-guest`,
        print: (eventId: string) => `/dashboard/${eventId}/add-ons/custom-qr-guest/print`,
      },
      detail: (eventId: string, addon: string) => `/dashboard/${eventId}/add-ons/${addon}`,
      indoorBlueprint: (eventId: string) => `/dashboard/${eventId}/add-ons/indoor-blueprint`,
      led: (eventId: string) => `/dashboard/${eventId}/add-ons/led`,
      moodBoard: {
        index: (eventId: string) => `/dashboard/${eventId}/add-ons/mood-board`,
        conceptPdf: (eventId: string) => `/dashboard/${eventId}/add-ons/mood-board/concept-pdf`,
      },
      pakanta: (eventId: string) => `/dashboard/${eventId}/add-ons/pakanta`,
      panood: {
        index: (eventId: string) => `/dashboard/${eventId}/add-ons/panood`,
        broadcast: (eventId: string) => `/dashboard/${eventId}/add-ons/panood/broadcast`,
        reviews: (eventId: string) => `/dashboard/${eventId}/add-ons/panood/reviews`,
        setup: (eventId: string) => `/dashboard/${eventId}/add-ons/panood/setup`,
      },
      papic: {
        index: (eventId: string) => `/dashboard/${eventId}/add-ons/papic`,
        crew: (eventId: string) => `/dashboard/${eventId}/add-ons/papic/crew`,
        magazine: (eventId: string) => `/dashboard/${eventId}/add-ons/papic/magazine`,
        moderation: (eventId: string) => `/dashboard/${eventId}/add-ons/papic/moderation`,
        recap: (eventId: string) => `/dashboard/${eventId}/add-ons/papic/recap`,
      },
      patiktok: {
        index: (eventId: string) => `/dashboard/${eventId}/add-ons/patiktok`,
        booth: (eventId: string) => `/dashboard/${eventId}/add-ons/patiktok/booth`,
        detail: (eventId: string, templateId: string) => `/dashboard/${eventId}/add-ons/patiktok/${templateId}`,
      },
      photoDelivery: (eventId: string) => `/dashboard/${eventId}/add-ons/photo-delivery`,
      playlist: (eventId: string) => `/dashboard/${eventId}/add-ons/playlist`,
      saveTheDate: (eventId: string) => `/dashboard/${eventId}/add-ons/save-the-date`,
      setnayanAi: (eventId: string) => `/dashboard/${eventId}/add-ons/setnayan-ai`,
      suppliesMarketplace: (eventId: string) => `/dashboard/${eventId}/add-ons/supplies-marketplace`,
    },
    apiKeys: () => `/dashboard/api-keys`,
    budget: (eventId: string) => `/dashboard/${eventId}/budget`,
    contracts: {
      index: (eventId: string) => `/dashboard/${eventId}/contracts`,
      detail: (eventId: string, contractId: string) => `/dashboard/${eventId}/contracts/${contractId}`,
    },
    createEvent: () => `/dashboard/create-event`,
    dateSelection: (eventId: string) => `/dashboard/${eventId}/date-selection`,
    detail: (eventId: string) => `/dashboard/${eventId}`,
    details: (eventId: string) => `/dashboard/${eventId}/details`,
    disputes: (eventId: string) => `/dashboard/${eventId}/disputes`,
    documents: (eventId: string) => `/dashboard/${eventId}/documents`,
    eventQr: (eventId: string) => `/dashboard/${eventId}/event-qr`,
    findDate: (eventId: string) => `/dashboard/${eventId}/find-date`,
    forYou: (eventId: string) => `/dashboard/${eventId}/for-you`,
    guests: {
      index: (eventId: string) => `/dashboard/${eventId}/guests`,
      checkin: (eventId: string) => `/dashboard/${eventId}/guests/checkin`,
      claims: (eventId: string) => `/dashboard/${eventId}/guests/claims`,
      detail: (eventId: string, guestId: string) => `/dashboard/${eventId}/guests/${guestId}`,
      'import': (eventId: string) => `/dashboard/${eventId}/guests/import`,
      new: (eventId: string) => `/dashboard/${eventId}/guests/new`,
      quick: (eventId: string) => `/dashboard/${eventId}/guests/quick`,
    },
    hosts: (eventId: string) => `/dashboard/${eventId}/hosts`,
    invitation: {
      index: (eventId: string) => `/dashboard/${eventId}/invitation`,
      print: (eventId: string) => `/dashboard/${eventId}/invitation/print`,
    },
    live: (eventId: string) => `/dashboard/${eventId}/live`,
    manpower: (eventId: string) => `/dashboard/${eventId}/manpower`,
    messages: {
      index: (eventId: string) => `/dashboard/${eventId}/messages`,
      detail: (eventId: string, threadId: string) => `/dashboard/${eventId}/messages/${threadId}`,
    },
    monogram: (eventId: string) => `/dashboard/${eventId}/monogram`,
    more: (eventId: string) => `/dashboard/${eventId}/more`,
    notifications: () => `/dashboard/notifications`,
    orders: {
      index: (eventId: string) => `/dashboard/${eventId}/orders`,
      detail: (eventId: string, orderId: string) => `/dashboard/${eventId}/orders/${orderId}`,
      new: (eventId: string) => `/dashboard/${eventId}/orders/new`,
    },
    paperwork: (eventId: string) => `/dashboard/${eventId}/paperwork`,
    profile: {
      index: () => `/dashboard/profile`,
      concierge: () => `/dashboard/profile/concierge`,
    },
    schedule: (eventId: string) => `/dashboard/${eventId}/schedule`,
    seating: {
      index: (eventId: string) => `/dashboard/${eventId}/seating`,
      caterer: (eventId: string) => `/dashboard/${eventId}/seating/caterer`,
      export: (eventId: string) => `/dashboard/${eventId}/seating/export`,
      print: (eventId: string) => `/dashboard/${eventId}/seating/print`,
      walkthrough: (eventId: string) => `/dashboard/${eventId}/seating/walkthrough`,
    },
    sponsors: (eventId: string) => `/dashboard/${eventId}/sponsors`,
    today: (eventId: string) => `/dashboard/${eventId}/today`,
    vendors: {
      index: (eventId: string) => `/dashboard/${eventId}/vendors`,
      categories: (eventId: string) => `/dashboard/${eventId}/vendors/categories`,
      packages: {
        detail: (eventId: string, bookingId: string) => `/dashboard/${eventId}/vendors/packages/${bookingId}`,
      },
      review: (eventId: string, vendorId: string) => `/dashboard/${eventId}/vendors/${vendorId}/review`,
      workspace: (eventId: string, vendorId: string) => `/dashboard/${eventId}/vendors/${vendorId}/workspace`,
    },
    website: {
      index: (eventId: string) => `/dashboard/${eventId}/website`,
      dressCode: (eventId: string) => `/dashboard/${eventId}/website/dress-code`,
      heroPhoto: (eventId: string) => `/dashboard/${eventId}/website/hero-photo`,
      ourPhotos: (eventId: string) => `/dashboard/${eventId}/website/our-photos`,
      photoMoments: (eventId: string) => `/dashboard/${eventId}/website/photo-moments`,
      privacy: (eventId: string) => `/dashboard/${eventId}/website/privacy`,
      siteChrome: (eventId: string) => `/dashboard/${eventId}/website/site-chrome`,
      specialMessage: (eventId: string) => `/dashboard/${eventId}/website/special-message`,
      whatToBring: (eventId: string) => `/dashboard/${eventId}/website/what-to-bring`,
      widgets: (eventId: string) => `/dashboard/${eventId}/website/widgets`,
    },
  },
  download: () => `/download`,
  explore: {
    index: () => `/explore`,
    categories: () => `/explore/categories`,
    compare: () => `/explore/compare`,
  },
  faviconIco: () => `/favicon.ico`,
  features: () => `/features`,
  forVendors: () => `/for-vendors`,
  forgotPassword: () => `/forgot-password`,
  guest: {
    findMyTable: (slug: string) => `/${slug}/find-my-table`,
    findSeat: (slug: string) => `/${slug}/find-seat`,
    home: (slug: string) => `/${slug}`,
    liveWall: (slug: string) => `/${slug}/live-wall`,
    recap: (slug: string) => `/${slug}/recap`,
    redeem: (slug: string) => `/${slug}/redeem`,
    signOut: (slug: string) => `/${slug}/sign-out`,
    welcome: (slug: string) => `/${slug}/welcome`,
  },
  health: () => `/health`,
  help: {
    index: () => `/help`,
    detail: (slug: string) => `/help/${slug}`,
  },
  host: {
    accept: {
      detail: (token: string) => `/host/accept/${token}`,
    },
  },
  howItWorks: () => `/how-it-works`,
  join: {
    detail: (eventId: string) => `/join/${eventId}`,
    pending: (eventId: string) => `/join/${eventId}/pending`,
    success: (eventId: string) => `/join/${eventId}/success`,
    verify: (eventId: string) => `/join/${eventId}/verify`,
  },
  login: () => `/login`,
  onboarding: {
    wedding: () => `/onboarding/wedding`,
  },
  ourStory: () => `/our-story`,
  papic: {
    claim: {
      detail: (token: string) => `/papic/claim/${token}`,
    },
    guest: () => `/papic/guest`,
    seat: {
      detail: (token: string) => `/papic/seat/${token}`,
    },
  },
  pricing: () => `/pricing`,
  privacy: () => `/privacy`,
  proposals: {
    detail: (publicId: string) => `/proposals/${publicId}`,
  },
  realstories: {
    index: () => `/realstories`,
    detail: (slug: string) => `/realstories/${slug}`,
  },
  receipts: {
    detail: (receiptId: string) => `/receipts/${receiptId}`,
  },
  resetPassword: () => `/reset-password`,
  signup: () => `/signup`,
  siteEditor: {
    detail: (eventId: string) => `/site-editor/${eventId}`,
  },
  sitemapBlogXml: () => `/sitemap-blog.xml`,
  sitemapHelpXml: () => `/sitemap-help.xml`,
  sitemapStaticXml: () => `/sitemap-static.xml`,
  sitemapVendorsXml: () => `/sitemap-vendors.xml`,
  sitemapVenuesXml: () => `/sitemap-venues.xml`,
  sitemapWeddingsXml: () => `/sitemap-weddings.xml`,
  sitemapXml: () => `/sitemap.xml`,
  terms: () => `/terms`,
  tl: {
    about: () => `/tl/about`,
    features: () => `/tl/features`,
    howItWorks: () => `/tl/how-it-works`,
  },
  v: {
    detail: (slug: string) => `/v/${slug}`,
  },
  vendor: {
    claim: {
      detail: (token: string) => `/vendor/claim/${token}`,
      finalize: (token: string) => `/vendor/claim/${token}/finalize`,
    },
  },
  vendorDashboard: {
    index: () => `/vendor-dashboard`,
    attributes: () => `/vendor-dashboard/attributes`,
    bookings: () => `/vendor-dashboard/bookings`,
    branches: () => `/vendor-dashboard/branches`,
    calendar: () => `/vendor-dashboard/calendar`,
    clients: {
      index: () => `/vendor-dashboard/clients`,
      calendarIcs: (eventId: string) => `/vendor-dashboard/clients/${eventId}/calendar.ics`,
      cocktail: (eventId: string) => `/vendor-dashboard/clients/${eventId}/cocktail`,
      detail: (eventId: string) => `/vendor-dashboard/clients/${eventId}`,
      productionSheet: (eventId: string) => `/vendor-dashboard/clients/${eventId}/production-sheet`,
      seatPlan: (eventId: string) => `/vendor-dashboard/clients/${eventId}/seat-plan`,
    },
    contracts: {
      index: () => `/vendor-dashboard/contracts`,
      detail: (contractId: string) => `/vendor-dashboard/contracts/${contractId}`,
      new: () => `/vendor-dashboard/contracts/new`,
    },
    earnings: () => `/vendor-dashboard/earnings`,
    manpower: () => `/vendor-dashboard/manpower`,
    messages: {
      index: () => `/vendor-dashboard/messages`,
      detail: (threadId: string) => `/vendor-dashboard/messages/${threadId}`,
    },
    moodboardLibrary: () => `/vendor-dashboard/moodboard-library`,
    more: () => `/vendor-dashboard/more`,
    notifications: () => `/vendor-dashboard/notifications`,
    paymentOptions: () => `/vendor-dashboard/payment-options`,
    profile: () => `/vendor-dashboard/profile`,
    proposals: () => `/vendor-dashboard/proposals`,
    realStories: () => `/vendor-dashboard/real-stories`,
    recaps: () => `/vendor-dashboard/recaps`,
    redeemCode: () => `/vendor-dashboard/redeem-code`,
    repertoire: () => `/vendor-dashboard/repertoire`,
    reviews: () => `/vendor-dashboard/reviews`,
    services: () => `/vendor-dashboard/services`,
    subscription: () => `/vendor-dashboard/subscription`,
    taxDocuments: () => `/vendor-dashboard/tax-documents`,
    team: () => `/vendor-dashboard/team`,
    tokens: () => `/vendor-dashboard/tokens`,
    verify: () => `/vendor-dashboard/verify`,
    website: () => `/vendor-dashboard/website`,
  },
  venue: {
    detail: (slug: string) => `/venue/${slug}`,
  },
  venues: {
    index: () => `/venues`,
    detail: (city: string) => `/venues/${city}`,
  },
  waitlist: () => `/waitlist`,
  wall: {
    detail: (eventId: string) => `/wall/${eventId}`,
  },
} as const;

export type Routes = typeof routes;
