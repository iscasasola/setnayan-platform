import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-aubergine-50 p-8">
      <div className="text-center">
        <h1 className="font-serif text-7xl font-medium text-aubergine-700">Tayo</h1>
        <p className="mt-4 font-sans text-lg text-aubergine-800/70">
          Filipino Wedding Planning. Coming soon.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block rounded-md bg-aubergine-700 px-6 py-3 font-sans text-base font-medium text-white transition hover:bg-aubergine-800"
        >
          Sign in
        </Link>
        <p className="mt-12 font-sans text-xs uppercase tracking-widest text-aubergine-600/60">
          V1 scaffolding · See SPEC.md
        </p>
      </div>
    </main>
  );
}
