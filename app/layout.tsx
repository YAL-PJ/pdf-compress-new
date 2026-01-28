import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF Compress",
  description: "Compress PDFs in your browser",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
