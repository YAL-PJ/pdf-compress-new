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
    default: "Free PDF Compressor Online | Compress PDF Files Fast & Privately",
    template: "%s | PDF Compress",
  },

  description:
    "Compress PDF online for free with powerful browser-based optimization. Reduce PDF file size fast with no server upload required, advanced quality controls, and secure local processing.",

  keywords: [
    "pdf compressor online",
    "free compress pdf",
    "compress pdf online free",
    "reduce pdf size",
    "shrink pdf file size",
    "best pdf compressor",
    "online pdf optimizer",
    "secure pdf compressor",
    "no upload pdf compression",
    "browser based pdf compressor",
    "batch pdf compressor",
    "compress large pdf",
    "high quality pdf compression",
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
    title: "Free PDF Compressor Online | Fast, Secure, High-Quality Results",
    description:
      "Compress PDF files online for free with powerful client-side optimization. No server upload needed. Faster compression, better quality, and total privacy.",
    type: "website",
    url: siteUrl,
    siteName: "PDF Compress",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PDF Compress - Free PDF Compressor Online",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Free PDF Compressor Online | PDF Compress",
    description:
      "Compress PDF online free with private, browser-based processing and advanced optimization settings.",
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
  "@graph": [
    {
      "@type": "WebSite",
      name: "PDF Compress",
      url: siteUrl,
      description:
        "Free PDF compressor online to reduce PDF size quickly and privately in your browser.",
      inLanguage: "en-US",
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteUrl}/?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "SoftwareApplication",
      name: "PDF Compress",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Any",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      description:
        "Compress PDF online free with high-quality output and no server upload.",
      url: siteUrl,
      featureList: [
        "24+ compression methods",
        "No server uploads required",
        "Batch PDF compression",
        "Advanced quality controls",
        "Page management tools",
      ],
    },
    {
      "@type": "Organization",
      name: "PDF Compress",
      url: siteUrl,
      sameAs: [siteUrl],
    },
  ],
};

/* =========================
   ROOT LAYOUT
========================= */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-MCMZ8KMLXL';

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

        {/* Mediavine Journey Grow */}
        <Script id="grow-initializer" data-grow-initializer="" strategy="afterInteractive">
          {`!(function(){window.growMe||((window.growMe=function(e){window.growMe._.push(e);}),(window.growMe._=[]));var e=document.createElement("script");(e.type="text/javascript"),(e.src="https://faves.grow.me/main.js"),(e.defer=!0),e.setAttribute("data-grow-faves-site-id","U2l0ZTo1ZjEwZjIwOS05NDk4LTQ5NDEtYjZiMi1hYTA5ZDEwYjQ5ZDE=");var t=document.getElementsByTagName("script")[0];t.parentNode.insertBefore(e,t);})();`}
        </Script>
      </body>
    </html>
  );
}
