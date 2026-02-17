import Link from 'next/link';
import {
    Shield,
    Zap,
    FileDown,
    Lock,
    Settings,
    Layers,
} from 'lucide-react';
import { UploadZone } from '@/components/UploadZone';
import { BetaFeedbackBanner } from '@/components/BetaFeedbackBanner';
import { Footer } from '@/components/landing/Footer';
import { FAQSection } from '@/components/landing/FAQSection';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// This is a Server Component. It renders static HTML.
// Interactive parts (UploadZone, FeedbackBanner) are Client Components.

const features = [
    { icon: Shield, title: '100% Private', description: 'Your files never leave your browser.' },
    { icon: Zap, title: 'Lightning Fast', description: 'WebAssembly + Web Workers.' },
    { icon: FileDown, title: 'Compress PDF Online Free', description: 'Powerful optimization with 24+ methods.' },
    { icon: Settings, title: 'Full Control', description: 'Presets or fine-tuned settings.' },
    { icon: Layers, title: 'Page Management', description: 'Reorder, rotate, delete pages.' },
    { icon: Lock, title: 'No Sign-up Required', description: 'No accounts, no limits.' },
];

const steps = [
    { number: '1', title: 'Upload Your PDF', description: 'Drag, drop, or browse your file.' },
    { number: '2', title: 'Choose Compression Level', description: 'Quick presets or custom controls.' },
    { number: '3', title: 'Download Smaller PDF', description: 'Get fast results in seconds.' },
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
                    <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8 px-4">
                        {features.map(f => (
                            <div key={f.title} className="p-6 rounded-xl border">
                                <f.icon className="w-8 h-8 mb-3 text-blue-600" aria-hidden="true" />
                                <h3 className="font-bold text-slate-900">{f.title}</h3>
                                <p className="text-slate-700">{f.description}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* HOW IT WORKS */}
                <section className="py-24 bg-white border-t border-slate-200">
                    <div className="max-w-6xl mx-auto px-4">
                        <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">
                            How It Works
                        </h2>
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


                {/* SEO CONTENT */}
                <section className="py-20 bg-slate-50 border-t border-slate-200">
                    <div className="max-w-4xl mx-auto px-4">
                        <h2 className="text-3xl font-bold text-slate-900 mb-6 text-center">
                            Why Users Choose This Free PDF Compressor
                        </h2>
                        <div className="space-y-4 text-slate-700 leading-7">
                            <p>
                                Looking for a <strong>PDF compressor online</strong> that actually works? This tool is built for real-world files and delivers high-quality results while reducing file size quickly.
                            </p>
                            <p>
                                Unlike many basic tools, this <strong>free compress PDF</strong> workflow runs directly in your browser. That means faster processing, private handling, and no waiting for server uploads.
                            </p>
                            <p>
                                Whether you need to <strong>compress large PDF files</strong> for email, web upload, school, or business, you can choose presets or advanced controls to balance size and quality.
                            </p>
                            <p>
                                Built for transparent privacy: review our <Link href="/privacy" className="text-blue-700 hover:underline">Privacy Policy</Link> and <Link href="/terms" className="text-blue-700 hover:underline">Terms</Link> anytime.
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
