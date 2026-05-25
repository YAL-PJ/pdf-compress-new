import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.freecompresspdf.com';

export const metadata: Metadata = {
  title: 'About — PDF Compress',
  description:
    'PDF Compress is built by Yanis L., an indie maker focused on free, private, browser-based PDF tools. Learn about the tool and the person behind it.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About — PDF Compress',
    description:
      'PDF Compress is built by Yanis L., an indie maker focused on free, private, browser-based PDF tools.',
    url: `${siteUrl}/about`,
    type: 'profile',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  url: `${siteUrl}/about`,
  name: 'About PDF Compress',
  description: 'Learn about Yanis L., the indie maker who built PDF Compress.',
  about: {
    '@type': 'Person',
    '@id': 'https://freemergepdf.com/#founder',
    name: 'Yanis L.',
    url: `${siteUrl}/about`,
    image: 'https://freemergepdf.com/yanis-avatar.jpg',
    sameAs: [
      'https://www.quora.com/profile/Yanis-L-3',
      'https://x.com/compress__pdf',
    ],
  },
};

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-3">About PDF Compress</h1>
        <p className="text-lg text-slate-500 mb-12">Free, private PDF compression — built by one person.</p>

        {/* Author card */}
        <div className="flex items-start gap-6 p-7 rounded-2xl bg-blue-50 border border-blue-200 mb-12">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://freemergepdf.com/yanis-avatar.jpg"
            alt="Yanis L."
            width={88}
            height={88}
            className="rounded-full flex-shrink-0 border-2 border-blue-200 object-cover"
            loading="eager"
          />
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Yanis L.</h2>
            <p className="text-blue-700 font-semibold text-sm mb-3">Indie maker &amp; founder</p>
            <p className="text-slate-700 leading-relaxed">
              I build free, privacy-first PDF tools that run entirely in your browser. No servers,
              no uploads, no accounts. Just tools that work.
            </p>
            <div className="flex gap-3 mt-4 flex-wrap">
              <a
                href="https://www.quora.com/profile/Yanis-L-3"
                target="_blank"
                rel="noopener noreferrer me"
                className="text-sm font-semibold text-blue-600 hover:text-blue-800 border border-blue-200 rounded-full px-3 py-1 transition-colors"
              >
                Quora
              </a>
              <a
                href="https://x.com/compress__pdf"
                target="_blank"
                rel="noopener noreferrer me"
                className="text-sm font-semibold text-blue-600 hover:text-blue-800 border border-blue-200 rounded-full px-3 py-1 transition-colors"
              >
                X / Twitter
              </a>
              <a
                href="https://freemergepdf.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-blue-600 hover:text-blue-800 border border-blue-200 rounded-full px-3 py-1 transition-colors"
              >
                FreeMergePDF
              </a>
            </div>
          </div>
        </div>

        <section className="mb-10">
          <h2 className="text-xl font-bold text-slate-900 mb-3">Why I built PDF Compress</h2>
          <p className="text-slate-700 leading-relaxed">
            Most online PDF compressors require you to upload sensitive documents to unknown
            servers. PDF Compress was built differently: all compression happens inside your own
            browser using WebAssembly. Your files never leave your device.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold text-slate-900 mb-3">How it works</h2>
          <p className="text-slate-700 leading-relaxed mb-4">
            PDF Compress uses a WebAssembly-powered compression engine with 24+ methods to reduce
            file size while preserving quality. Everything runs locally in your browser tab.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-700">
            <li>Upload one or more PDF files</li>
            <li>Choose a preset (balanced, aggressive, or custom)</li>
            <li>Download compressed PDFs or a ZIP archive</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold text-slate-900 mb-3">The full suite</h2>
          <p className="text-slate-700 leading-relaxed mb-3">Part of a family of free, private PDF tools:</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-700">
            <li>
              <a href="https://freemergepdf.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                FreeMergePDF
              </a>{' '}
              — merge multiple PDFs into one
            </li>
            <li>
              <a href="https://splitpdffree.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                SplitPDF
              </a>{' '}
              — split PDF pages
            </li>
            <li>
              <a href="https://converttopdffree.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                ConvertToPDFFree
              </a>{' '}
              — convert images to PDF
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">Contact</h2>
          <p className="text-slate-700 leading-relaxed">
            Questions or feedback? Reach out on{' '}
            <a
              href="https://x.com/compress__pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              X / Twitter
            </a>.
          </p>
        </section>
      </main>
    </>
  );
}
