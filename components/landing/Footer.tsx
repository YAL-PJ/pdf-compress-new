'use client';

import Link from 'next/link';

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
              <a
                href="https://x.com/compress__pdf"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Visit our X profile"
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4 fill-current"
                >
                  <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.9L5.9 22H2.8l7.3-8.4L.8 2h6.4l4.4 6.2L18.9 2Zm-1.1 18h1.8L6.2 3.9H4.3L17.8 20Z" />
                </svg>
              </a>
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
