import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of service for PDF Compress. Understand your rights and responsibilities.',
};

export default function TermsOfService() {
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
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms of Service</h1>
          <p className="text-slate-500 mb-8">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">1. Acceptance of Terms</h2>
            <p className="text-slate-600 mb-4">
              By accessing and using PDF Compress (&quot;the Service&quot;), you agree to be bound by these
              Terms of Service. If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">2. Description of Service</h2>
            <p className="text-slate-600 mb-4">
              PDF Compress is a free, browser-based tool that allows users to compress PDF files.
              Key characteristics of the Service:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>All file processing occurs locally in your web browser</li>
              <li>No files are uploaded to any server</li>
              <li>The Service is provided free of charge</li>
              <li>The Service requires a modern web browser with JavaScript enabled</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">3. User Responsibilities</h2>
            <p className="text-slate-600 mb-4">When using the Service, you agree to:</p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Use the Service only for lawful purposes</li>
              <li>Not use the Service to process files you do not have the right to modify</li>
              <li>Not attempt to reverse engineer, decompile, or disassemble the Service</li>
              <li>Not use the Service to distribute malware or malicious content</li>
              <li>Not interfere with or disrupt the Service or its infrastructure</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">4. Intellectual Property</h2>
            <p className="text-slate-600 mb-4">
              <strong>Your Content:</strong> You retain all rights to your PDF files. We do not claim
              any ownership over files you process using the Service.
            </p>
            <p className="text-slate-600">
              <strong>Our Service:</strong> The Service, including its design, code, and documentation,
              is protected by intellectual property laws. You may not copy, modify, or distribute our
              Service without permission.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">5. Disclaimer of Warranties</h2>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <p className="text-amber-800 font-medium">Important Notice</p>
              <p className="text-amber-700 text-sm mt-2">
                THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND,
                EITHER EXPRESS OR IMPLIED.
              </p>
            </div>
            <p className="text-slate-600 mb-4">We do not warrant that:</p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>The Service will be uninterrupted or error-free</li>
              <li>The compression will meet your specific requirements</li>
              <li>The quality of compressed files will be satisfactory for all use cases</li>
              <li>Any errors in the Service will be corrected</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">6. Limitation of Liability</h2>
            <p className="text-slate-600 mb-4">
              To the maximum extent permitted by law, we shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages, including but not limited to:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Loss of data or file corruption</li>
              <li>Loss of profits or business opportunities</li>
              <li>Damage to your device or software</li>
              <li>Any other damages arising from use of the Service</li>
            </ul>
            <p className="text-slate-600 mt-4">
              <strong>Recommendation:</strong> Always keep backup copies of your original files before
              using any compression tool.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">7. Service Availability</h2>
            <p className="text-slate-600 mb-4">
              We strive to maintain the Service&apos;s availability but do not guarantee uninterrupted access.
              We reserve the right to:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Modify or discontinue the Service at any time</li>
              <li>Perform maintenance that may temporarily affect availability</li>
              <li>Limit or restrict access to the Service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">8. Changes to Terms</h2>
            <p className="text-slate-600">
              We may update these Terms of Service from time to time. Continued use of the Service
              after changes are posted constitutes acceptance of the new terms. We encourage you to
              review these terms periodically.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">9. Governing Law</h2>
            <p className="text-slate-600">
              These terms shall be governed by and construed in accordance with applicable laws,
              without regard to conflict of law principles.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">10. Severability</h2>
            <p className="text-slate-600">
              If any provision of these terms is found to be unenforceable, the remaining provisions
              will continue in full force and effect.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">11. Contact</h2>
            <p className="text-slate-600">
              If you have questions about these Terms of Service, please contact us through our website.
            </p>
          </section>
        </article>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-slate-200 text-center text-sm text-slate-500">
          <p>© {new Date().getFullYear()} PDF Compress. All rights reserved.</p>
          <div className="mt-4 space-x-4">
            <Link href="/" className="text-slate-600 hover:text-slate-900">Home</Link>
            <Link href="/privacy" className="text-slate-600 hover:text-slate-900">Privacy Policy</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
