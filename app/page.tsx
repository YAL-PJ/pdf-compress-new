import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/LandingPage';
import { AppShell } from '@/components/AppShell';
import { seoFaqs } from '@/lib/seo';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.freecompresspdf.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Free PDF Compressor Online - Compress PDF Files Fast & Privately',
  description:
    'Compress PDF online free with our browser-based tool. Reduce PDF file size by up to 90% with no server upload, no sign-up, and no watermark. Batch compression, advanced controls, and 100% privacy.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: '/',
    title: 'Free PDF Compressor Online - No Upload, No Sign-up',
    description:
      'Compress PDF files online free with secure local processing. Reduce PDF size by up to 90% with no server upload required. Batch compression and advanced quality controls.',
    siteName: 'PDF Compress',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free PDF Compressor Online - 100% Private',
    description:
      'Compress PDF files online free in your browser. No server upload, no sign-up, no watermark. Advanced controls with 24+ compression methods.',
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
        'Compress PDF files online free with secure local processing and no server upload required. Reduce PDF size by up to 90%.',
      isPartOf: {
        '@type': 'WebSite',
        name: 'PDF Compress',
        url: siteUrl,
      },
      about: [
        'PDF compression',
        'Reduce PDF size',
        'Batch PDF compression',
        'Compress PDF for email',
        'Online PDF optimizer',
      ],
      inLanguage: 'en-US',
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: siteUrl,
          },
        ],
      },
    },
    {
      '@type': 'HowTo',
      name: 'How to Compress PDF Online for Free',
      description:
        'Learn how to reduce PDF file size for free using browser-based compression. No software needed.',
      totalTime: 'PT1M',
      tool: {
        '@type': 'HowToTool',
        name: 'PDF Compress (freecompresspdf.com)',
      },
      step: [
        {
          '@type': 'HowToStep',
          position: 1,
          name: 'Upload your PDF',
          text: 'Drag and drop your PDF file or click to browse from your device. Files up to 200MB are supported.',
          url: `${siteUrl}/#upload`,
        },
        {
          '@type': 'HowToStep',
          position: 2,
          name: 'Choose compression level',
          text: 'Select a preset like Light, Balanced, or Aggressive. Or use advanced controls to fine-tune image quality, DPI, and metadata removal.',
          url: `${siteUrl}/#settings`,
        },
        {
          '@type': 'HowToStep',
          position: 3,
          name: 'Download your smaller PDF',
          text: 'Click download to save your compressed PDF. The file is processed entirely in your browser — nothing is uploaded to any server.',
          url: `${siteUrl}/#download`,
        },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: seoFaqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
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
