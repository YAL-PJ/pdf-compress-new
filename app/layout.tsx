import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { AnalyticsScript } from "@/components";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.freecompresspdf.com";

/* =========================
   VIEWPORT
========================= */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

/* =========================
   METADATA (SEO)
========================= */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: "PDF Compress - Free Online PDF Compressor | No Upload Required",
    template: "%s | PDF Compress",
  },

  description:
    "Compress PDFs instantly in your browser. 100% free and privacy-first — your files never leave your device. 24+ compression methods, batch processing, and page management.",

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
    "private PDF compression",
    "batch PDF compression",
  ],

  authors: [{ name: "PDF Compress" }],
  creator: "PDF Compress",
  publisher: "PDF Compress",

  formatDetection: {
    email: false,
    telephone: false,
  },

  alternates: {
    canonical: siteUrl,
  },

  openGraph: {
    title: "PDF Compress - Free Online PDF Compressor",
    description:
      "Compress PDFs instantly in your browser. 100% free and privacy-first — your files never leave your device.",
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
    description:
      "Compress PDFs instantly in your browser. 100% free and privacy-first.",
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

  verification: {
    // google: "your-google-verification-code",
  },

  category: "technology",
};



/* =========================
   STRUCTURED DATA (JSON-LD)
========================= */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "PDF Compress",
  description:
    "Free online PDF compressor that runs entirely in your browser. Privacy-first: your files never leave your device.",
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
  browserRequirements:
    "Requires JavaScript. Works in Chrome, Firefox, Safari, Edge.",
};

/* =========================
   ROOT LAYOUT
========================= */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-MCMZ8KMLXL";

  return (
    <html lang="en">
      <head>
        {/* JSON-LD structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />


      </head>

      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Skip link for accessibility */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>

        {children}

        {/* Analytics event tracking */}
        <AnalyticsScript />

        {/* Google Analytics */}
        {gaMeasurementId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaMeasurementId}');
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
