import Link from 'next/link';
import { Metadata } from 'next';
import { ArrowLeft, Shield, Lock, Eye, Server } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy policy for PDF Compress. Learn how we protect your data by processing everything locally in your browser.',
};

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <article className="prose prose-slate max-w-none">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Privacy Policy
          </h1>
          <p className="text-slate-500 text-sm mb-8">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          {/* Key Points Summary */}
          <div className="not-prose grid sm:grid-cols-2 gap-4 mb-12">
            {[
              {
                icon: Lock,
                title: 'Files Stay Local',
                description: 'Your PDFs are processed entirely in your browser. They never leave your device.',
              },
              {
                icon: Server,
                title: 'No Server Processing',
                description: 'We have no servers that handle, store, or process your files.',
              },
              {
                icon: Eye,
                title: 'No File Access',
                description: 'We cannot see, access, or retrieve any files you compress.',
              },
              {
                icon: Shield,
                title: 'Privacy by Design',
                description: 'Our architecture makes it technically impossible to access your data.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="p-4 bg-white rounded-lg border border-slate-200"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <item.icon className="w-4 h-4 text-emerald-700" />
                  </div>
                  <h3 className="font-semibold text-slate-900">{item.title}</h3>
                </div>
                <p className="text-sm text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>

          <h2>Introduction</h2>
          <p>
            PDF Compress (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is committed to protecting your privacy.
            This Privacy Policy explains how we handle information when you use our PDF compression
            service at pdfcompress.app (the &ldquo;Service&rdquo;).
          </p>
          <p>
            <strong>The key thing to know:</strong> Your PDF files are processed entirely within your
            web browser. They are never uploaded to our servers. We cannot access, view, or store
            your files.
          </p>

          <h2>How Our Service Works</h2>
          <p>
            PDF Compress uses client-side processing technology. This means:
          </p>
          <ul>
            <li>
              <strong>All compression happens in your browser</strong> using JavaScript and
              WebAssembly technology
            </li>
            <li>
              <strong>Your files never leave your device</strong> - there is no file upload to any
              server
            </li>
            <li>
              <strong>We have no technical ability</strong> to access, read, or store your PDF
              content
            </li>
            <li>
              <strong>Processing occurs entirely locally</strong> on your computer, phone, or tablet
            </li>
          </ul>
          <p>
            You can verify this yourself by checking your browser&apos;s Network tab in Developer
            Tools while using the service - you will see no file data being transmitted.
          </p>

          <h2>Information We Collect</h2>

          <h3>Information We DO NOT Collect</h3>
          <ul>
            <li>Your PDF files or their contents</li>
            <li>Document metadata (titles, authors, etc.)</li>
            <li>Any text, images, or data within your PDFs</li>
            <li>Personal information from your documents</li>
          </ul>

          <h3>Information We May Collect</h3>
          <p>
            We may collect limited, anonymized information to improve our service:
          </p>
          <ul>
            <li>
              <strong>Analytics data</strong> (if enabled): Page views, feature usage, and
              anonymized events to understand how the service is used. We use{' '}
              <a href="https://plausible.io" target="_blank" rel="noopener noreferrer">
                Plausible Analytics
              </a>
              , a privacy-focused analytics tool that does not use cookies and does not track
              individuals.
            </li>
            <li>
              <strong>Error reports</strong>: If the application crashes, we may collect technical
              error information (stack traces, browser version) to fix bugs. This never includes
              your file content.
            </li>
            <li>
              <strong>Technical metadata</strong>: Browser type, operating system, and screen size
              to ensure compatibility.
            </li>
          </ul>

          <h2>Cookies and Tracking</h2>
          <p>
            PDF Compress does not use tracking cookies. We do not track you across websites or build
            advertising profiles.
          </p>
          <p>
            If you enable analytics, Plausible Analytics collects data without cookies or personal
            identifiers. You can opt out by using a browser extension that blocks analytics scripts.
          </p>

          <h2>Data Storage</h2>
          <p>
            Since your files are processed locally, we have no file storage infrastructure. Your
            PDFs exist only:
          </p>
          <ul>
            <li>On your device</li>
            <li>In your browser&apos;s memory during processing</li>
            <li>In your downloads folder after you save the compressed file</li>
          </ul>
          <p>
            When you close the browser tab or navigate away, any temporary data in browser memory is
            automatically cleared.
          </p>

          <h2>Third-Party Services</h2>
          <p>We may use the following third-party services:</p>
          <ul>
            <li>
              <strong>Plausible Analytics</strong>: Privacy-focused web analytics (no cookies, no
              personal data)
            </li>
            <li>
              <strong>Sentry</strong>: Error tracking for application bugs (no file content
              collected)
            </li>
            <li>
              <strong>Vercel/Netlify</strong>: Website hosting (only serves static files)
            </li>
          </ul>

          <h2>Your Rights</h2>
          <p>Because we don&apos;t collect personal data from your files, there is no personal data for us to:</p>
          <ul>
            <li>Delete (we don&apos;t have it)</li>
            <li>Export (we don&apos;t have it)</li>
            <li>Correct (we don&apos;t have it)</li>
          </ul>
          <p>
            If you have questions about any analytics data, please contact us and we will assist you.
          </p>

          <h2>Children&apos;s Privacy</h2>
          <p>
            Our Service is not directed to children under 13. We do not knowingly collect personal
            information from children under 13.
          </p>

          <h2>Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any changes
            by posting the new Privacy Policy on this page and updating the &ldquo;Last updated&rdquo; date.
          </p>

          <h2>Contact Us</h2>
          <p>If you have questions about this Privacy Policy, please contact us at:</p>
          <ul>
            <li>Email: privacy@pdfcompress.app</li>
          </ul>

          <hr className="my-12" />

          <p className="text-sm text-slate-500">
            This privacy policy is designed to be transparent about our privacy-first approach. The
            technical architecture of PDF Compress ensures that your files remain private by default
            - not through policy, but through design.
          </p>
        </article>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
            <p>&copy; {new Date().getFullYear()} PDF Compress. All rights reserved.</p>
            <nav className="flex gap-6">
              <Link href="/compress" className="hover:text-slate-900 transition-colors">
                Compress PDF
              </Link>
              <Link href="/terms" className="hover:text-slate-900 transition-colors">
                Terms of Service
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </main>
  );
}
