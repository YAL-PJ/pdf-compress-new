import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.freecompresspdf.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Terms of Service - PDF Compress',
  description:
    'Terms of Service for PDF Compress. Understand your rights and responsibilities when using our free, browser-based PDF compression service.',
  alternates: {
    canonical: '/terms',
  },
  openGraph: {
    title: 'Terms of Service - PDF Compress',
    description:
      'Terms and conditions for using PDF Compress, a free browser-based PDF compression tool.',
    type: 'article',
    url: '/terms',
  },
};

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
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
      name: 'Terms of Service',
      item: `${siteUrl}/terms`,
    },
  ],
};

export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to PDF Compress
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <article className="prose prose-slate max-w-none">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Terms of Service
          </h1>

          <p className="text-slate-500 text-sm mb-8">
            Last updated:{' '}
            {new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using PDF Compress at freecompresspdf.com (the "Service"),
            you agree to be bound by these Terms of Service (“Terms”). If you do
            not agree to these Terms, please do not use the Service.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            PDF Compress is a free, browser-based tool that compresses PDF files.
            The Service operates entirely within your web browser using
            client-side processing technology. Your files are processed locally
            on your device and are never uploaded to our servers.
          </p>

          <h2>3. Use of the Service</h2>
          <h3>3.1 Permitted Use</h3>
          <p>
            You may use the Service for lawful purposes to compress PDF files that
            you own or have the legal right to modify.
          </p>

          <h3>3.2 Prohibited Use</h3>
          <ul>
            <li>Use the Service for any illegal purpose</li>
            <li>Process files you do not have rights to</li>
            <li>Attempt to interfere with or disrupt the Service</li>
            <li>Reverse engineer, decompile, or disassemble the Service</li>
            <li>Use automated systems in a way that exceeds reasonable usage</li>
            <li>Remove or alter proprietary notices</li>
          </ul>

          <h2>4. Your Files and Content</h2>
          <p>
            All PDF processing occurs locally in your browser. We do not upload,
            store, access, or transmit your files. You retain full ownership and
            responsibility for your content.
          </p>
          <p>
            You are responsible for backing up your files and reviewing results
            before using compressed documents for important purposes.
          </p>

          <h2>5. Intellectual Property</h2>
          <p>
            The Service, including its design, code, and functionality, is owned
            by PDF Compress and protected by intellectual property laws. Your use
            of the Service does not grant you ownership rights to the Service
            itself.
          </p>

          <h2>6. Disclaimer of Warranties</h2>
          <p>
            THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTIES
            OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS
            FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </p>
          <p>
            We do not guarantee uninterrupted service, error-free operation, or
            specific compression outcomes.
          </p>

          <h2>7. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, PDF COMPRESS SHALL NOT BE
            LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, OR PUNITIVE
            DAMAGES, INCLUDING LOSS OF DATA, PROFITS, OR BUSINESS OPPORTUNITIES.
          </p>
          <p>
            Since the Service is provided free of charge and processes files
            locally, total liability for any claims shall not exceed $0 USD.
          </p>

          <h2>8. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless PDF Compress and its
            affiliates from claims arising from your use of the Service or
            violation of these Terms.
          </p>

          <h2>9. Service Availability</h2>
          <p>
            We do not guarantee uninterrupted availability. The Service may be
            modified, suspended, or discontinued at any time.
          </p>

          <h2>10. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. Continued use of the
            Service after changes constitutes acceptance of the revised Terms.
          </p>

          <h2>11. Governing Law</h2>
          <p>
            These Terms shall be governed by applicable laws, without regard to
            conflict of law principles.
          </p>

          <h2>12. Severability</h2>
          <p>
            If any provision of these Terms is found unenforceable, the remaining
            provisions shall remain in full force and effect.
          </p>

          <h2>13. Entire Agreement</h2>
          <p>
            These Terms, together with our Privacy Policy, constitute the entire
            agreement regarding use of the Service.
          </p>

          <h2>14. Contact</h2>
          <p>
            For questions about these Terms, contact us at:
          </p>
          <ul>
            <li>Email: legal@freecompresspdf.com</li>
          </ul>

          <hr className="my-12" />

          <p className="text-sm text-slate-500">
            Thank you for using PDF Compress. We aim to provide a useful, free
            service while respecting your rights and privacy.
          </p>
        </article>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <p>© {new Date().getFullYear()} PDF Compress. All rights reserved.</p>
          <nav className="flex gap-6">
            <Link href="/compress" className="hover:text-slate-900">
              Compress PDF
            </Link>
            <Link href="/privacy" className="hover:text-slate-900">
              Privacy Policy
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
