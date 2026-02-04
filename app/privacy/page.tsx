import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Shield, Lock, Eye, Server } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Privacy policy for PDF Compress. Learn how we protect your privacy by processing PDFs locally in your browser with no server uploads.',
};

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
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
            Privacy Policy
          </h1>

          <p className="text-slate-500 text-sm mb-8">
            Last updated:{' '}
            {new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>

          {/* Key Points Summary */}
          <div className="not-prose grid sm:grid-cols-2 gap-4 mb-12">
            {[
              {
                icon: Lock,
                title: 'Files Stay Local',
                description:
                  'Your PDFs are processed entirely in your browser. They never leave your device.',
              },
              {
                icon: Server,
                title: 'No Server Processing',
                description:
                  'We have no servers that handle, store, or process your files.',
              },
              {
                icon: Eye,
                title: 'No File Access',
                description:
                  'We cannot see, access, or retrieve any files you compress.',
              },
              {
                icon: Shield,
                title: 'Privacy by Design',
                description:
                  'Our architecture makes it technically impossible to access your data.',
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
                  <h3 className="font-semibold text-slate-900">
                    {item.title}
                  </h3>
                </div>
                <p className="text-sm text-slate-600">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          <h2>Our Commitment to Privacy</h2>
          <p>
            PDF Compress is built with privacy as a core principle. Unlike most
            online PDF tools, <strong>your files never leave your device</strong>.
            All compression happens entirely within your web browser using
            client-side processing.
          </p>

          <h2>How the Service Works</h2>
          <ul>
            <li>Files are loaded into your browser&apos;s memory</li>
            <li>Compression algorithms run locally using JavaScript and WebAssembly</li>
            <li>No uploads to any server occur</li>
            <li>Compressed files are downloaded directly from your browser</li>
            <li>No files are stored after you close the page</li>
          </ul>

          <p>
            You can verify this yourself by opening your browser&apos;s Network
            tab while using the service — you will see no file data transmitted.
          </p>

          <h2>Information We Collect</h2>

          <h3>Information We Do Not Collect</h3>
          <ul>
            <li>Your PDF files or their contents</li>
            <li>Document metadata or file names</li>
            <li>Personal or identifiable information from documents</li>
          </ul>

          <h3>Limited Information We May Collect</h3>
          <ul>
            <li>
              <strong>Analytics:</strong> Aggregated page views and feature usage
              via{' '}
              <a
                href="https://analytics.google.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Analytics
              </a>
              . This helps us understand how users interact with our site.
            </li>
            <li>
              <strong>Error reports:</strong> Technical error data (e.g. browser
              type, stack traces) to fix bugs. No file data is included.
            </li>
          </ul>

          <h2>Cookies</h2>
          <p>
            PDF Compress uses cookies for analytics purposes via Google Analytics.
            These cookies help us understand how visitors use our site. We do not
            use advertising or tracking cookies beyond basic analytics.
          </p>

          <h2>Third-Party Services</h2>
          <ul>
            <li>
              <strong>Google Analytics</strong> – website analytics
            </li>
            <li>
              <strong>Sentry</strong> – error tracking (no file data)
            </li>
            <li>
              <strong>Vercel / Netlify</strong> – static hosting only
            </li>
          </ul>

          <h2>Your Rights</h2>
          <p>
            Because your documents are never collected or stored, there is no
            personal file data for us to delete, export, or correct.
          </p>

          <h2>Children&apos;s Privacy</h2>
          <p>
            Our service is not directed to children under 13, and we do not
            knowingly collect personal information from children.
          </p>

          <h2>Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Changes will be
            reflected on this page with an updated revision date.
          </p>

          <h2>Contact</h2>
          <p>
            If you have questions about this Privacy Policy, you can contact us
            at:
          </p>
          <ul>
            <li>Email: privacy@freecompresspdf.com</li>
          </ul>

          <hr className="my-12" />

          <p className="text-sm text-slate-500">
            PDF Compress protects your privacy by design — not just by policy.
            Our architecture ensures your files remain yours, always.
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
            <Link href="/terms" className="hover:text-slate-900">
              Terms of Service
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
