/**
 * The badge shelf on /for-suppliers — the image badges (seal · hexagon · star · rosette), drawn exactly as the
 * owner-approved prototype draws them (`prototypes/for_suppliers_2026-11-06/index.html`, "Badges"; DECISION_LOG
 * 2026-11-06 "MARKETING MOCKUPS USE THE REAL BRAND ART … the image badges not the long version").
 *
 * The art is a picture of badges, so the counts on the faces (23 · 13 · 12 · 25 · 20) are a sample shelf. The two
 * ladder captions that NAME a tier are read from `lib/badge-tiers.ts` (`TIERS`), so a renamed material follows.
 * Gradient ids carry an `sfp-` prefix: they are document-global and the page draws other SVG.
 */
import { TIERS } from '@/lib/badge-tiers';
import { formatCount } from '@/lib/format-number';

/** "5,000 events · Ruby" — the step and its material, both from the ladder. */
function ladderCaption(step: number): string {
  const tier = TIERS.find((t) => t.step === step);
  return tier ? `${formatCount(step)} events · ${tier.name}` : `${formatCount(step)} events`;
}

export function SupplierBadgeShelf({ className }: { className?: string }) {
  return (
    <div className={className} aria-label="Setnayan supplier badges">
<svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs><radialGradient id="sfp-face-black" cx=".38" cy=".3" r=".85"><stop offset="0" stopColor="#3E4047"/><stop offset="1" stopColor="#08080A"/></radialGradient><radialGradient id="sfp-face-bronze" cx=".38" cy=".3" r=".85"><stop offset="0" stopColor="#F9E8D8"/><stop offset="1" stopColor="#D09A70"/></radialGradient><radialGradient id="sfp-face-first" cx=".38" cy=".3" r=".85"><stop offset="0" stopColor="#FFFCF0"/><stop offset="1" stopColor="#EDD08A"/></radialGradient><radialGradient id="sfp-face-gold" cx=".38" cy=".3" r=".85"><stop offset="0" stopColor="#FFF9E4"/><stop offset="1" stopColor="#E3BF68"/></radialGradient><radialGradient id="sfp-face-ivory" cx=".38" cy=".3" r=".85"><stop offset="0" stopColor="#FFFEFA"/><stop offset="1" stopColor="#ECE1CB"/></radialGradient><radialGradient id="sfp-face-month" cx=".38" cy=".3" r=".85"><stop offset="0" stopColor="#AA2539"/><stop offset="1" stopColor="#520A18"/></radialGradient><radialGradient id="sfp-face-navy" cx=".38" cy=".3" r=".85"><stop offset="0" stopColor="#335282"/><stop offset="1" stopColor="#101C36"/></radialGradient><radialGradient id="sfp-face-plat" cx=".38" cy=".3" r=".85"><stop offset="0" stopColor="#F5F8FB"/><stop offset="1" stopColor="#B2C0CB"/></radialGradient><radialGradient id="sfp-face-ruby" cx=".38" cy=".3" r=".85"><stop offset="0" stopColor="#CF3552"/><stop offset="1" stopColor="#560817"/></radialGradient><radialGradient id="sfp-face-silver" cx=".38" cy=".3" r=".85"><stop offset="0" stopColor="#FBFCFD"/><stop offset="1" stopColor="#C0C6CC"/></radialGradient><linearGradient id="sfp-faceGloss" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".5"/><stop offset=".5" stopColor="#fff" stopOpacity="0"/></linearGradient><linearGradient id="sfp-gloss" x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".62"/><stop offset=".42" stopColor="#fff" stopOpacity="0"/></linearGradient><linearGradient id="sfp-rim-black" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8E949A"/><stop offset=".28" stopColor="#FFFFFF"/><stop offset=".5" stopColor="#5C6269"/><stop offset=".74" stopColor="#F0F2F4"/><stop offset="1" stopColor="#8E949A"/></linearGradient><linearGradient id="sfp-rim-bronze" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4E2A10"/><stop offset=".28" stopColor="#E8B088"/><stop offset=".5" stopColor="#8C4F22"/><stop offset=".74" stopColor="#D08C5A"/><stop offset="1" stopColor="#4E2A10"/></linearGradient><linearGradient id="sfp-rim-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7A5C22"/><stop offset=".28" stopColor="#FBEFC4"/><stop offset=".5" stopColor="#B88D3B"/><stop offset=".74" stopColor="#EBD08A"/><stop offset="1" stopColor="#7A5C22"/></linearGradient><linearGradient id="sfp-rim-plat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#35404A"/><stop offset=".28" stopColor="#F4F8FA"/><stop offset=".5" stopColor="#8A98A4"/><stop offset=".74" stopColor="#D8E0E6"/><stop offset="1" stopColor="#35404A"/></linearGradient><linearGradient id="sfp-rim-ruby" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4E0A16"/><stop offset=".28" stopColor="#F7B9C3"/><stop offset=".5" stopColor="#A0203A"/><stop offset=".74" stopColor="#DC607A"/><stop offset="1" stopColor="#4E0A16"/></linearGradient><linearGradient id="sfp-rim-silver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4F555C"/><stop offset=".28" stopColor="#F7F9FB"/><stop offset=".5" stopColor="#8E959C"/><stop offset=".74" stopColor="#DCE0E4"/><stop offset="1" stopColor="#4F555C"/></linearGradient><linearGradient id="sfp-shade" x1="0" y1="0" x2=".8" y2="1"><stop offset=".55" stopColor="#000" stopOpacity="0"/><stop offset="1" stopColor="#000" stopOpacity=".34"/></linearGradient><filter id="sfp-shadow" x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy="2.2" stdDeviation="2.4" floodColor="#2C2A29" floodOpacity=".3"/></filter><filter id="sfp-shadowSoft" x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy="1.2" stdDeviation="1.4" floodColor="#2C2A29" floodOpacity=".25"/></filter><linearGradient id="sfp-tail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#B8324A"/><stop offset="1" stopColor="#7A1426"/></linearGradient></defs></svg><svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs><linearGradient id="sfp-foil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FBEFC4"/><stop offset=".45" stopColor="#D9B463"/><stop offset=".6" stopColor="#F6E4A6"/><stop offset="1" stopColor="#B88D3B"/></linearGradient></defs></svg>
<figure className="ib"><div className="ibs"><svg className="sv sv-seal" viewBox="0 0 100 100">
<g filter="url(#sfp-shadow)"><path d="M50,4 A6.4,6.4 0 0 1 61.9,5.6 A6.4,6.4 0 0 1 73,10.2 A6.4,6.4 0 0 1 82.5,17.5 A6.4,6.4 0 0 1 89.8,27 A6.4,6.4 0 0 1 94.4,38.1 A6.4,6.4 0 0 1 96,50 A6.4,6.4 0 0 1 94.4,61.9 A6.4,6.4 0 0 1 89.8,73 A6.4,6.4 0 0 1 82.5,82.5 A6.4,6.4 0 0 1 73,89.8 A6.4,6.4 0 0 1 61.9,94.4 A6.4,6.4 0 0 1 50,96 A6.4,6.4 0 0 1 38.1,94.4 A6.4,6.4 0 0 1 27,89.8 A6.4,6.4 0 0 1 17.5,82.5 A6.4,6.4 0 0 1 10.2,73 A6.4,6.4 0 0 1 5.6,61.9 A6.4,6.4 0 0 1 4,50 A6.4,6.4 0 0 1 5.6,38.1 A6.4,6.4 0 0 1 10.2,27 A6.4,6.4 0 0 1 17.5,17.5 A6.4,6.4 0 0 1 27,10.2 A6.4,6.4 0 0 1 38.1,5.6 A6.4,6.4 0 0 1 50,4Z" fill="url(#sfp-rim-gold)"/></g>
<path d="M50,4 A6.4,6.4 0 0 1 61.9,5.6 A6.4,6.4 0 0 1 73,10.2 A6.4,6.4 0 0 1 82.5,17.5 A6.4,6.4 0 0 1 89.8,27 A6.4,6.4 0 0 1 94.4,38.1 A6.4,6.4 0 0 1 96,50 A6.4,6.4 0 0 1 94.4,61.9 A6.4,6.4 0 0 1 89.8,73 A6.4,6.4 0 0 1 82.5,82.5 A6.4,6.4 0 0 1 73,89.8 A6.4,6.4 0 0 1 61.9,94.4 A6.4,6.4 0 0 1 50,96 A6.4,6.4 0 0 1 38.1,94.4 A6.4,6.4 0 0 1 27,89.8 A6.4,6.4 0 0 1 17.5,82.5 A6.4,6.4 0 0 1 10.2,73 A6.4,6.4 0 0 1 5.6,61.9 A6.4,6.4 0 0 1 4,50 A6.4,6.4 0 0 1 5.6,38.1 A6.4,6.4 0 0 1 10.2,27 A6.4,6.4 0 0 1 17.5,17.5 A6.4,6.4 0 0 1 27,10.2 A6.4,6.4 0 0 1 38.1,5.6 A6.4,6.4 0 0 1 50,4Z" fill="url(#sfp-gloss)"/>
<path d="M50,4 A6.4,6.4 0 0 1 61.9,5.6 A6.4,6.4 0 0 1 73,10.2 A6.4,6.4 0 0 1 82.5,17.5 A6.4,6.4 0 0 1 89.8,27 A6.4,6.4 0 0 1 94.4,38.1 A6.4,6.4 0 0 1 96,50 A6.4,6.4 0 0 1 94.4,61.9 A6.4,6.4 0 0 1 89.8,73 A6.4,6.4 0 0 1 82.5,82.5 A6.4,6.4 0 0 1 73,89.8 A6.4,6.4 0 0 1 61.9,94.4 A6.4,6.4 0 0 1 50,96 A6.4,6.4 0 0 1 38.1,94.4 A6.4,6.4 0 0 1 27,89.8 A6.4,6.4 0 0 1 17.5,82.5 A6.4,6.4 0 0 1 10.2,73 A6.4,6.4 0 0 1 5.6,61.9 A6.4,6.4 0 0 1 4,50 A6.4,6.4 0 0 1 5.6,38.1 A6.4,6.4 0 0 1 10.2,27 A6.4,6.4 0 0 1 17.5,17.5 A6.4,6.4 0 0 1 27,10.2 A6.4,6.4 0 0 1 38.1,5.6 A6.4,6.4 0 0 1 50,4Z" fill="url(#sfp-shade)"/>
<circle cx="50" cy="50" r="42" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth=".9"/>
<circle cx="50" cy="50" r="40.6" fill="none" stroke="#000" strokeOpacity=".28" strokeWidth=".9"/>
<circle cx="50" cy="50" r="39.5" fill="url(#sfp-face-navy)"/>
<circle cx="50" cy="50" r="39.5" fill="url(#sfp-faceGloss)"/>
<circle cx="50" cy="50" r="37.6" fill="none" stroke="url(#sfp-foil)" strokeOpacity=".5" strokeWidth=".7"/>
<circle cx="50" cy="50" r="35.4" fill="none" stroke="url(#sfp-foil)" strokeOpacity=".38" strokeWidth=".6" strokeDasharray="1 2.1"/>
<text className="num" x="50" y="53.5" textAnchor="middle" fill="#000000" opacity=".55" dy=".9">✓</text>
<text className="num" x="50" y="53.5" textAnchor="middle" fill="url(#sfp-foil)">✓</text>
<text className="mini" x="50" y="66" textAnchor="middle" fill="url(#sfp-foil)">VERIFIED</text>
</svg></div><figcaption>Setnayan Verified</figcaption></figure>
<figure className="ib"><div className="ibs"><svg className="sv sv-seal" viewBox="0 0 100 100">
<g filter="url(#sfp-shadow)"><path d="M50,4 A6.4,6.4 0 0 1 61.9,5.6 A6.4,6.4 0 0 1 73,10.2 A6.4,6.4 0 0 1 82.5,17.5 A6.4,6.4 0 0 1 89.8,27 A6.4,6.4 0 0 1 94.4,38.1 A6.4,6.4 0 0 1 96,50 A6.4,6.4 0 0 1 94.4,61.9 A6.4,6.4 0 0 1 89.8,73 A6.4,6.4 0 0 1 82.5,82.5 A6.4,6.4 0 0 1 73,89.8 A6.4,6.4 0 0 1 61.9,94.4 A6.4,6.4 0 0 1 50,96 A6.4,6.4 0 0 1 38.1,94.4 A6.4,6.4 0 0 1 27,89.8 A6.4,6.4 0 0 1 17.5,82.5 A6.4,6.4 0 0 1 10.2,73 A6.4,6.4 0 0 1 5.6,61.9 A6.4,6.4 0 0 1 4,50 A6.4,6.4 0 0 1 5.6,38.1 A6.4,6.4 0 0 1 10.2,27 A6.4,6.4 0 0 1 17.5,17.5 A6.4,6.4 0 0 1 27,10.2 A6.4,6.4 0 0 1 38.1,5.6 A6.4,6.4 0 0 1 50,4Z" fill="url(#sfp-rim-gold)"/></g>
<path d="M50,4 A6.4,6.4 0 0 1 61.9,5.6 A6.4,6.4 0 0 1 73,10.2 A6.4,6.4 0 0 1 82.5,17.5 A6.4,6.4 0 0 1 89.8,27 A6.4,6.4 0 0 1 94.4,38.1 A6.4,6.4 0 0 1 96,50 A6.4,6.4 0 0 1 94.4,61.9 A6.4,6.4 0 0 1 89.8,73 A6.4,6.4 0 0 1 82.5,82.5 A6.4,6.4 0 0 1 73,89.8 A6.4,6.4 0 0 1 61.9,94.4 A6.4,6.4 0 0 1 50,96 A6.4,6.4 0 0 1 38.1,94.4 A6.4,6.4 0 0 1 27,89.8 A6.4,6.4 0 0 1 17.5,82.5 A6.4,6.4 0 0 1 10.2,73 A6.4,6.4 0 0 1 5.6,61.9 A6.4,6.4 0 0 1 4,50 A6.4,6.4 0 0 1 5.6,38.1 A6.4,6.4 0 0 1 10.2,27 A6.4,6.4 0 0 1 17.5,17.5 A6.4,6.4 0 0 1 27,10.2 A6.4,6.4 0 0 1 38.1,5.6 A6.4,6.4 0 0 1 50,4Z" fill="url(#sfp-gloss)"/>
<path d="M50,4 A6.4,6.4 0 0 1 61.9,5.6 A6.4,6.4 0 0 1 73,10.2 A6.4,6.4 0 0 1 82.5,17.5 A6.4,6.4 0 0 1 89.8,27 A6.4,6.4 0 0 1 94.4,38.1 A6.4,6.4 0 0 1 96,50 A6.4,6.4 0 0 1 94.4,61.9 A6.4,6.4 0 0 1 89.8,73 A6.4,6.4 0 0 1 82.5,82.5 A6.4,6.4 0 0 1 73,89.8 A6.4,6.4 0 0 1 61.9,94.4 A6.4,6.4 0 0 1 50,96 A6.4,6.4 0 0 1 38.1,94.4 A6.4,6.4 0 0 1 27,89.8 A6.4,6.4 0 0 1 17.5,82.5 A6.4,6.4 0 0 1 10.2,73 A6.4,6.4 0 0 1 5.6,61.9 A6.4,6.4 0 0 1 4,50 A6.4,6.4 0 0 1 5.6,38.1 A6.4,6.4 0 0 1 10.2,27 A6.4,6.4 0 0 1 17.5,17.5 A6.4,6.4 0 0 1 27,10.2 A6.4,6.4 0 0 1 38.1,5.6 A6.4,6.4 0 0 1 50,4Z" fill="url(#sfp-shade)"/>
<circle cx="50" cy="50" r="42" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth=".9"/>
<circle cx="50" cy="50" r="40.6" fill="none" stroke="#000" strokeOpacity=".28" strokeWidth=".9"/>
<circle cx="50" cy="50" r="39.5" fill="url(#sfp-face-ivory)"/>
<circle cx="50" cy="50" r="39.5" fill="url(#sfp-faceGloss)"/>
<circle cx="50" cy="50" r="37.6" fill="none" stroke="#7F5F20" strokeOpacity=".5" strokeWidth=".7"/>
<circle cx="50" cy="50" r="35.4" fill="none" stroke="#7F5F20" strokeOpacity=".38" strokeWidth=".6" strokeDasharray="1 2.1"/>
<text className="num" x="50" y="53.5" textAnchor="middle" fill="#FFFFFF" opacity=".55" dy=".9">23</text>
<text className="num" x="50" y="53.5" textAnchor="middle" fill="#7F5F20">23</text>
<text className="mini" x="50" y="66" textAnchor="middle" fill="#7F5F20">SINCE</text>
</svg></div><figcaption>In business since</figcaption></figure>
<figure className="ib"><div className="ibs"><svg className="sv sv-hex" viewBox="0 0 100 100">
<g filter="url(#sfp-shadow)"><polygon points="100,50 75,93.3 25,93.3 0,50 25,6.7 75,6.7" fill="url(#sfp-rim-bronze)"/></g>
<g><polygon className="fd" opacity=".2" points="100,50 75,93.3 70.5,85.5 91,50"/><polygon className="fd" opacity=".36" points="75,93.3 25,93.3 29.5,85.5 70.5,85.5"/><polygon className="fl" opacity=".08" points="25,93.3 0,50 9,50 29.5,85.5"/><polygon className="fl" opacity=".34" points="0,50 25,6.7 29.5,14.5 9,50"/><polygon className="fl" opacity=".52" points="25,6.7 75,6.7 70.5,14.5 29.5,14.5"/><polygon className="fl" opacity=".14" points="75,6.7 100,50 91,50 70.5,14.5"/></g>
<polygon points="91,50 70.5,85.5 29.5,85.5 9,50 29.5,14.5 70.5,14.5" fill="none" stroke="#000" strokeOpacity=".3" strokeWidth=".9"/>
<polygon points="87.5,50 68.75,82.5 31.25,82.5 12.5,50 31.25,17.5 68.75,17.5" fill="url(#sfp-face-bronze)"/>
<g opacity="0"><polygon className="fl" opacity=".18" points="87.5,50 68.75,82.5 50,50"/><polygon className="fl" opacity=".18" points="31.25,82.5 12.5,50 50,50"/><polygon className="fl" opacity=".18" points="31.25,17.5 68.75,17.5 50,50"/><polygon points="87.5,50 68.75,82.5 31.25,82.5 12.5,50 31.25,17.5 68.75,17.5" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth=".6"/><path d="M87.5,50 L12.5,50 M68.75,82.5 L31.25,17.5 M31.25,82.5 L68.75,17.5" stroke="#fff" strokeOpacity=".45" strokeWidth=".6"/></g>
<polygon points="87.5,50 68.75,82.5 31.25,82.5 12.5,50 31.25,17.5 68.75,17.5" fill="url(#sfp-faceGloss)"/>
<polygon points="84.5,50 67.25,79.9 32.75,79.9 15.5,50 32.75,20.1 67.25,20.1" fill="none" stroke="#4A2810" strokeOpacity=".4" strokeWidth=".7"/>
<text className="num" x="50" y="53.5" textAnchor="middle" fill="#FFF3E6" opacity=".55" dy=".9">13</text>
<text className="num" x="50" y="53.5" textAnchor="middle" fill="#4A2810">13</text>
<text className="mini" x="50" y="66" textAnchor="middle" fill="#4A2810">EVENTS</text>
</svg></div><figcaption>Events · Bronze</figcaption></figure>
<figure className="ib"><div className="ibs"><svg className="sv sv-hex" viewBox="0 0 100 100">
<g filter="url(#sfp-shadow)"><polygon points="100,50 75,93.3 25,93.3 0,50 25,6.7 75,6.7" fill="url(#sfp-rim-silver)"/></g>
<g><polygon className="fd" opacity=".2" points="100,50 75,93.3 70.5,85.5 91,50"/><polygon className="fd" opacity=".36" points="75,93.3 25,93.3 29.5,85.5 70.5,85.5"/><polygon className="fl" opacity=".08" points="25,93.3 0,50 9,50 29.5,85.5"/><polygon className="fl" opacity=".34" points="0,50 25,6.7 29.5,14.5 9,50"/><polygon className="fl" opacity=".52" points="25,6.7 75,6.7 70.5,14.5 29.5,14.5"/><polygon className="fl" opacity=".14" points="75,6.7 100,50 91,50 70.5,14.5"/></g>
<polygon points="91,50 70.5,85.5 29.5,85.5 9,50 29.5,14.5 70.5,14.5" fill="none" stroke="#000" strokeOpacity=".3" strokeWidth=".9"/>
<polygon points="87.5,50 68.75,82.5 31.25,82.5 12.5,50 31.25,17.5 68.75,17.5" fill="url(#sfp-face-silver)"/>
<g opacity="0"><polygon className="fl" opacity=".18" points="87.5,50 68.75,82.5 50,50"/><polygon className="fl" opacity=".18" points="31.25,82.5 12.5,50 50,50"/><polygon className="fl" opacity=".18" points="31.25,17.5 68.75,17.5 50,50"/><polygon points="87.5,50 68.75,82.5 31.25,82.5 12.5,50 31.25,17.5 68.75,17.5" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth=".6"/><path d="M87.5,50 L12.5,50 M68.75,82.5 L31.25,17.5 M31.25,82.5 L68.75,17.5" stroke="#fff" strokeOpacity=".45" strokeWidth=".6"/></g>
<polygon points="87.5,50 68.75,82.5 31.25,82.5 12.5,50 31.25,17.5 68.75,17.5" fill="url(#sfp-faceGloss)"/>
<polygon points="84.5,50 67.25,79.9 32.75,79.9 15.5,50 32.75,20.1 67.25,20.1" fill="none" stroke="#363C43" strokeOpacity=".4" strokeWidth=".7"/>
<text className="num" x="50" y="53.5" textAnchor="middle" fill="#FFFFFF" opacity=".55" dy=".9">12</text>
<text className="num" x="50" y="53.5" textAnchor="middle" fill="#363C43">12</text>
<text className="mini" x="50" y="66" textAnchor="middle" fill="#363C43">REVIEWS</text>
</svg></div><figcaption>Reviews · Silver</figcaption></figure>
<figure className="ib"><div className="ibs"><svg className="sv sv-hex" viewBox="0 0 100 100">
<g filter="url(#sfp-shadow)"><polygon points="100,50 75,93.3 25,93.3 0,50 25,6.7 75,6.7" fill="url(#sfp-rim-gold)"/></g>
<g><polygon className="fd" opacity=".2" points="100,50 75,93.3 70.5,85.5 91,50"/><polygon className="fd" opacity=".36" points="75,93.3 25,93.3 29.5,85.5 70.5,85.5"/><polygon className="fl" opacity=".08" points="25,93.3 0,50 9,50 29.5,85.5"/><polygon className="fl" opacity=".34" points="0,50 25,6.7 29.5,14.5 9,50"/><polygon className="fl" opacity=".52" points="25,6.7 75,6.7 70.5,14.5 29.5,14.5"/><polygon className="fl" opacity=".14" points="75,6.7 100,50 91,50 70.5,14.5"/></g>
<polygon points="91,50 70.5,85.5 29.5,85.5 9,50 29.5,14.5 70.5,14.5" fill="none" stroke="#000" strokeOpacity=".3" strokeWidth=".9"/>
<polygon points="87.5,50 68.75,82.5 31.25,82.5 12.5,50 31.25,17.5 68.75,17.5" fill="url(#sfp-face-gold)"/>
<g opacity="0"><polygon className="fl" opacity=".18" points="87.5,50 68.75,82.5 50,50"/><polygon className="fl" opacity=".18" points="31.25,82.5 12.5,50 50,50"/><polygon className="fl" opacity=".18" points="31.25,17.5 68.75,17.5 50,50"/><polygon points="87.5,50 68.75,82.5 31.25,82.5 12.5,50 31.25,17.5 68.75,17.5" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth=".6"/><path d="M87.5,50 L12.5,50 M68.75,82.5 L31.25,17.5 M31.25,82.5 L68.75,17.5" stroke="#fff" strokeOpacity=".45" strokeWidth=".6"/></g>
<polygon points="87.5,50 68.75,82.5 31.25,82.5 12.5,50 31.25,17.5 68.75,17.5" fill="url(#sfp-faceGloss)"/>
<polygon points="84.5,50 67.25,79.9 32.75,79.9 15.5,50 32.75,20.1 67.25,20.1" fill="none" stroke="#5A400E" strokeOpacity=".4" strokeWidth=".7"/>
<text className="num" x="50" y="53.5" textAnchor="middle" fill="#FFFBEA" opacity=".55" dy=".9">25</text>
<text className="num" x="50" y="53.5" textAnchor="middle" fill="#5A400E">25</text>
<text className="mini" x="50" y="66" textAnchor="middle" fill="#5A400E">1ST PICK</text>
</svg></div><figcaption>1st Pick · Gold</figcaption></figure>
<figure className="ib"><div className="ibs"><svg className="sv sv-hex" viewBox="0 0 100 100">
<g filter="url(#sfp-shadow)"><polygon points="100,50 75,93.3 25,93.3 0,50 25,6.7 75,6.7" fill="url(#sfp-rim-plat)"/></g>
<g><polygon className="fd" opacity=".2" points="100,50 75,93.3 70.5,85.5 91,50"/><polygon className="fd" opacity=".36" points="75,93.3 25,93.3 29.5,85.5 70.5,85.5"/><polygon className="fl" opacity=".08" points="25,93.3 0,50 9,50 29.5,85.5"/><polygon className="fl" opacity=".34" points="0,50 25,6.7 29.5,14.5 9,50"/><polygon className="fl" opacity=".52" points="25,6.7 75,6.7 70.5,14.5 29.5,14.5"/><polygon className="fl" opacity=".14" points="75,6.7 100,50 91,50 70.5,14.5"/></g>
<polygon points="91,50 70.5,85.5 29.5,85.5 9,50 29.5,14.5 70.5,14.5" fill="none" stroke="#000" strokeOpacity=".3" strokeWidth=".9"/>
<polygon points="87.5,50 68.75,82.5 31.25,82.5 12.5,50 31.25,17.5 68.75,17.5" fill="url(#sfp-face-plat)"/>
<g opacity="0"><polygon className="fl" opacity=".18" points="87.5,50 68.75,82.5 50,50"/><polygon className="fl" opacity=".18" points="31.25,82.5 12.5,50 50,50"/><polygon className="fl" opacity=".18" points="31.25,17.5 68.75,17.5 50,50"/><polygon points="87.5,50 68.75,82.5 31.25,82.5 12.5,50 31.25,17.5 68.75,17.5" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth=".6"/><path d="M87.5,50 L12.5,50 M68.75,82.5 L31.25,17.5 M31.25,82.5 L68.75,17.5" stroke="#fff" strokeOpacity=".45" strokeWidth=".6"/></g>
<polygon points="87.5,50 68.75,82.5 31.25,82.5 12.5,50 31.25,17.5 68.75,17.5" fill="url(#sfp-faceGloss)"/>
<polygon points="84.5,50 67.25,79.9 32.75,79.9 15.5,50 32.75,20.1 67.25,20.1" fill="none" stroke="#1F2A33" strokeOpacity=".4" strokeWidth=".7"/>
<text className="num" x="50" y="53.5" textAnchor="middle" fill="#FFFFFF" opacity=".55" dy=".9">20</text>
<text className="num" x="50" y="53.5" textAnchor="middle" fill="#1F2A33">20</text>
<text className="mini" x="50" y="66" textAnchor="middle" fill="#1F2A33">CARDS</text>
</svg></div><figcaption>Service cards · Platinum</figcaption></figure>
<figure className="ib"><div className="ibs"><svg className="sv sv-hex" viewBox="0 0 100 100">
<g filter="url(#sfp-shadow)"><polygon points="100,50 75,93.3 25,93.3 0,50 25,6.7 75,6.7" fill="url(#sfp-rim-ruby)"/></g>
<g><polygon className="fd" opacity=".2" points="100,50 75,93.3 70.5,85.5 91,50"/><polygon className="fd" opacity=".36" points="75,93.3 25,93.3 29.5,85.5 70.5,85.5"/><polygon className="fl" opacity=".08" points="25,93.3 0,50 9,50 29.5,85.5"/><polygon className="fl" opacity=".34" points="0,50 25,6.7 29.5,14.5 9,50"/><polygon className="fl" opacity=".52" points="25,6.7 75,6.7 70.5,14.5 29.5,14.5"/><polygon className="fl" opacity=".14" points="75,6.7 100,50 91,50 70.5,14.5"/></g>
<polygon points="91,50 70.5,85.5 29.5,85.5 9,50 29.5,14.5 70.5,14.5" fill="none" stroke="#000" strokeOpacity=".3" strokeWidth=".9"/>
<polygon points="87.5,50 68.75,82.5 31.25,82.5 12.5,50 31.25,17.5 68.75,17.5" fill="url(#sfp-face-ruby)"/>
<g opacity="0"><polygon className="fl" opacity=".18" points="87.5,50 68.75,82.5 50,50"/><polygon className="fl" opacity=".18" points="31.25,82.5 12.5,50 50,50"/><polygon className="fl" opacity=".18" points="31.25,17.5 68.75,17.5 50,50"/><polygon points="87.5,50 68.75,82.5 31.25,82.5 12.5,50 31.25,17.5 68.75,17.5" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth=".6"/><path d="M87.5,50 L12.5,50 M68.75,82.5 L31.25,17.5 M31.25,82.5 L68.75,17.5" stroke="#fff" strokeOpacity=".45" strokeWidth=".6"/></g>
<polygon points="87.5,50 68.75,82.5 31.25,82.5 12.5,50 31.25,17.5 68.75,17.5" fill="url(#sfp-faceGloss)"/>
<polygon points="84.5,50 67.25,79.9 32.75,79.9 15.5,50 32.75,20.1 67.25,20.1" fill="none" stroke="#FFE6EA" strokeOpacity=".4" strokeWidth=".7"/>
<text className="num" x="50" y="53.5" textAnchor="middle" fill="#2A0309" opacity=".55" dy=".9">5k</text>
<text className="num" x="50" y="53.5" textAnchor="middle" fill="#FFE6EA">5k</text>
<text className="mini" x="50" y="66" textAnchor="middle" fill="#FFE6EA">EVENTS</text>
</svg></div><figcaption>{ladderCaption(5000)}</figcaption></figure>
<figure className="ib"><div className="ibs"><svg className="sv sv-hex" viewBox="0 0 100 100">
<g filter="url(#sfp-shadow)"><polygon points="100,50 75,93.3 25,93.3 0,50 25,6.7 75,6.7" fill="url(#sfp-rim-black)"/></g>
<g><polygon className="fd" opacity=".2" points="100,50 75,93.3 70.5,85.5 91,50"/><polygon className="fd" opacity=".36" points="75,93.3 25,93.3 29.5,85.5 70.5,85.5"/><polygon className="fl" opacity=".08" points="25,93.3 0,50 9,50 29.5,85.5"/><polygon className="fl" opacity=".34" points="0,50 25,6.7 29.5,14.5 9,50"/><polygon className="fl" opacity=".52" points="25,6.7 75,6.7 70.5,14.5 29.5,14.5"/><polygon className="fl" opacity=".14" points="75,6.7 100,50 91,50 70.5,14.5"/></g>
<polygon points="91,50 70.5,85.5 29.5,85.5 9,50 29.5,14.5 70.5,14.5" fill="none" stroke="#000" strokeOpacity=".3" strokeWidth=".9"/>
<polygon points="87.5,50 68.75,82.5 31.25,82.5 12.5,50 31.25,17.5 68.75,17.5" fill="url(#sfp-face-black)"/>
<g opacity="0.35"><polygon className="fl" opacity=".18" points="87.5,50 68.75,82.5 50,50"/><polygon className="fl" opacity=".18" points="31.25,82.5 12.5,50 50,50"/><polygon className="fl" opacity=".18" points="31.25,17.5 68.75,17.5 50,50"/><polygon points="87.5,50 68.75,82.5 31.25,82.5 12.5,50 31.25,17.5 68.75,17.5" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth=".6"/><path d="M87.5,50 L12.5,50 M68.75,82.5 L31.25,17.5 M31.25,82.5 L68.75,17.5" stroke="#fff" strokeOpacity=".45" strokeWidth=".6"/></g>
<polygon points="87.5,50 68.75,82.5 31.25,82.5 12.5,50 31.25,17.5 68.75,17.5" fill="url(#sfp-faceGloss)"/>
<polygon points="84.5,50 67.25,79.9 32.75,79.9 15.5,50 32.75,20.1 67.25,20.1" fill="none" stroke="#F4F6F8" strokeOpacity=".4" strokeWidth=".7"/>
<text className="num" x="50" y="53.5" textAnchor="middle" fill="#000000" opacity=".55" dy=".9">10k</text>
<text className="num" x="50" y="53.5" textAnchor="middle" fill="#F4F6F8">10k</text>
<text className="mini" x="50" y="66" textAnchor="middle" fill="#F4F6F8">EVENTS</text>
</svg></div><figcaption>{ladderCaption(10000)}</figcaption></figure>
<figure className="ib"><div className="ibs"><svg className="sv sv-star" viewBox="0 0 100 100">
<g filter="url(#sfp-shadow)"><polygon points="50,0 60.1,12.3 75,6.7 77.6,22.4 93.3,25 87.7,39.9 100,50 87.7,60.1 93.3,75 77.6,77.6 75,93.3 60.1,87.7 50,100 39.9,87.7 25,93.3 22.4,77.6 6.7,75 12.3,60.1 0,50 12.3,39.9 6.7,25 22.4,22.4 25,6.7 39.9,12.3" fill="url(#sfp-rim-gold)"/></g>
<g className="fl" opacity=".5"><polygon points="39.9,12.3 50,0 50,50"/><polygon points="60.1,12.3 75,6.7 50,50"/><polygon points="77.6,22.4 93.3,25 50,50"/><polygon points="87.7,39.9 100,50 50,50"/><polygon points="87.7,60.1 93.3,75 50,50"/><polygon points="77.6,77.6 75,93.3 50,50"/><polygon points="60.1,87.7 50,100 50,50"/><polygon points="39.9,87.7 25,93.3 50,50"/><polygon points="22.4,77.6 6.7,75 50,50"/><polygon points="12.3,60.1 0,50 50,50"/><polygon points="12.3,39.9 6.7,25 50,50"/><polygon points="22.4,22.4 25,6.7 50,50"/></g>
<g fill="#4A2E08" opacity=".34"><polygon points="50,0 60.1,12.3 50,50"/><polygon points="75,6.7 77.6,22.4 50,50"/><polygon points="93.3,25 87.7,39.9 50,50"/><polygon points="100,50 87.7,60.1 50,50"/><polygon points="93.3,75 77.6,77.6 50,50"/><polygon points="75,93.3 60.1,87.7 50,50"/><polygon points="50,100 39.9,87.7 50,50"/><polygon points="25,93.3 22.4,77.6 50,50"/><polygon points="6.7,75 12.3,60.1 50,50"/><polygon points="0,50 12.3,39.9 50,50"/><polygon points="6.7,25 22.4,22.4 50,50"/><polygon points="25,6.7 39.9,12.3 50,50"/></g>
<polygon points="50,0 60.1,12.3 75,6.7 77.6,22.4 93.3,25 87.7,39.9 100,50 87.7,60.1 93.3,75 77.6,77.6 75,93.3 60.1,87.7 50,100 39.9,87.7 25,93.3 22.4,77.6 6.7,75 12.3,60.1 0,50 12.3,39.9 6.7,25 22.4,22.4 25,6.7 39.9,12.3" fill="url(#sfp-shade)"/>
<circle cx="50" cy="50" r="36.5" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth=".9"/>
<circle cx="50" cy="50" r="35.2" fill="none" stroke="#000" strokeOpacity=".3" strokeWidth=".9"/>
<circle cx="50" cy="50" r="34.2" fill="url(#sfp-face-first)"/>
<circle cx="50" cy="50" r="34.2" fill="url(#sfp-faceGloss)"/>
<circle cx="50" cy="50" r="31.8" fill="none" stroke="#6B4D14" strokeOpacity=".45" strokeWidth=".7"/>
<circle cx="50" cy="50" r="30.2" fill="none" stroke="#6B4D14" strokeOpacity=".32" strokeWidth=".55" strokeDasharray="1 2"/>
<text className="num sm" x="50" y="52" textAnchor="middle" fill="#FFFFFF" opacity=".55" dy=".8">1st</text>
<text className="num sm" x="50" y="52" textAnchor="middle" fill="#6B4D14">1st</text>
<text className="mini sm" x="50" y="63.5" textAnchor="middle" fill="#6B4D14">BOOKING</text>
</svg></div><figcaption>First booking</figcaption></figure>
<figure className="ib"><div className="ibs"><svg className="sv sv-ros" viewBox="0 0 100 125">
<g filter="url(#sfp-shadowSoft)"><polygon points="27,64 45,67 41,122 34,113 25,121" fill="url(#sfp-tail)"/><polygon points="73,64 55,67 59,122 66,113 75,121" fill="url(#sfp-tail)"/></g>
<polygon points="27,64 45,67 41,122 34,113 25,121" fill="url(#sfp-shade)"/><polygon points="73,64 55,67 59,122 66,113 75,121" fill="url(#sfp-gloss)" opacity=".5"/>
<path d="M36,72 L31,117" stroke="url(#sfp-foil)" strokeWidth="1.4" strokeOpacity=".9"/><path d="M64,72 L69,117" stroke="url(#sfp-foil)" strokeWidth="1.4" strokeOpacity=".9"/>
<g filter="url(#sfp-shadow)"><polygon points="52.4,1.6 56.5,6.5 61.8,3 64.8,8.6 70.7,6.2 72.6,12.3 78.9,11 79.5,17.4 85.9,17.4 85.3,23.8 91.6,25.1 89.8,31.2 95.7,33.7 92.7,39.3 98,42.9 93.9,47.8 98.4,52.4 93.5,56.5 97,61.8 91.4,64.8 93.8,70.7 87.7,72.6 89,78.9 82.6,79.5 82.6,85.9 76.2,85.3 74.9,91.6 68.8,89.8 66.3,95.7 60.7,92.7 57.1,98 52.2,93.9 47.6,98.4 43.5,93.5 38.2,97 35.2,91.4 29.3,93.8 27.4,87.7 21.1,89 20.5,82.6 14.1,82.6 14.7,76.2 8.4,74.9 10.2,68.8 4.3,66.3 7.3,60.7 2,57.1 6.1,52.2 1.6,47.6 6.5,43.5 3,38.2 8.6,35.2 6.2,29.3 12.3,27.4 11,21.1 17.4,20.5 17.4,14.1 23.8,14.7 25.1,8.4 31.2,10.2 33.7,4.3 39.3,7.3 42.9,2 47.8,6.1" fill="url(#sfp-rim-gold)"/></g>
<polygon points="52.4,1.6 56.5,6.5 61.8,3 64.8,8.6 70.7,6.2 72.6,12.3 78.9,11 79.5,17.4 85.9,17.4 85.3,23.8 91.6,25.1 89.8,31.2 95.7,33.7 92.7,39.3 98,42.9 93.9,47.8 98.4,52.4 93.5,56.5 97,61.8 91.4,64.8 93.8,70.7 87.7,72.6 89,78.9 82.6,79.5 82.6,85.9 76.2,85.3 74.9,91.6 68.8,89.8 66.3,95.7 60.7,92.7 57.1,98 52.2,93.9 47.6,98.4 43.5,93.5 38.2,97 35.2,91.4 29.3,93.8 27.4,87.7 21.1,89 20.5,82.6 14.1,82.6 14.7,76.2 8.4,74.9 10.2,68.8 4.3,66.3 7.3,60.7 2,57.1 6.1,52.2 1.6,47.6 6.5,43.5 3,38.2 8.6,35.2 6.2,29.3 12.3,27.4 11,21.1 17.4,20.5 17.4,14.1 23.8,14.7 25.1,8.4 31.2,10.2 33.7,4.3 39.3,7.3 42.9,2 47.8,6.1" className="fd" opacity=".32"/>
<polygon points="50,0 54.5,4.7 59.8,1 63.2,6.5 69.1,3.8 71.4,9.9 77.8,8.4 78.9,14.8 85.4,14.6 85.2,21.1 91.6,22.2 90.1,28.6 96.2,30.9 93.5,36.8 99,40.2 95.3,45.5 100,50 95.3,54.5 99,59.8 93.5,63.2 96.2,69.1 90.1,71.4 91.6,77.8 85.2,78.9 85.4,85.4 78.9,85.2 77.8,91.6 71.4,90.1 69.1,96.2 63.2,93.5 59.8,99 54.5,95.3 50,100 45.5,95.3 40.2,99 36.8,93.5 30.9,96.2 28.6,90.1 22.2,91.6 21.1,85.2 14.6,85.4 14.8,78.9 8.4,77.8 9.9,71.4 3.8,69.1 6.5,63.2 1,59.8 4.7,54.5 0,50 4.7,45.5 1,40.2 6.5,36.8 3.8,30.9 9.9,28.6 8.4,22.2 14.8,21.1 14.6,14.6 21.1,14.8 22.2,8.4 28.6,9.9 30.9,3.8 36.8,6.5 40.2,1 45.5,4.7" fill="url(#sfp-rim-gold)"/>
<polygon points="50,0 54.5,4.7 59.8,1 63.2,6.5 69.1,3.8 71.4,9.9 77.8,8.4 78.9,14.8 85.4,14.6 85.2,21.1 91.6,22.2 90.1,28.6 96.2,30.9 93.5,36.8 99,40.2 95.3,45.5 100,50 95.3,54.5 99,59.8 93.5,63.2 96.2,69.1 90.1,71.4 91.6,77.8 85.2,78.9 85.4,85.4 78.9,85.2 77.8,91.6 71.4,90.1 69.1,96.2 63.2,93.5 59.8,99 54.5,95.3 50,100 45.5,95.3 40.2,99 36.8,93.5 30.9,96.2 28.6,90.1 22.2,91.6 21.1,85.2 14.6,85.4 14.8,78.9 8.4,77.8 9.9,71.4 3.8,69.1 6.5,63.2 1,59.8 4.7,54.5 0,50 4.7,45.5 1,40.2 6.5,36.8 3.8,30.9 9.9,28.6 8.4,22.2 14.8,21.1 14.6,14.6 21.1,14.8 22.2,8.4 28.6,9.9 30.9,3.8 36.8,6.5 40.2,1 45.5,4.7" fill="url(#sfp-gloss)"/>
<polygon points="50,0 54.5,4.7 59.8,1 63.2,6.5 69.1,3.8 71.4,9.9 77.8,8.4 78.9,14.8 85.4,14.6 85.2,21.1 91.6,22.2 90.1,28.6 96.2,30.9 93.5,36.8 99,40.2 95.3,45.5 100,50 95.3,54.5 99,59.8 93.5,63.2 96.2,69.1 90.1,71.4 91.6,77.8 85.2,78.9 85.4,85.4 78.9,85.2 77.8,91.6 71.4,90.1 69.1,96.2 63.2,93.5 59.8,99 54.5,95.3 50,100 45.5,95.3 40.2,99 36.8,93.5 30.9,96.2 28.6,90.1 22.2,91.6 21.1,85.2 14.6,85.4 14.8,78.9 8.4,77.8 9.9,71.4 3.8,69.1 6.5,63.2 1,59.8 4.7,54.5 0,50 4.7,45.5 1,40.2 6.5,36.8 3.8,30.9 9.9,28.6 8.4,22.2 14.8,21.1 14.6,14.6 21.1,14.8 22.2,8.4 28.6,9.9 30.9,3.8 36.8,6.5 40.2,1 45.5,4.7" fill="url(#sfp-shade)"/>
<circle cx="50" cy="50" r="38.6" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth=".9"/>
<circle cx="50" cy="50" r="37.3" fill="none" stroke="#000" strokeOpacity=".3" strokeWidth=".9"/>
<circle cx="50" cy="50" r="36.3" fill="url(#sfp-face-month)"/>
<circle cx="50" cy="50" r="36.3" fill="url(#sfp-faceGloss)"/>
<circle cx="50" cy="50" r="33.8" fill="none" stroke="url(#sfp-foil)" strokeOpacity=".5" strokeWidth=".7"/>
<circle cx="50" cy="50" r="32.2" fill="none" stroke="url(#sfp-foil)" strokeOpacity=".35" strokeWidth=".55" strokeDasharray="1 2"/>
<text className="num md" x="50" y="53" textAnchor="middle" fill="#000000" opacity=".55" dy=".9">★</text>
<text className="num md" x="50" y="53" textAnchor="middle" fill="url(#sfp-foil)">★</text>
<text className="mini" x="50" y="65.5" textAnchor="middle" fill="url(#sfp-foil)">NOV</text>
</svg></div><figcaption>Supplier of the month</figcaption></figure>
    </div>
  );
}
