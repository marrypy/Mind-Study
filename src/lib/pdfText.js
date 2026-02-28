import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';

GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5/legacy/build/pdf.worker.min.mjs';

/**
 * Extract text from a PDF file in the browser using PDF.js.
 * @param {File} file - PDF file from input[type="file"]
 * @returns {Promise<string>} - Extracted text from all pages
 */
export async function extractTextFromPdf(file) {
  if (!file || file.type !== 'application/pdf') {
    throw new Error('Please select a PDF file.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const parts = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(' ');
    parts.push(pageText);
  }

  return parts.join('\n\n').trim();
}
