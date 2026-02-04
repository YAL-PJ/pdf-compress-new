'use client';

import { Shield, Zap, Lock } from 'lucide-react';

interface LandingHeroProps {
  children: React.ReactNode;
}

export function LandingHero({ children }: LandingHeroProps) {
  return (
    <section className="text-center mb-12">
      {/* Main Value Proposition */}
      <div className="max-w-3xl mx-auto mb-8">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-4">
          Compress PDFs Instantly
          <span className="block text-slate-500 text-2xl sm:text-3xl md:text-4xl mt-2">
            100% Free. 100% Private.
          </span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto">
          Reduce PDF file sizes by up to 90% without losing quality.
          Your files <strong className="text-slate-800">never leave your browser</strong>.
        </p>
      </div>

      {/* Trust Indicators */}
      <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mb-8 text-sm sm:text-base">
        <div className="flex items-center gap-2 text-slate-600">
          <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" aria-hidden="true" />
          <span>No uploads to servers</span>
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" aria-hidden="true" />
          <span>100% browser-based</span>
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" aria-hidden="true" />
          <span>24+ compression methods</span>
        </div>
      </div>

      {/* Upload Zone Slot */}
      {children}
    </section>
  );
}
