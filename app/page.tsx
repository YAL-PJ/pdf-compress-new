import Link from 'next/link';
import {
  Shield,
  Zap,
  FileDown,
  Lock,
  Settings,
  Layers,
  ArrowRight,
  Check,
  ChevronDown,
} from 'lucide-react';

// Feature data
const features = [
  {
    icon: Shield,
    title: '100% Private',
    description:
      'Your files never leave your browser. All compression happens locally on your device.',
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description:
      'Powered by WebAssembly and Web Workers for maximum speed without server delays.',
  },
  {
    icon: FileDown,
    title: 'Up to 90% Smaller',
    description:
      '24+ compression methods work together to achieve maximum file size reduction.',
  },
  {
    icon: Settings,
    title: 'Full Control',
    description:
      'Choose from presets or fine-tune individual compression settings for optimal results.',
  },
  {
    icon: Layers,
    title: 'Page Management',
    description:
      'Reorder, rotate, or delete pages. Full control over your document structure.',
  },
  {
    icon: Lock,
    title: 'No Sign-up Required',
    description:
      'Start compressing immediately. No accounts, no watermarks, no limits.',
  },
];

// How it works steps
const steps = [
  {
    number: '1',
    title: 'Upload Your PDF',
    description: 'Drag and drop your file or click to browse. Supports files up to 100MB.',
  },
  {
    number: '2',
    title: 'Choose Compression',
    description: 'Pick a preset (Recommended, Maximum) or customize individual methods.',
  },
  {
    number: '3',
    title: 'Download Result',
    description: 'Preview the compressed file and download instantly. No waiting.',
  },
];

// FAQ data
const faqs = [
  {
    question: 'Is my PDF data secure?',
    answer:
      'Yes, completely. Your files never leave your browser. All compression is performed locally using JavaScript and WebAssembly. We have no servers that process or store your files. This is verifiable by checking your browser\'s network tab.',
  },
  {
    question: 'What compression methods are available?',
    answer:
      'We offer 24+ compression methods including: image quality optimization, resolution downsampling, metadata removal, structure optimization, content stream compression, duplicate resource elimination, and more. You can enable or disable each method individually.',
  },
  {
    question: 'Is there a file size limit?',
    answer:
      'We recommend files up to 100MB for optimal performance. Larger files will work but may take longer to process depending on your device. Since processing happens in your browser, performance scales with your device capabilities.',
  },
  {
    question: 'Will compression reduce quality?',
    answer:
      'It depends on your settings. Our "Recommended" preset balances size reduction with quality preservation. The "Maximum" preset prioritizes smallest file size. You can also customize individual settings like image quality (1-100) to find your perfect balance.',
  },
  {
    question: 'Can I compress multiple PDFs at once?',
    answer:
      'Yes! Switch to Batch Mode to upload and compress multiple files at once. You can download them individually or as a single ZIP archive.',
  },
  {
    question: 'Does it work on mobile devices?',
    answer:
      'Yes, PDF Compress works on all modern devices including smartphones and tablets. The interface is fully responsive and touch-friendly.',
  },
  {
    question: 'Why is this free?',
    answer:
      'We believe everyone should have access to quality PDF tools without paying subscription fees. By processing locally, we have no server costs for file processing. We may add optional premium features in the future, but core compression will always be free.',
  },
  {
    question: 'How does this compare to other PDF compressors?',
    answer:
      'Unlike most online tools, we never upload your files to a server. This means: better privacy, faster processing (no upload/download time), no file size limits imposed by servers, and works offline once loaded. We also offer more granular control over compression settings.',
  },
];

// Comparison data
const comparisons = [
  { feature: 'Files stay on your device', us: true, others: false },
  { feature: 'No account required', us: true, others: false },
  { feature: 'No file size limits', us: true, others: false },
  { feature: 'Works offline', us: true, others: false },
  { feature: 'Batch processing', us: true, others: true },
  { feature: 'Page management', us: true, others: true },
  { feature: '24+ compression methods', us: true, others: false },
  { feature: 'Completely free', us: true, others: false },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background grid */}
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f080_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f080_1px,transparent_1px)] bg-[size:24px_24px]"
          aria-hidden="true"
        />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-20 sm:pb-32">
          {/* Badge */}
          <div className="flex justify-center mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
              <Lock className="w-4 h-4" />
              Your files never leave your browser
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-center tracking-tight text-slate-900 max-w-4xl mx-auto">
            Compress PDFs{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
              Without Uploading
            </span>{' '}
            to Any Server
          </h1>

          {/* Subheadline */}
          <p className="mt-6 text-lg sm:text-xl text-slate-600 text-center max-w-2xl mx-auto">
            Professional PDF compression that runs entirely in your browser.
            24+ methods, instant results, complete privacy. No sign-up required.
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/compress"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg bg-slate-900 text-white font-bold text-lg hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              Start Compressing
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg border-2 border-slate-200 text-slate-700 font-semibold text-lg hover:bg-slate-100 transition-colors"
            >
              See How It Works
              <ChevronDown className="w-5 h-5" />
            </a>
          </div>

          {/* Trust indicators */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-500" />
              <span>No server uploads</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-500" />
              <span>No registration</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-500" />
              <span>No watermarks</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-500" />
              <span>100% free</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 sm:py-28 bg-white" id="features">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Why Choose PDF Compress?
            </h2>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              Built for privacy, speed, and quality. Everything you need to compress PDFs effectively.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-6 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all"
              >
                <div className="w-12 h-12 rounded-lg bg-slate-900 text-white flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-slate-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 sm:py-28 bg-slate-50" id="how-it-works">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              How It Works
            </h2>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              Compress your PDFs in three simple steps. No learning curve required.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {steps.map((step, index) => (
              <div key={step.number} className="relative">
                {/* Connector line (hidden on mobile, shown between steps) */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-full h-0.5 bg-slate-200" />
                )}

                <div className="relative flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-900 text-white flex items-center justify-center text-2xl font-bold mb-4 relative z-10">
                    {step.number}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{step.title}</h3>
                  <p className="text-slate-600">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/compress"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-slate-900 text-white font-bold text-lg hover:bg-slate-800 transition-all"
            >
              Try It Now - Free
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-20 sm:py-28 bg-white" id="comparison">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              PDF Compress vs. Others
            </h2>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              See how we compare to typical online PDF compressors.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">
                    Feature
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-slate-900">
                    PDF Compress
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-slate-500">
                    Others
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {comparisons.map((row) => (
                  <tr key={row.feature} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-700">{row.feature}</td>
                    <td className="px-6 py-4 text-center">
                      {row.us ? (
                        <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {row.others ? (
                        <Check className="w-5 h-5 text-slate-400 mx-auto" />
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 sm:py-28 bg-slate-50" id="faq">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Frequently Asked Questions
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Everything you need to know about PDF Compress.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <details
                key={index}
                className="group rounded-lg bg-white border border-slate-200 overflow-hidden"
              >
                <summary className="flex items-center justify-between cursor-pointer px-6 py-4 text-left font-semibold text-slate-900 hover:bg-slate-50">
                  {faq.question}
                  <ChevronDown className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-6 pb-4 text-slate-600">{faq.answer}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 sm:py-28 bg-slate-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Compress Your PDFs?
          </h2>
          <p className="text-lg text-slate-300 mb-8 max-w-2xl mx-auto">
            Join thousands of users who trust PDF Compress for secure, fast, and effective PDF compression.
          </p>
          <Link
            href="/compress"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-white text-slate-900 font-bold text-lg hover:bg-slate-100 transition-all"
          >
            Start Compressing - It&apos;s Free
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-slate-950 text-slate-400">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2 text-white font-bold text-lg">
              <span>PDF Compress</span>
            </div>

            <nav className="flex flex-wrap items-center justify-center gap-6 text-sm">
              <Link href="/compress" className="hover:text-white transition-colors">
                Compress PDF
              </Link>
              <Link href="/privacy" className="hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-white transition-colors">
                Terms of Service
              </Link>
              <a href="#faq" className="hover:text-white transition-colors">
                FAQ
              </a>
            </nav>

            <p className="text-sm">
              &copy; {new Date().getFullYear()} PDF Compress. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
