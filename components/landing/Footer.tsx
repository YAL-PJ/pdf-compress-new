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
          <span className="text-sm">100% Free & Private</span>
        </div>

        <nav aria-label="Footer navigation">
          <ul className="flex items-center gap-6 text-sm">
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
                href="/terms"
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                Terms of Service
              </Link>
            </li>
            <li>
              <XLogoLink
                ariaLabel="Visit PDF Compress on X"
                className="text-slate-600 hover:text-slate-900 transition-colors"
              />
            </li>
          </ul>
        </nav>

        <p className="text-sm text-slate-500">
          © {currentYear} PDF Compress. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
