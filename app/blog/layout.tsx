import Link from 'next/link';

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-slate-50 min-h-screen">
      <section className="max-w-3xl mx-auto px-4 py-14">
        <p className="text-sm text-slate-600 mb-6">
          <Link href="/" className="text-blue-700 hover:underline">
            Home
          </Link>{' '}
          /{' '}
          <Link href="/blog/" className="text-blue-700 hover:underline">
            Blog
          </Link>
        </p>
        {children}
        <section className="mt-14 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Ready to compress?</h2>
          <p className="text-slate-700 leading-7 mb-4">
            Try PDF Compress for free. No sign-up, no uploads to a server, no nonsense.
          </p>
          <Link
            href="/"
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700"
          >
            Compress a PDF now
          </Link>
        </section>
      </section>
    </main>
  );
}
