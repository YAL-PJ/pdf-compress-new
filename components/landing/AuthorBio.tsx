export function AuthorBio() {
  return (
    <section
      className="max-w-4xl mx-auto px-4 py-10"
      aria-label="About the author"
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      itemScope
      itemType="https://schema.org/Person"
    >
      <div className="flex items-start gap-5 p-6 rounded-xl bg-blue-50 border border-blue-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://freemergepdf.com/yanis-avatar.jpg"
          alt="Yanis L."
          width={64}
          height={64}
          className="rounded-full flex-shrink-0 border-2 border-blue-200"
          // @ts-ignore
          itemProp="image"
          loading="lazy"
        />
        <div className="text-sm leading-relaxed text-blue-900">
          <strong itemProp="name">Yanis L.</strong>
          {' — '}
          <span itemProp="description">
            indie maker who builds free, privacy-first PDF tools. PDF Compress, like all the
            tools in this suite, runs entirely in your browser so your files never leave your
            device.
          </span>
          <span className="hidden" itemProp="url">{`https://www.freecompresspdf.com/about`}</span>
          <span className="hidden" itemProp="sameAs">{`https://www.quora.com/profile/Yanis-L-3`}</span>
          <span className="hidden" itemProp="sameAs">{`https://x.com/compress__pdf`}</span>
          <br />
          <a
            href="/about"
            rel="author"
            className="inline-block mt-2 font-semibold text-blue-600 hover:text-blue-800 transition-colors"
          >
            About the maker →
          </a>
        </div>
      </div>
    </section>
  );
}
