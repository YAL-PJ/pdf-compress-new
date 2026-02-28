import type { Metadata } from 'next';
import Link from 'next/link';
import { seoFaqs } from '@/lib/seo';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.freecompresspdf.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'PDF Compression FAQ - File Size, Privacy, Quality, and Limits',
  description:
    'Read common questions about compressing PDF files online, including quality impact, file size limits, security, and local browser processing.',
  alternates: {
    canonical: '/faq/',
  },
  openGraph: {
    title: 'PDF Compression FAQ',
    description:
      'Answers to the most common questions about online PDF compression, privacy, and quality settings.',
    type: 'article',
    url: '/faq',
  },
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'FAQPage',
      mainEntity: seoFaqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: siteUrl,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'FAQ',
          item: `${siteUrl}/faq`,
        },
      ],
    },
  ],
};

export default function FaqPage() {
  return (
    <main className="bg-slate-50 min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <section className="max-w-4xl mx-auto px-4 py-14">
        <p className="text-sm text-slate-600 mb-4">
          <Link href="/" className="text-blue-700 hover:underline">
            Home
          </Link>{' '}
          / FAQ
        </p>

        <h1 className="text-4xl font-extrabold text-slate-900 mb-4">PDF Compression FAQ</h1>
        <p className="text-slate-700 leading-7 mb-10">
          This page answers common questions about using our free PDF compressor online. If you are
          trying to reduce PDF size for email, websites, or document portals, these answers cover
          quality tradeoffs, privacy details, and expected compression results.
        </p>

        <div className="space-y-6">
          {seoFaqs.map((faq) => (
            <article key={faq.question} className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-2">{faq.question}</h2>
              <p className="text-slate-700 leading-7">{faq.answer}</p>
            </article>
          ))}
        </div>

        <section className="mt-12 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Need to compress right now?</h2>
          <p className="text-slate-700 leading-7 mb-4">
            Go back to the home page to upload your file and choose your compression level.
          </p>
          <Link
            href="/"
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700"
          >
            Compress a PDF
          </Link>
        </section>
      </section>
    </main>
  );
}
