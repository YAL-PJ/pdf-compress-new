import Link from 'next/link';
import {
    Shield,
    Zap,
    FileDown,
    Lock,
    Settings,
    Layers,
    Mail,
    GraduationCap,
    Globe,
    Building2,
    CheckCircle2,
    XCircle,
} from 'lucide-react';
import { UploadZone } from '@/components/UploadZone';
import { BetaFeedbackBanner } from '@/components/BetaFeedbackBanner';
import { Footer } from '@/components/landing/Footer';
import { FAQSection } from '@/components/landing/FAQSection';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// This is a Server Component. It renders static HTML.
// Interactive parts (UploadZone, FeedbackBanner) are Client Components.

const features = [
    { icon: Shield, title: '100% Private', description: 'Your files never leave your browser. No server uploads, ever.' },
    { icon: Zap, title: 'Lightning Fast', description: 'Powered by WebAssembly and Web Workers for instant results.' },
    { icon: FileDown, title: 'Compress PDF Online Free', description: 'Powerful optimization with 24+ compression methods.' },
    { icon: Settings, title: 'Full Control', description: 'Quick presets or fine-tuned advanced settings.' },
    { icon: Layers, title: 'Page Management', description: 'Reorder, rotate, and delete pages before compressing.' },
    { icon: Lock, title: 'No Sign-up Required', description: 'No accounts, no limits, no watermarks.' },
];

const steps = [
    { number: '1', title: 'Upload Your PDF', description: 'Drag, drop, or browse your file.' },
    { number: '2', title: 'Choose Compression Level', description: 'Quick presets or custom controls.' },
    { number: '3', title: 'Download Smaller PDF', description: 'Get fast results in seconds.' },
];

const useCases = [
    {
        icon: Mail,
        title: 'Compress PDF for Email',
        description: 'Reduce PDF size to fit email attachment limits (10-25MB). Image-heavy PDFs often compress 50-90%, making them easy to send.',
    },
    {
        icon: Globe,
        title: 'Optimize PDF for Web',
        description: 'Make PDFs load faster on websites and portals. Smaller files mean better user experience and faster page loads.',
    },
    {
        icon: GraduationCap,
        title: 'Compress PDF for School',
        description: 'Meet university and course portal upload limits. Compress assignments, research papers, and presentations without quality loss.',
    },
    {
        icon: Building2,
        title: 'Reduce PDF for Business',
        description: 'Compress contracts, reports, and invoices for filing systems, CRM uploads, or government portals with strict size requirements.',
    },
];

const comparisonRows = [
    { feature: 'Completely free', us: true, others: false, note: 'No premium tier' },
    { feature: 'No file uploads to servers', us: true, others: false, note: 'Privacy by design' },
    { feature: 'No account required', us: true, others: false, note: 'Works instantly' },
    { feature: 'No watermark', us: true, others: false, note: 'Ever' },
    { feature: 'Batch compression', us: true, others: false, note: 'Unlimited files' },
    { feature: 'Advanced controls', us: true, others: false, note: '24+ methods' },
    { feature: 'Works offline', us: true, others: false, note: 'After page load' },
    { feature: 'Page management', us: true, others: false, note: 'Reorder, rotate, delete' },
];

export const LandingPage = () => {
    return (
        <ErrorBoundary>
            <main className="bg-slate-50 pt-10">
                <BetaFeedbackBanner />

                {/* HERO */}
                <section className="py-16 text-center max-w-6xl mx-auto px-4">
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
                        <Lock className="w-4 h-4" /> Files never leave your browser
                    </span>

                    <h1 className="mt-6 text-5xl font-extrabold text-slate-900">
                        Free <span className="text-blue-600">PDF Compressor Online</span>
                    </h1>

                    <p className="mt-6 text-xl text-slate-600 max-w-2xl mx-auto">
                        Compress PDF files online free with powerful local processing. Reduce PDF size quickly, keep quality high, and stay private with no server upload required.
                    </p>

                    <div className="mt-12 max-w-xl mx-auto">
                        {/* UploadZone is a Client Component that updates the context */}
                        <UploadZone />
                    </div>
                </section>

                {/* FEATURES */}
                <section className="py-24 bg-white">
                    <div className="max-w-6xl mx-auto px-4">
                        <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">
                            Everything You Need to Compress PDFs
                        </h2>
                        <div className="grid md:grid-cols-3 gap-8">
                            {features.map(f => (
                                <div key={f.title} className="p-6 rounded-xl border">
                                    <f.icon className="w-8 h-8 mb-3 text-blue-600" aria-hidden="true" />
                                    <h3 className="font-bold text-slate-900">{f.title}</h3>
                                    <p className="text-slate-700">{f.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* HOW IT WORKS */}
                <section className="py-24 bg-white border-t border-slate-200">
                    <div className="max-w-6xl mx-auto px-4">
                        <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">
                            How to Compress PDF Online Free
                        </h2>
                        <p className="text-center text-slate-600 mb-12 max-w-2xl mx-auto">
                            Reduce your PDF file size in three simple steps. No software to install, no account to create.
                        </p>
                        <div className="grid md:grid-cols-3 gap-8 text-center">
                            {steps.map(s => (
                                <div key={s.number}>
                                    <div className="w-12 h-12 rounded-full bg-slate-900 text-white mx-auto mb-4 flex items-center justify-center font-bold text-lg">
                                        {s.number}
                                    </div>
                                    <h3 className="font-bold text-slate-900 text-lg mb-2">{s.title}</h3>
                                    <p className="text-slate-600">{s.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* USE CASES */}
                <section className="py-20 bg-slate-50 border-t border-slate-200">
                    <div className="max-w-6xl mx-auto px-4">
                        <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">
                            Compress PDF for Any Purpose
                        </h2>
                        <p className="text-center text-slate-600 mb-12 max-w-2xl mx-auto">
                            Whether you need to reduce PDF size for email, web upload, school submissions, or business filing, this tool handles it all.
                        </p>
                        <div className="grid md:grid-cols-2 gap-8">
                            {useCases.map(uc => (
                                <div key={uc.title} className="p-6 rounded-xl border border-slate-200 bg-white">
                                    <uc.icon className="w-8 h-8 mb-3 text-blue-600" aria-hidden="true" />
                                    <h3 className="font-bold text-slate-900 text-lg mb-2">{uc.title}</h3>
                                    <p className="text-slate-600 leading-7">{uc.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* COMPARISON TABLE */}
                <section className="py-20 bg-white border-t border-slate-200">
                    <div className="max-w-4xl mx-auto px-4">
                        <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">
                            PDF Compress vs Other PDF Compressors
                        </h2>
                        <p className="text-center text-slate-600 mb-12 max-w-2xl mx-auto">
                            See how PDF Compress compares to alternatives like iLovePDF, SmallPDF, and Adobe Acrobat Online.
                        </p>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-slate-200">
                                        <th className="py-3 px-4 text-left text-slate-700 font-semibold">Feature</th>
                                        <th className="py-3 px-4 text-center text-blue-700 font-bold">PDF Compress</th>
                                        <th className="py-3 px-4 text-center text-slate-500 font-semibold">Others</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {comparisonRows.map(row => (
                                        <tr key={row.feature} className="border-b border-slate-100">
                                            <td className="py-3 px-4 text-slate-700">
                                                {row.feature}
                                                <span className="block text-xs text-slate-400">{row.note}</span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto" aria-label="Yes" />
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <XCircle className="w-5 h-5 text-slate-300 mx-auto" aria-label="No or limited" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                {/* SEO CONTENT */}
                <section className="py-20 bg-slate-50 border-t border-slate-200">
                    <div className="max-w-4xl mx-auto px-4">
                        <h2 className="text-3xl font-bold text-slate-900 mb-6 text-center">
                            Why Users Choose This Free PDF Compressor
                        </h2>
                        <div className="space-y-4 text-slate-700 leading-7">
                            <p>
                                Looking for a <strong>PDF compressor online</strong> that actually works? This tool is built for real-world files and delivers high-quality results while reducing file size quickly. Whether you have a 50MB scan or a 200MB presentation, the advanced compression engine handles it.
                            </p>
                            <p>
                                Unlike other online tools, this <strong>free PDF compressor</strong> runs entirely in your browser. That means faster processing, complete privacy, and no waiting for server uploads. Your files never leave your device.
                            </p>
                            <p>
                                Need to <strong>compress a large PDF for email</strong>? The balanced preset reduces most image-heavy PDFs by 50-70% while keeping text sharp and images clear. For maximum reduction, the aggressive preset can shrink files by up to 90%.
                            </p>
                            <p>
                                <strong>Batch PDF compression</strong> lets you process multiple files at once — upload everything, set your preferences, and download compressed files individually or as a ZIP. No per-file limits, no daily caps.
                            </p>
                            <p>
                                <strong>Scanned PDF documents</strong> benefit the most from compression. Since scans are essentially large images, the image optimization engine can dramatically reduce their size while maintaining readability.
                            </p>
                            <p>
                                Built for transparent privacy: review our <Link href="/privacy" className="text-blue-700 hover:underline">Privacy Policy</Link> and <Link href="/terms" className="text-blue-700 hover:underline">Terms</Link> anytime. Read our <Link href="/faq" className="text-blue-700 hover:underline">FAQ</Link> for answers to common questions about PDF compression.
                            </p>
                        </div>
                    </div>
                </section>

                <FAQSection />

                <Footer />
            </main>
        </ErrorBoundary>
    );
};
