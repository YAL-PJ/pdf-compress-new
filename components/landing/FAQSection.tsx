'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { seoFaqs } from '@/lib/seo';

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
          {seoFaqs.map((faq, index) => (
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
                <span id={`faq-question-${index}`} className="font-medium text-slate-900">
                  {faq.question}
                </span>
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
