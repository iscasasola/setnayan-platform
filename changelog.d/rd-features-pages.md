## 2026-10-01 · feat(features): /features hub + one page per feature (EN + /tl) with full search tagging

The /features hub is now the five groups from one registry (`lib/feature-pages/`) with a connected
ecosystem map; `/features/<slug>` and `/tl/features/<slug>` render 18 verified feature pages (what it is ·
who for · 3 steps · price from the catalogue · what makes it different · works with the rest of Setnayan ·
FAQ). Title/description/canonical/hreflang/OG/Twitter, JSON-LD (Organization, BreadcrumbList,
SoftwareApplication+Offer, FAQPage, HowTo), `sitemap-features.xml`, and an `llms.txt` feature section.
Server components only; no new server actions. Supplier-side features and the unverified host features
are intentionally NOT listed yet (only what ships).

SPEC IMPACT: None.
