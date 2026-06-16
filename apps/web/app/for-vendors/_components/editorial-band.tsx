/**
 * EditorialBand · the one full-bleed emotional beat on the for-vendors page.
 *
 * Owner 2026-06-15: "make the imagery more relatable — we want them to feel
 * 'yes, that is my problem.'" So this no longer shows the aspirational output
 * (a styled reception table = the dream); it shows the vendor's REALITY — a
 * tired wedding florist, late at night, drowning in her phone while the work
 * waits. Paired with a recognition-hook line that names the pain (the owner's
 * own "95% of inquiries never book me") and pivots to the fix. Sits after
 * VendorVision. Generated on-brand (Recraft) since the asset library is all
 * polished output, no "vendor's daily grind" imagery.
 */
import Image from 'next/image';

export function EditorialBand() {
  return (
    <section
      aria-label="A wedding vendor's late-night reality"
      style={{
        position: 'relative',
        height: 'clamp(320px, 44vh, 480px)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Image
        src="/for-vendors/vendor-late-night.avif"
        alt="A tired Filipino wedding florist sitting alone at her worktable late at night, reading a stream of messages on her phone while bouquets and an open laptop wait beside her"
        fill
        sizes="100vw"
        style={{ objectFit: 'cover', objectPosition: 'center' }}
      />
      {/* Left-weighted dark wash — keeps the copy legible over the darker
          left third while her face (center) stays clear. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, rgba(15,16,18,0.86) 0%, rgba(15,16,18,0.58) 42%, rgba(15,16,18,0.12) 100%)',
        }}
      />
      <div style={{ position: 'relative', padding: '0 clamp(20px, 5vw, 56px)', maxWidth: 1080, margin: '0 auto', width: '100%' }}>
        <div className="m-mono" style={{ fontSize: 12, letterSpacing: '0.18em', color: 'var(--m-orange-3)', textTransform: 'uppercase' }}>
          Sound familiar?
        </div>
        <h2
          className="m-display"
          style={{ fontSize: 'clamp(26px, 4vw, 46px)', lineHeight: 1.06, margin: '14px 0 0', color: '#FBFBFA', maxWidth: 560 }}
        >
          The inquiries never stop — and most were never going to book you.
        </h2>
        <p style={{ fontSize: 'clamp(15px, 1.7vw, 17px)', lineHeight: 1.55, margin: '16px 0 0', color: 'rgba(251,251,250,0.82)', maxWidth: 480 }}>
          That’s the part we fix. You focus on the craft — we bring you the couples who actually fit.
        </p>
      </div>
    </section>
  );
}
