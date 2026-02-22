export const seoFaqs = [
  {
    question: 'Is my PDF really processed locally?',
    answer:
      'Yes. You select your PDF in the browser and compression runs entirely on your device using JavaScript and WebAssembly. Files are never sent to any server. You can verify this by checking your browser\'s Network tab during compression.',
  },
  {
    question: 'How much can I reduce PDF file size?',
    answer:
      'It depends on the file content. Image-heavy PDFs (photos, scans, presentations) may shrink 50-90%. Already optimized or text-only files usually shrink 10-30%. The tool shows you the exact before and after file sizes.',
  },
  {
    question: 'Will compression reduce quality?',
    answer:
      'You have full control. The "Light" and "Balanced" presets maintain high visual quality with minimal perceptible change. "Aggressive" mode maximizes size reduction with some quality trade-off. Advanced controls let you fine-tune image quality, DPI, and other parameters.',
  },
  {
    question: 'Can I compress PDF files for free?',
    answer:
      'Yes, 100% free with no limits. There is no sign-up, no watermark, no premium tier, and no daily usage cap. You can compress one file or batch-compress multiple PDFs at once.',
  },
  {
    question: 'Is there a file size limit?',
    answer:
      'PDFs up to around 200MB are supported, depending on your device memory and browser performance. Since processing happens locally, more RAM on your device means better support for larger files.',
  },
  {
    question: 'Can I use this PDF compressor on mobile?',
    answer:
      'Yes. The interface is fully responsive and works on iOS Safari, Chrome for Android, and other modern mobile browsers. The same compression features are available on mobile and desktop.',
  },
  {
    question: 'How do I compress a PDF for email?',
    answer:
      'Upload your PDF, select the "Balanced" or "Aggressive" preset depending on how small you need the file, then download the result. Most email providers allow attachments up to 25MB. Image-heavy PDFs often compress to well under that limit.',
  },
  {
    question: 'Is PDF Compress safe for confidential documents?',
    answer:
      'Yes. Since all processing happens in your browser and no files are uploaded to any server, PDF Compress is safe for confidential, legal, medical, financial, or any sensitive documents. The privacy guarantee is architectural, not just policy-based.',
  },
  {
    question: 'How does PDF Compress compare to iLovePDF and SmallPDF?',
    answer:
      'PDF Compress is completely free with no limits, while iLovePDF and SmallPDF restrict free usage. More importantly, PDF Compress processes files locally in your browser — competitors upload your files to their servers. PDF Compress also requires no account and adds no watermarks.',
  },
  {
    question: 'Can I compress multiple PDFs at once?',
    answer:
      'Yes. Batch mode lets you upload and compress multiple PDF files simultaneously. Each file can use the same or different compression settings, and you can download them individually or as a ZIP archive.',
  },
  {
    question: 'Does PDF Compress work offline?',
    answer:
      'Yes. Once the page has loaded in your browser, all compression functionality works without an internet connection. This is possible because all processing runs locally with no server dependency.',
  },
  {
    question: 'Can I compress scanned PDF documents?',
    answer:
      'Yes, and scanned PDFs typically benefit the most from compression. Since scanned documents are essentially large images embedded in a PDF, they often achieve 50-80% size reduction with the image optimization features.',
  },
] as const;
