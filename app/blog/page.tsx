import type { Metadata } from 'next';
import Link from 'next/link';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.freecompresspdf.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Blog - PDF Compression Tips, Comparisons & Insights',
  description:
    'Honest takes on PDF compression tools, quality comparisons, and what actually matters when you need to reduce PDF file size without losing quality.',
  alternates: {
    canonical: '/blog/',
  },
  openGraph: {
    title: 'PDF Compress Blog',
    description:
      'Honest takes on PDF compression tools, quality comparisons, and what actually matters when shrinking PDFs.',
    type: 'website',
    url: '/blog',
  },
};

const posts = [
  {
    slug: 'the-ugly-truth-about-online-pdf-compressors',
    title: 'The Ugly Truth About Online PDF Compressors',
    description:
      'Most "free" PDF compressors upload your files, paywall the results, or quietly destroy quality. Here is what is really going on.',
    date: '2026-03-16',
    readTime: '7 min read',
  },
  {
    slug: 'pdf-compression-tools-compared',
    title: 'PDF Compression Tools Compared: What Is Actually Out There',
    description:
      'An honest look at the most popular PDF compression tools on the web, what they do well, where they fall short, and what you should know before uploading your files.',
    date: '2026-03-16',
    readTime: '8 min read',
  },
  {
    slug: 'what-the-best-pdf-compressor-looks-like',
    title: 'What the Best PDF Compressor Would Actually Look Like',
    description:
      'If you could design the perfect PDF compression tool from scratch, what would it include? We break down every feature that matters and where to find them today.',
    date: '2026-03-16',
    readTime: '9 min read',
  },
];

const blogIndexJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Blog',
      name: 'PDF Compress Blog',
      description:
        'Honest takes on PDF compression tools, quality comparisons, and tips for reducing PDF file size.',
      url: `${siteUrl}/blog`,
      publisher: {
        '@type': 'Organization',
        name: 'PDF Compress',
        url: siteUrl,
      },
      blogPost: posts.map((post) => ({
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.description,
        datePublished: post.date,
        url: `${siteUrl}/blog/${post.slug}`,
      })),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${siteUrl}/blog` },
      ],
    },
  ],
};

export default function BlogIndex() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogIndexJsonLd) }}
      />

      <h1 className="text-4xl font-extrabold text-slate-900 mb-3">Blog</h1>
      <p className="text-slate-700 leading-7 mb-10">
        Honest takes on PDF compression: what works, what doesn&apos;t, and what actually matters
        when you need smaller files without the headaches.
      </p>

      <div className="space-y-6">
        {posts.map((post) => (
          <article
            key={post.slug}
            className="rounded-xl border border-slate-200 bg-white p-6 hover:border-slate-300 transition-colors"
          >
            <Link href={`/blog/${post.slug}/`} className="block group">
              <p className="text-sm text-slate-500 mb-1">
                {post.date} &middot; {post.readTime}
              </p>
              <h2 className="text-xl font-semibold text-slate-900 group-hover:text-blue-700 mb-2">
                {post.title}
              </h2>
              <p className="text-slate-600 leading-7">{post.description}</p>
            </Link>
          </article>
        ))}
      </div>
    </>
  );
}
