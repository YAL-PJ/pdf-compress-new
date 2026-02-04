'use client';

import { Upload, Settings, Download, CheckCircle2 } from 'lucide-react';

const steps = [
  {
    icon: Upload,
    step: '1',
    title: 'Upload Your PDF',
    description: 'Drag and drop your PDF file or click to browse. Files up to 100MB supported.',
  },
  {
    icon: Settings,
    step: '2',
    title: 'Choose Compression Level',
    description: 'Select a preset or customize individual settings for optimal results.',
  },
  {
    icon: CheckCircle2,
    step: '3',
    title: 'Preview Changes',
    description: 'See the estimated size reduction and preview pages before downloading.',
  },
  {
    icon: Download,
    step: '4',
    title: 'Download',
    description: 'Get your compressed PDF instantly. No sign-up or payment required.',
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-12 sm:py-16 bg-slate-50 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8" aria-labelledby="how-it-works-heading">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2
            id="how-it-works-heading"
            className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3"
          >
            How It Works
          </h2>
          <p className="text-slate-600">
            Compress your PDFs in four simple steps
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {steps.map((item, index) => (
            <div key={item.step} className="relative text-center">
              {/* Connector line for desktop */}
              {index < steps.length - 1 && (
                <div
                  className="hidden lg:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-slate-200"
                  aria-hidden="true"
                />
              )}

              {/* Step icon */}
              <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-white border-2 border-slate-900 mb-4 shadow-sm">
                <item.icon className="w-7 h-7 text-slate-800" aria-hidden="true" />
                <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
                  {item.step}
                </span>
              </div>

              <h3 className="font-semibold text-slate-900 mb-2">{item.title}</h3>
              <p className="text-sm text-slate-600">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
