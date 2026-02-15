'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: 'Is my PDF really processed locally?',
    answer: 'Yes! All compression happens entirely in your browser using Web Workers. Your files are never uploaded to any server. You can verify this by disconnecting from the internet after the page loads - compression will still work.',
  },
  {
    question: 'How much can I reduce my PDF size?',
    answer: 'Results vary depending on the PDF content. PDFs with large images can be reduced by 50-90%. Text-heavy PDFs or already-optimized files may see smaller reductions (10-30%). Our tool shows you the exact savings before you download.',
  },
  {
    question: 'Will compression affect the quality of my PDF?',
    answer: 'We offer multiple compression levels. The "Recommended" preset balances quality and size. For maximum compression, some image quality reduction may be visible. You can preview pages before downloading to ensure the quality meets your needs.',
  },
  {
    question: 'Is there a file size limit?',
    answer: 'We support PDFs up to 200MB. Larger files may work but could be slow depending on your device. For very large files, we recommend using the batch mode to process them efficiently.',
  },
  {
    question: 'Can I compress multiple PDFs at once?',
    answer: 'Yes! Switch to "Batch Mode" to upload and compress multiple PDFs simultaneously. You can download them individually or as a single ZIP file.',
  },
  {
    question: 'Is this tool really free?',
    answer: 'Yes, completely free with no hidden limits. We believe privacy-first tools should be accessible to everyone. There are no sign-ups, no watermarks, and no file limits.',
  },
  {
    question: 'What compression methods are available?',
    answer: 'We offer 24+ compression methods including: image recompression, downsampling, PNG to JPEG conversion, metadata removal, font optimization, content stream compression, and more. You can use presets or customize every setting.',
  },
  {
    question: 'Does it work on mobile devices?',
    answer: 'Yes! Our tool is fully responsive and works on smartphones and tablets. Touch-friendly controls make it easy to use on any device.',
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-12 sm:py-16" aria-labelledby="faq-heading">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h2
            id="faq-heading"
            className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3"
          >
            Frequently Asked Questions
          </h2>
          <p className="text-slate-600">
            Got questions? We have answers.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white rounded-lg border border-slate-200 overflow-hidden"
            >
              <button
                onClick={() => toggleFaq(index)}
                className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                aria-expanded={openIndex === index}
                aria-controls={`faq-answer-${index}`}
              >
                <span className="font-medium text-slate-900">{faq.question}</span>
                <ChevronDown
                  className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform duration-200 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>
              <div
                id={`faq-answer-${index}`}
                className={`overflow-hidden transition-all duration-200 ease-in-out ${
                  openIndex === index ? 'max-h-96' : 'max-h-0'
                }`}
                role="region"
                aria-labelledby={`faq-question-${index}`}
              >
                <p className="px-5 pb-4 text-slate-600 text-sm leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
