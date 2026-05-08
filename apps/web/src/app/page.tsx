import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page-bg p-8">
      <div className="text-center">
        <h1 className="font-serif text-7xl font-medium text-ink">Tayo</h1>
        <p className="mt-4 font-sans text-lg text-ink-soft">
          Filipino Wedding Planning. Coming soon.
        </p>
        <Link
          href="/login"
          className="btn-accent mt-8 inline-flex"
        >
          Sign in
        </Link>
        <p className="meta-label mt-12">V1 scaffolding · See SPEC.md</p>
      </div>
    </main>
  );
}
