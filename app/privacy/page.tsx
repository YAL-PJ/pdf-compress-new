import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy policy for PDF Compress. Learn how we protect your data and privacy.',
};

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back to app */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to PDF Compress
        </Link>

        <article className="prose prose-slate max-w-none">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
          <p className="text-slate-500 mb-8">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Our Commitment to Privacy</h2>
            <p className="text-slate-600 mb-4">
              PDF Compress is built with privacy as a core principle. Unlike other PDF compression services,
              <strong> your files never leave your device</strong>. All compression happens entirely in your web browser
              using client-side processing.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">How It Works</h2>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-green-800 font-medium mb-2">Your files are processed locally</p>
              <p className="text-green-700 text-sm">
                When you upload a PDF to PDF Compress, it is processed entirely within your web browser
                using JavaScript and Web Workers. Your files are never uploaded to any server.
              </p>
            </div>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Files are loaded into your browser&apos;s memory</li>
              <li>Compression algorithms run locally on your device</li>
              <li>Compressed files are downloaded directly from your browser</li>
              <li>No server-side processing occurs</li>
              <li>No files are stored anywhere after you close the page</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Data We Collect</h2>

            <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">Analytics (Optional)</h3>
            <p className="text-slate-600 mb-4">
              We use Plausible Analytics, a privacy-friendly analytics service that does not use cookies
              and does not collect personal data. If enabled, we collect:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Page views (which pages are visited)</li>
              <li>Referrer information (how you found us)</li>
              <li>Browser type and device type (aggregated, not personal)</li>
              <li>Country-level location (based on IP, not stored)</li>
            </ul>
            <p className="text-slate-600 mt-4">
              <strong>We do not collect:</strong> Your IP address (it is not stored), personal information,
              file names, file contents, or any identifiable data.
            </p>

            <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">Error Tracking</h3>
            <p className="text-slate-600 mb-4">
              We use Sentry for error tracking to improve our service. When an error occurs, we may collect:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Error messages and stack traces</li>
              <li>Browser and device information</li>
              <li>The actions that led to the error</li>
            </ul>
            <p className="text-slate-600 mt-4">
              <strong>We never collect:</strong> File contents, file names, or any personal documents.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Cookies</h2>
            <p className="text-slate-600 mb-4">
              PDF Compress uses minimal cookies:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li><strong>Essential cookies:</strong> May be used to remember your preferences (e.g., cookie consent)</li>
              <li><strong>No tracking cookies:</strong> We do not use cookies for tracking or advertising</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Third-Party Services</h2>
            <p className="text-slate-600 mb-4">We use the following third-party services:</p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li><strong>Plausible Analytics:</strong> Privacy-friendly website analytics (<a href="https://plausible.io/privacy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">their privacy policy</a>)</li>
              <li><strong>Sentry:</strong> Error tracking and monitoring (<a href="https://sentry.io/privacy/" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">their privacy policy</a>)</li>
              <li><strong>Vercel/Netlify:</strong> Website hosting (<a href="https://vercel.com/legal/privacy-policy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Vercel privacy policy</a>)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Your Rights</h2>
            <p className="text-slate-600 mb-4">
              Since we don&apos;t collect personal data beyond basic analytics, there is minimal data to manage. However, you have the right to:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Use the service without enabling analytics (disable JavaScript for analytics)</li>
              <li>Request information about what data we have (though it&apos;s minimal)</li>
              <li>Use browser privacy features to limit data collection</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Data Security</h2>
            <p className="text-slate-600 mb-4">
              Your PDF files are never transmitted over the internet when using our compression tool.
              This eliminates the risk of interception or server-side data breaches for your documents.
            </p>
            <p className="text-slate-600">
              The website itself is served over HTTPS to ensure secure delivery of the application code.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Children&apos;s Privacy</h2>
            <p className="text-slate-600">
              Our service is not directed at children under 13. We do not knowingly collect personal
              information from children.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Changes to This Policy</h2>
            <p className="text-slate-600">
              We may update this privacy policy from time to time. We will notify users of any material
              changes by updating the &quot;Last updated&quot; date at the top of this page.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Contact Us</h2>
            <p className="text-slate-600">
              If you have questions about this privacy policy, please contact us through our website.
            </p>
          </section>
        </article>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-slate-200 text-center text-sm text-slate-500">
          <p>© {new Date().getFullYear()} PDF Compress. All rights reserved.</p>
          <div className="mt-4 space-x-4">
            <Link href="/" className="text-slate-600 hover:text-slate-900">Home</Link>
            <Link href="/terms" className="text-slate-600 hover:text-slate-900">Terms of Service</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
