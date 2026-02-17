interface XLogoLinkProps {
  className?: string;
  ariaLabel?: string;
}

export function XLogoLink({
  className = 'text-slate-600 hover:text-slate-900 transition-colors',
  ariaLabel = 'Visit our X profile',
}: XLogoLinkProps) {
  return (
    <a
      href="https://x.com/compress__pdf"
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      className={className}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4 fill-current"
      >
        <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.9L5.9 22H2.8l7.3-8.4L.8 2h6.4l4.4 6.2L18.9 2Zm-1.1 18h1.8L6.2 3.9H4.3L17.8 20Z" />
      </svg>
    </a>
  );
}
