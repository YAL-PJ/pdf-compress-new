import type { Metadata } from "next";
import { AnalyticsScript } from "@/components";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pdfcompress.app';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "PDF Compress - Free Online PDF Compressor | No Upload Required",
    template: "%s | PDF Compress",
  },
  description: "Compress PDFs locally in your browser. Privacy-first: your files never leave your device. 24+ compression methods, instant results, completely free.",
  keywords: [
    "PDF compression",
    "PDF compressor",
    "reduce PDF size",
    "compress PDF online",
    "free PDF tool",
    "PDF optimizer",
    "shrink PDF",
    "PDF size reducer",
    "browser PDF compression",
    "private PDF compressor",
  ],
  authors: [{ name: "PDF Compress" }],
  creator: "PDF Compress",
  publisher: "PDF Compress",
  formatDetection: {
    email: false,
    telephone: false,
  },
  openGraph: {
    title: "PDF Compress - Free Online PDF Compressor",
    description: "Compress PDFs locally in your browser. Privacy-first: your files never leave your device. 24+ methods available.",
    type: "website",
    url: siteUrl,
    siteName: "PDF Compress",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PDF Compress - Free Online PDF Compressor",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PDF Compress - Free Online PDF Compressor",
    description: "Compress PDFs locally in your browser. Privacy-first: your files never leave your device.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
  category: "technology",
};

// JSON-LD structured data
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "PDF Compress",
  description: "Free online PDF compressor that runs entirely in your browser. Privacy-first: your files never leave your device.",
  url: siteUrl,
  applicationCategory: "UtilityApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "24+ compression methods",
    "Browser-based processing",
    "No file uploads required",
    "Batch processing",
    "Page management",
    "Visual quality comparison",
  ],
  browserRequirements: "Requires JavaScript. Works in Chrome, Firefox, Safari, Edge.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* JSON-LD structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased">
        {/* Skip link for accessibility - allows keyboard users to skip navigation */}
        <a
          href="#main-content"
          className="skip-link"
        >
          Skip to main content
        </a>

        {children}

        {/* Privacy-friendly analytics (Plausible) */}
        <AnalyticsScript />
      </body>
    </html>
  );
}
