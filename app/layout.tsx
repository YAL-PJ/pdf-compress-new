import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF Compress - Free Online PDF Compressor",
  description: "Compress PDFs locally in your browser. Privacy-first: your files never leave your device. 24+ compression methods available.",
  keywords: ["PDF compression", "PDF compressor", "reduce PDF size", "compress PDF online", "free PDF tool"],
  authors: [{ name: "PDF Compress" }],
  openGraph: {
    title: "PDF Compress - Free Online PDF Compressor",
    description: "Compress PDFs locally in your browser. Privacy-first: your files never leave your device.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PDF Compress - Free Online PDF Compressor",
    description: "Compress PDFs locally in your browser. Privacy-first.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {/* Skip link for accessibility - allows keyboard users to skip navigation */}
        <a
          href="#main-content"
          className="skip-link"
        >
          Skip to main content
        </a>

        {children}
      </body>
    </html>
  );
}
