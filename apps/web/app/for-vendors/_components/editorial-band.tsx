/**
 * EditorialBand · a single full-bleed photographic breath on the otherwise
 * type-and-card for-vendors page (owner 2026-06-15 "use photos if needed").
 *
 * Uses a real on-brand production asset (the candlelit reception table) behind
 * a dark wash, with one poster line that bridges the vision ("give back your
 * time") into the what-you-get stack below. Sits after VendorVision. next/image
 * with a local /public path optimizes at build time.
 */
import Image from 'next/image';

export function EditorialBand() {
  return (
    <section
      aria-label="The craft you create"
      style={{
        position: 'relative',
        height: 'clamp(300px, 42vh, 460px)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Image
        src="/dashboard/cover-reception-table.avif"
        alt="An elegant candlelit wedding reception table set with burgundy florals and gold chairs"
        fill
        sizes="100vw"
        style={{ objectFit: 'cover', objectPosition: 'center' }}
      />
      {/* Dark wash for text contrast */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, rgba(15,16,18,0.74) 0%, rgba(15,16,18,0.46) 55%, rgba(15,16,18,0.30) 100%)',
        }}
      />
      <div style={{ position: 'relative', padding: '0 clamp(20px, 5vw, 56px)', maxWidth: 1080, margin: '0 auto', width: '100%' }}>
        <div className="m-mono" style={{ fontSize: 12, letterSpacing: '0.18em', color: 'var(--m-orange-3)', textTransform: 'uppercase' }}>
          Why we built this
        </div>
        <h2
          className="m-display"
          style={{ fontSize: 'clamp(28px, 4.4vw, 52px)', lineHeight: 1.04, margin: '14px 0 0', color: '#FBFBFA', maxWidth: 720 }}
        >
          Spend your hours on the craft —
          <br />
          not on chasing the next inquiry.
        </h2>
      </div>
    </section>
  );
}
