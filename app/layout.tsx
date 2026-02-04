import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { CookieConsent } from "@/components";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "PDF Compress - Free Online PDF Compressor | No Upload Required",
    template: "%s | PDF Compress",
  },
  description: "Compress PDFs instantly in your browser. 100% free, 100% private - your files never leave your device. 24+ compression methods, batch processing, page management.",
  keywords: [
    "PDF compression",
    "PDF compressor",
    "reduce PDF size",
    "compress PDF online",
    "free PDF tool",
    "PDF optimizer",
    "shrink PDF",
    "PDF size reducer",
    "online PDF compressor",
    "browser PDF compression",
    "private PDF compression",
    "batch PDF compression",
  ],
  authors: [{ name: "PDF Compress" }],
  creator: "PDF Compress",
  publisher: "PDF Compress",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://pdfcompress.app"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "PDF Compress - Free Online PDF Compressor",
    description: "Compress PDFs instantly in your browser. 100% free, 100% private - your files never leave your device.",
    type: "website",
    locale: "en_US",
    siteName: "PDF Compress",
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
    description: "Compress PDFs instantly in your browser. 100% free, 100% private.",
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
    // Add your verification codes here
    // google: "your-google-verification-code",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

  return (
    <html lang="en">
      <head>
        {/* Plausible Analytics - Privacy-friendly analytics */}
        {plausibleDomain && (
          <Script
            defer
            data-domain={plausibleDomain}
            src="https://plausible.io/js/script.js"
            strategy="afterInteractive"
          />
        )}
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

        {/* Cookie consent banner */}
        <CookieConsent />
      </body>
    </html>
  );
}
