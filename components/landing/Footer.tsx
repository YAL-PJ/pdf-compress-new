'use client';

import Link from 'next/link';
import { XLogoLink } from '@/components/XLogoLink';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-8 mt-12 border-t border-slate-200" role="contentinfo">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-slate-600">
          <span className="text-lg" aria-hidden="true">🗜️</span>
          <span className="font-semibold text-slate-800">PDF Compress</span>
          <span className="text-slate-400">|</span>
          <span className="text-sm">100% Free &amp; Private</span>
        </div>

        <nav aria-label="Footer navigation">
          <ul className="flex items-center gap-6 text-sm">
            <li>
              <Link
                href="/about"
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                About
              </Link>
            </li>
            <li>
              <Link
                href="/privacy"
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link
                href="/blog"
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                Blog
              </Link>
            </li>
            <li>
              <Link
                href="/faq"
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                FAQ
              </Link>
            </li>
            <li>
              <Link
                href="/terms"
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                Terms of Service
              </Link>
            </li>
            <li>
              <a
                href="https://freemergepdf.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                Merge PDFs
              </a>
            </li>
            <li>
              <a
                href="https://splitpdffree.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                Split PDFs
              </a>
            </li>
            <li>
              <a
                href="https://converttopdffree.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                Convert to PDF
              </a>
            </li>
            <li>
              <a
                href="https://toppdfedittools.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                All PDF Tools
              </a>
            </li>
            <li>
              <XLogoLink className="text-slate-600 hover:text-slate-900 transition-colors" />
            </li>
          </ul>
        </nav>

        <p className="text-sm text-slate-500">
          &copy; {currentYear} PDF Compress. Built by{' '}
          <a href="/about" rel="author" className="text-slate-500 hover:text-slate-700 transition-colors">
            Yanis L.
          </a>
        </p>
      </div>
    </footer>
  );
}
