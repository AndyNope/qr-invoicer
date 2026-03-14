import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker using Vite's asset URL handling
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/**
 * Convert each page of a PDF ArrayBuffer to a data URL (PNG).
 * @param {ArrayBuffer} arrayBuffer
 * @param {number} scale  rendering scale (2 = doubled resolution for better OCR)
 * @returns {Promise<string[]>}  array of data URLs, one per page
 */
export async function pdfToImages(arrayBuffer, scale = 2.5) {
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const images = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    images.push(canvas.toDataURL('image/png'));
  }

  return images;
}
