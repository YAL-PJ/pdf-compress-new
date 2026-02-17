import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/LandingPage';
import { AppShell } from '@/components/AppShell';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.freecompresspdf.com';

export const metadata: Metadata = {
  title: 'PDF Compressor Online Free - Compress PDF with Secure Local Processing',
  description:
    'Use our free PDF compressor online to reduce PDF size fast. Compress large PDF files in your browser with no server upload, no sign-up, and advanced quality controls.',
  alternates: {
    canonical: '/',
  },
};

const pageJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      name: 'Free PDF Compressor Online',
      url: siteUrl,
      description:
        'Compress PDF files online free with secure local processing and no server upload required.',
      isPartOf: {
        '@type': 'WebSite',
        name: 'PDF Compress',
        url: siteUrl,
      },
      about: ['PDF compression', 'Reduce PDF size', 'Batch PDF compression'],
      inLanguage: 'en-US',
    },
    {
      '@type': 'HowTo',
      name: 'How to compress PDF online for free',
      description:
        'Select a PDF, choose compression settings, and download a smaller file in seconds.',
      totalTime: 'PT1M',
      step: [
        {
          '@type': 'HowToStep',
          name: 'Upload your PDF',
          text: 'Drag and drop your file or browse from your device.',
        },
        {
          '@type': 'HowToStep',
          name: 'Choose compression level',
          text: 'Use presets or advanced controls to optimize quality and size.',
        },
        {
          '@type': 'HowToStep',
          name: 'Download smaller PDF',
          text: 'Save the optimized file after processing completes.',
        },
      ],
    },
  ],
};

// This is now a Server Component
// The initial HTML will be fully rendered on the server (SSR/SSG).
// AppShell (Client Component) wraps it to handle the dynamic state switch to the App view.

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd) }}
      />
      <AppShell>
        <LandingPage />
      </AppShell>
    </>
  );
}
