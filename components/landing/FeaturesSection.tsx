'use client';

import {
  Image,
  FileText,
  Settings2,
  Layers,
  Download,
  Shield,
  Gauge,
  Move
} from 'lucide-react';

const features = [
  {
    icon: Shield,
    title: 'Privacy First',
    description: 'Your files never leave your device. All processing happens locally in your browser.',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  {
    icon: Settings2,
    title: '24+ Compression Methods',
    description: 'Fine-tune compression with advanced options: image optimization, metadata removal, and more.',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    icon: Image,
    title: 'Smart Image Optimization',
    description: 'Intelligently compress images while maintaining visual quality. Convert, downsample, or adjust quality.',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    icon: Layers,
    title: 'Page Management',
    description: 'Reorder, rotate, or remove pages with drag-and-drop. Full control over your PDF.',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
  {
    icon: FileText,
    title: 'Batch Processing',
    description: 'Compress multiple PDFs at once. Download individually or as a ZIP archive.',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
  },
  {
    icon: Gauge,
    title: 'Preset Profiles',
    description: 'Choose from optimized presets for quick compression, or customize every setting.',
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
  },
  {
    icon: Download,
    title: 'Instant Download',
    description: 'No waiting, no email required. Download your compressed PDF immediately.',
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
  },
  {
    icon: Move,
    title: 'Works Offline',
    description: 'Once loaded, the app works without internet. Perfect for sensitive documents.',
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
  },
];

export function FeaturesSection() {
  return (
    <section className="py-12 sm:py-16" aria-labelledby="features-heading">
      <div className="text-center mb-10">
        <h2
          id="features-heading"
          className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3"
        >
          Everything You Need to Compress PDFs
        </h2>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Professional-grade compression tools, completely free and private.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {features.map((feature) => (
          <article
            key={feature.title}
            className="bg-white rounded-lg border border-slate-200 p-5 hover:shadow-md transition-shadow"
          >
            <div className={`inline-flex p-2.5 rounded-lg ${feature.bgColor} mb-4`}>
              <feature.icon className={`w-5 h-5 ${feature.color}`} aria-hidden="true" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">{feature.title}</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{feature.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
