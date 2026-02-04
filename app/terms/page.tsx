import Link from 'next/link';
import { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for PDF Compress. Read our terms and conditions for using the free PDF compression service.',
};

export default function TermsOfService() {
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
            Terms of Service
          </h1>
          <p className="text-slate-500 text-sm mb-8">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using PDF Compress at pdfcompress.app (the &ldquo;Service&rdquo;), you agree to be
            bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to these Terms, please
            do not use the Service.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            PDF Compress is a free web-based tool that compresses PDF files. The Service operates
            entirely within your web browser using client-side processing technology. Your files are
            processed locally on your device and are never uploaded to our servers.
          </p>

          <h2>3. Use of Service</h2>
          <h3>3.1 Permitted Use</h3>
          <p>You may use the Service for lawful purposes to compress PDF files that you own or have the right to modify.</p>

          <h3>3.2 Prohibited Use</h3>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service for any illegal purpose or in violation of any laws</li>
            <li>Process files that you do not have the right to access or modify</li>
            <li>Attempt to interfere with or disrupt the Service</li>
            <li>Attempt to reverse engineer, decompile, or disassemble the Service</li>
            <li>Use automated systems or software to access the Service in a manner that exceeds reasonable usage</li>
            <li>Remove or alter any proprietary notices from the Service</li>
          </ul>

          <h2>4. Your Files and Content</h2>
          <h3>4.1 Local Processing</h3>
          <p>
            Your PDF files are processed entirely within your browser. We do not upload, store,
            access, or transmit your files. You retain complete ownership and control of your
            content at all times.
          </p>

          <h3>4.2 Your Responsibility</h3>
          <p>
            You are solely responsible for:
          </p>
          <ul>
            <li>The content of files you process using the Service</li>
            <li>Ensuring you have the right to modify the files you process</li>
            <li>Backing up your original files before using the Service</li>
            <li>Reviewing compressed files before using them for important purposes</li>
          </ul>

          <h2>5. Intellectual Property</h2>
          <h3>5.1 Service Ownership</h3>
          <p>
            The Service, including its original content, features, and functionality, is owned by
            PDF Compress and is protected by international copyright, trademark, and other
            intellectual property laws.
          </p>

          <h3>5.2 Your Content</h3>
          <p>
            You retain all rights to your PDF files. Using the Service does not transfer any
            ownership rights to us.
          </p>

          <h2>6. Disclaimer of Warranties</h2>
          <p>
            THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND,
            EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
          </p>
          <ul>
            <li>IMPLIED WARRANTIES OF MERCHANTABILITY</li>
            <li>FITNESS FOR A PARTICULAR PURPOSE</li>
            <li>NON-INFRINGEMENT</li>
            <li>THAT THE SERVICE WILL BE UNINTERRUPTED OR ERROR-FREE</li>
          </ul>
          <p>
            We do not warrant that compression will be successful for all files or that output
            quality will meet your specific requirements. Different files may produce different
            results.
          </p>

          <h2>7. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL PDF COMPRESS, ITS DIRECTORS,
            EMPLOYEES, PARTNERS, AGENTS, SUPPLIERS, OR AFFILIATES BE LIABLE FOR:
          </p>
          <ul>
            <li>
              Any indirect, incidental, special, consequential, or punitive damages
            </li>
            <li>
              Loss of profits, data, use, goodwill, or other intangible losses
            </li>
            <li>
              Damages resulting from your use or inability to use the Service
            </li>
            <li>
              Any unauthorized access to or alteration of your files (which should not occur as
              files remain local)
            </li>
          </ul>
          <p>
            Since the Service is provided free of charge and processes files locally on your device,
            our total liability for any claims arising from these Terms or the Service shall not
            exceed $0 USD.
          </p>

          <h2>8. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless PDF Compress and its affiliates from any
            claims, losses, damages, liabilities, and expenses (including legal fees) arising from:
          </p>
          <ul>
            <li>Your use of the Service</li>
            <li>Your violation of these Terms</li>
            <li>Your violation of any rights of a third party</li>
            <li>Any content you process using the Service</li>
          </ul>

          <h2>9. Service Availability</h2>
          <p>
            We strive to maintain the Service but do not guarantee uninterrupted availability. We
            may:
          </p>
          <ul>
            <li>Modify or discontinue the Service at any time without notice</li>
            <li>Perform maintenance that may temporarily affect availability</li>
            <li>Update features and functionality</li>
          </ul>
          <p>
            Since the Service uses client-side processing, it may continue to work offline after
            initial loading, but updates require an internet connection.
          </p>

          <h2>10. Changes to Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. We will notify users of
            significant changes by posting the updated Terms on this page with a new &ldquo;Last updated&rdquo;
            date. Your continued use of the Service after changes constitutes acceptance of the
            modified Terms.
          </p>

          <h2>11. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the
            jurisdiction in which PDF Compress operates, without regard to its conflict of law
            provisions.
          </p>

          <h2>12. Severability</h2>
          <p>
            If any provision of these Terms is found to be unenforceable or invalid, that provision
            shall be limited or eliminated to the minimum extent necessary, and the remaining
            provisions shall remain in full force and effect.
          </p>

          <h2>13. Entire Agreement</h2>
          <p>
            These Terms, together with our Privacy Policy, constitute the entire agreement between
            you and PDF Compress regarding the Service and supersede any prior agreements.
          </p>

          <h2>14. Contact Information</h2>
          <p>For questions about these Terms, please contact us at:</p>
          <ul>
            <li>Email: legal@pdfcompress.app</li>
          </ul>

          <hr className="my-12" />

          <p className="text-sm text-slate-500">
            Thank you for using PDF Compress. We are committed to providing a useful, free service
            while respecting your privacy and rights.
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
              <Link href="/privacy" className="hover:text-slate-900 transition-colors">
                Privacy Policy
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </main>
  );
}
